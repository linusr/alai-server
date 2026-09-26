import * as React from "react";
import { Suspense, useContext, useEffect, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import "../styles.css";
import { useLiveQuery } from "dexie-react-hooks";
import { BrowserRouter, Outlet, Route, Routes, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ToastProvider } from "./ui/Toast";
import { TooltipProvider } from "./ui/Tooltip";
import { AllSubscriptions, SingleSubscription } from "./Notifications";
import Navigation from "./Navigation";
import ActionBar from "./ActionBar";
import Preferences from "./Preferences";
import subscriptionManager from "../app/SubscriptionManager";
import userManager from "../app/UserManager";
import { expandUrl, getKebabCaseLangStr, darkModeEnabled, updateFavicon } from "../app/utils";
import ErrorBoundary from "./ErrorBoundary";
import routes from "./routes";
import { useAccountListener, useBackgroundProcesses, useConnectionListeners, usePrefersDarkMode, useWebPushTopics } from "./hooks";
import PublishDialog from "./PublishDialog";
import Messaging from "./Messaging";
import Login from "./Login";
import Signup from "./Signup";
import Account from "./Account";
import EmailVerify from "./EmailVerify";
import PasswordReset from "./PasswordReset";
import PasswordResetRequest from "./PasswordResetRequest";
import initI18n from "../app/i18n"; // Translations!
import prefs from "../app/Prefs";
import session from "../app/Session";
import AccountContext from "./AccountContext";
import { PrefCacheProvider } from "./PrefCache";
import hideSplash from "../app/splash";

initI18n();

const App = () => {
  const { i18n } = useTranslation();
  const languageDir = i18n.dir();
  const [account, setAccount] = useState(null);
  const accountMemo = useMemo(() => ({ account, setAccount }), [account, setAccount]);
  const prefersDarkMode = usePrefersDarkMode();
  const themePreference = useLiveQuery(() => prefs.theme());
  const isDark = darkModeEnabled(prefersDarkMode, themePreference);

  useEffect(() => {
    document.documentElement.setAttribute("lang", getKebabCaseLangStr(i18n.language));
    document.dir = languageDir;
  }, [i18n.language, languageDir]);

  // Keep the <html> background in sync with the theme once loaded. The splash script sets the
  // initial class; don't override it while the preference is still loading.
  useEffect(() => {
    if (themePreference === undefined) {
      return;
    }
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark, themePreference]);

  // Safety net: hide the splash even if no route does (e.g. an unmatched path).
  useEffect(() => {
    const timer = setTimeout(() => hideSplash(), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!session.exists() && config.require_login && window.location.pathname !== routes.login) {
      window.location.href = routes.login;
    }
  }, []);

  return (
    <Suspense fallback={<Loader />}>
      <BrowserRouter>
        <AccountContext.Provider value={accountMemo}>
          <TooltipProvider>
            <ToastProvider>
              <ErrorBoundary>
                <Routes>
                  <Route element={<AuthLayout />}>
                    <Route path={routes.login} element={<Login />} />
                    <Route path={routes.signup} element={<Signup />} />
                    <Route path={routes.passwordResetRequest} element={<PasswordResetRequest />} />
                    <Route path={routes.passwordReset} element={<PasswordReset />} />
                    <Route path={routes.emailVerify} element={<EmailVerify />} />
                  </Route>
                  <Route element={<Layout />}>
                    <Route path={routes.app} element={<AllSubscriptions />} />
                    <Route path={routes.account} element={<Account />} />
                    <Route path={routes.settings} element={<Preferences />} />
                    <Route path={routes.subscription} element={<SingleSubscription />} />
                    <Route path={routes.subscriptionExternal} element={<SingleSubscription />} />
                  </Route>
                </Routes>
              </ErrorBoundary>
            </ToastProvider>
          </TooltipProvider>
        </AccountContext.Provider>
      </BrowserRouter>
    </Suspense>
  );
};

const updateTitle = (newNotificationsCount) => {
  document.title = newNotificationsCount > 0 ? `(${newNotificationsCount}) Alai` : "Alai";
  window.navigator.setAppBadge?.(newNotificationsCount);
  updateFavicon(newNotificationsCount);
};

// Auth pages render synchronously, so the splash can be removed on mount.
const AuthLayout = () => {
  useEffect(() => hideSplash(), []);
  return <Outlet />;
};

const Layout = () => {
  const params = useParams();
  const { account, setAccount } = useContext(AccountContext);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sendDialogOpenMode, setSendDialogOpenMode] = useState("");
  const users = useLiveQuery(() => userManager.all());
  const subscriptions = useLiveQuery(() => subscriptionManager.all());
  // Preloaded here so the All view (and single topics, via filter) have data on mount -- no empty
  // frame when switching.
  const allNotifications = useLiveQuery(() => subscriptionManager.getAllNotifications());
  const webPushTopics = useWebPushTopics();
  const subscriptionsWithoutInternal = subscriptions?.filter((s) => !s.internal);
  const newNotificationsCount = subscriptionsWithoutInternal?.reduce((prev, cur) => prev + cur.new, 0) || 0;
  const [selected] = (subscriptionsWithoutInternal || []).filter(
    (s) =>
      (params.baseUrl && expandUrl(params.baseUrl).includes(s.baseUrl) && params.topic === s.topic) ||
      (config.base_url === s.baseUrl && params.topic === s.topic),
  );

  useConnectionListeners(account, subscriptions, users, webPushTopics);
  useAccountListener(setAccount);
  useBackgroundProcesses();
  useEffect(() => updateTitle(newNotificationsCount), [newNotificationsCount]);

  // Hide the splash only once subscriptions have loaded, so the nav/list don't pop in empty-then-filled.
  useEffect(() => {
    if (subscriptions !== undefined) {
      hideSplash();
    }
  }, [subscriptions]);

  return (
    <PrefCacheProvider>
      <div className="flex">
        <ActionBar selected={selected} onMobileDrawerToggle={() => setMobileDrawerOpen(!mobileDrawerOpen)} />
        <Navigation
          subscriptions={subscriptionsWithoutInternal}
          selectedSubscription={selected}
          mobileDrawerOpen={mobileDrawerOpen}
          onMobileDrawerToggle={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          onPublishMessageClick={() => setSendDialogOpenMode(PublishDialog.OPEN_MODE_DEFAULT)}
        />
        <Main>
          <Outlet
            context={{
              subscriptions: subscriptionsWithoutInternal,
              selected,
              allNotifications,
            }}
          />
        </Main>
        <Messaging selected={selected} dialogOpenMode={sendDialogOpenMode} onDialogOpenModeChange={setSendDialogOpenMode} />
      </div>
    </PrefCacheProvider>
  );
};

/** Scroll container for the page content; the infinite-scrolling notification list targets its id. */
const Main = (props) => (
  <main id="main" className="flex h-dvh min-w-0 flex-1 flex-col overflow-y-auto bg-bg pt-16 sm:ml-[272px]">
    {props.children}
  </main>
);

const Loader = () => (
  <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-bg">
    <Loader2 className="size-8 animate-spin text-accent" />
  </div>
);

export default App;
