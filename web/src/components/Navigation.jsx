import * as React from "react";
import { useContext, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import * as RadixDialog from "@radix-ui/react-dialog";
import { BellOff, BookOpen, Inbox, Loader2, Lock, LogOut, MoreHorizontal, Plus, Send, Settings, UserRound } from "lucide-react";
import SubscribeDialog from "./SubscribeDialog";
import { openUrl, topicDisplayName, topicUrl } from "../app/utils";
import routes from "./routes";
import { ConnectionState } from "../app/Connection";
import subscriptionManager from "../app/SubscriptionManager";
import notifier from "../app/Notifier";
import config from "../app/config";
import session from "../app/Session";
import accountApi, { Permission } from "../app/AccountApi";
import db from "../app/db";
import AccountContext from "./AccountContext";
import { SubscriptionPopup } from "./SubscriptionPopup";
import { useNotificationPermissionListener, useVersionChangeListener } from "./hooks";
import { fadeNavigate } from "../app/transition";
import logo from "../img/alai.svg";
import TopicAvatar from "./ui/TopicAvatar";
import Button from "./ui/Button";
import { Alert } from "./ui/Primitives";
import cn from "./ui/cn";

const navWidth = 272;

/** Persistent sidebar on wide screens; a slide-in sheet on phones. */
const Navigation = (props) => (
  <>
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r border-border bg-surface sm:flex"
      aria-label="Navigation"
    >
      <NavContent {...props} />
    </aside>
    <RadixDialog.Root open={props.mobileDrawerOpen} onOpenChange={props.onMobileDrawerToggle}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40 sm:hidden" />
        <RadixDialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[300px] flex-col bg-surface shadow-2xl sm:hidden">
          <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">Topics and settings</RadixDialog.Description>
          <NavContent {...props} onNavigate={props.onMobileDrawerToggle} />
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  </>
);
Navigation.width = navWidth;

const NavContent = (props) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { account } = useContext(AccountContext);
  const [subscribeDialogKey, setSubscribeDialogKey] = useState(0);
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);
  const [versionChanged, setVersionChanged] = useState(false);
  useVersionChangeListener(() => setVersionChanged(true));

  const go = (path) => {
    navigate(path);
    props.onNavigate?.();
  };

  const handleSubscribeReset = () => {
    setSubscribeDialogOpen(false);
    setSubscribeDialogKey((prev) => prev + 1);
  };

  const handleSubscribeSubmit = (subscription) => {
    handleSubscribeReset();
    go(routes.forSubscription(subscription));
  };

  const showPermissionRequired = useNotificationPermissionListener(() => notifier.notRequested());
  const showPermissionDenied = useNotificationPermissionListener(() => notifier.denied());
  const showIOSInstallRequired = notifier.iosSupportedButInstallRequired();
  const showBrowserNotSupported = !showIOSInstallRequired && !notifier.browserSupported();
  const showContextNotSupported = notifier.browserSupported() && !notifier.contextSupported();
  const subscriptions = (props.subscriptions || [])
    .filter((s) => !s.internal)
    .sort((a, b) => (topicUrl(a.baseUrl, a.topic) < topicUrl(b.baseUrl, b.topic) ? -1 : 1));

  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <img src={logo} alt={t("action_bar_logo_alt")} className="size-8 rounded-lg" />
        <span className="text-lg font-semibold tracking-tight">Alai</span>
      </div>

      <div className="flex gap-2 px-4 pb-3">
        <Button className="flex-1" onClick={() => props.onPublishMessageClick()}>
          <Send className="size-4" />
          {t("nav_button_publish_message")}
        </Button>
        <Button variant="secondary" className="px-3" onClick={() => setSubscribeDialogOpen(true)} aria-label={t("nav_button_subscribe")}>
          <Plus className="size-4" />
        </Button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className="space-y-2 px-1 pb-3 empty:hidden">
          {versionChanged && (
            <Alert
              severity="info"
              title={t("version_update_available_title")}
              action={
                <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                  {t("common_refresh")}
                </Button>
              }
            >
              {t("version_update_available_description")}
            </Alert>
          )}
          {showPermissionRequired && (
            <Alert
              severity="warning"
              title={t("alert_notification_permission_required_title")}
              action={
                <Button size="sm" variant="secondary" onClick={() => notifier.maybeRequestPermission()}>
                  {t("alert_notification_permission_required_button")}
                </Button>
              }
            >
              {t("alert_notification_permission_required_description")}
            </Alert>
          )}
          {showPermissionDenied && (
            <Alert severity="warning" title={t("alert_notification_permission_denied_title")}>
              {t("alert_notification_permission_denied_description")}
            </Alert>
          )}
          {showIOSInstallRequired && (
            <Alert severity="warning" title={t("alert_notification_ios_install_required_title")}>
              {t("alert_notification_ios_install_required_description")}
            </Alert>
          )}
          {showBrowserNotSupported && (
            <Alert severity="warning" title={t("alert_not_supported_title")}>
              {t("alert_not_supported_description")}
            </Alert>
          )}
          {showContextNotSupported && (
            <Alert severity="warning" title={t("alert_not_supported_title")}>
              <Trans
                i18nKey="alert_not_supported_context_description"
                components={{
                  mdnLink: (
                    // eslint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label
                    <a
                      className="underline"
                      href="https://developer.mozilla.org/en-US/docs/Web/API/notification"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ),
                }}
              />
            </Alert>
          )}
        </div>

        <NavItem icon={Inbox} selected={location.pathname === config.app_root} onClick={() => go(routes.app)}>
          {t("nav_button_all_notifications")}
        </NavItem>

        {subscriptions.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-4 text-xs font-medium text-muted">{t("nav_topics_title")}</p>
            {subscriptions.map((subscription) => (
              <SubscriptionItem
                key={subscription.id}
                subscription={subscription}
                selected={props.selectedSubscription?.id === subscription.id}
                onNavigate={props.onNavigate}
              />
            ))}
          </>
        )}

        <div className="my-3 h-px bg-border" />
        <NavItem icon={Settings} selected={location.pathname === routes.settings} onClick={() => go(routes.settings)}>
          {t("nav_button_settings")}
        </NavItem>
        {session.exists() && (
          <NavItem
            icon={UserRound}
            selected={location.pathname === routes.account}
            onClick={() => {
              accountApi.sync(); // Dangle!
              go(routes.account);
            }}
          >
            {t("nav_button_account")}
          </NavItem>
        )}
        <NavItem icon={BookOpen} onClick={() => openUrl("/docs")}>
          {t("nav_button_documentation")}
        </NavItem>
      </nav>

      <ProfileFooter account={account} />

      <SubscribeDialog
        key={`subscribeDialog${subscribeDialogKey}`} // Resets dialog when canceled/closed
        open={subscribeDialogOpen}
        subscriptions={props.subscriptions}
        onCancel={handleSubscribeReset}
        onSuccess={handleSubscribeSubmit}
      />
    </>
  );
};

const NavItem = ({ icon: Icon, selected, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={selected ? "page" : undefined}
    className={cn(
      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
      selected ? "bg-accent-soft text-accent" : "text-text hover:bg-surface-2",
    )}
  >
    <Icon className="size-[18px] shrink-0" />
    <span className="truncate">{children}</span>
  </button>
);

const SubscriptionItem = ({ subscription, selected, onNavigate }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const displayName = topicDisplayName(subscription);
  const connecting = subscription.state === ConnectionState.Connecting;
  const unread = subscription.new <= 99 ? subscription.new : "99+";
  const reserved = subscription.reservation?.everyone;

  const handleClick = async () => {
    navigate(routes.forSubscription(subscription));
    onNavigate?.();
    await subscriptionManager.markNotificationsRead(subscription.id);
  };

  return (
    <div
      className={cn("group flex items-center gap-1 rounded-xl pr-1 transition-colors", selected ? "bg-accent-soft" : "hover:bg-surface-2")}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-current={selected ? "page" : undefined}
        aria-label={connecting ? `${displayName} (${t("nav_button_connecting")})` : displayName}
        className="flex min-w-0 flex-1 items-center gap-3 py-1.5 pl-2 text-left"
      >
        {connecting ? (
          <span className="flex size-7 items-center justify-center">
            <Loader2 className="size-4 animate-spin text-muted" />
          </span>
        ) : (
          <TopicAvatar name={displayName} />
        )}
        <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", selected ? "text-accent" : "text-text")}>{displayName}</span>
        {reserved && reserved !== Permission.READ_WRITE && (
          <Lock className="size-3.5 shrink-0 text-muted" aria-label={t("prefs_reservations_table_everyone_deny_all")} />
        )}
        {subscription.mutedUntil > 0 && <BellOff className="size-3.5 shrink-0 text-muted" aria-label={t("nav_button_muted")} />}
        {subscription.new > 0 && (
          <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-bold leading-5 text-accent-fg">{unread}</span>
        )}
      </button>
      <SubscriptionPopup subscription={subscription} align="start">
        <button
          type="button"
          aria-label={t("action_bar_toggle_action_menu")}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-surface hover:text-text focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 max-sm:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </SubscriptionPopup>
    </div>
  );
};

const ProfileFooter = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await accountApi.logout();
      await db().delete();
    } finally {
      await session.resetAndRedirect(routes.app, { fade: true });
    }
  };

  if (!session.exists()) {
    if (!config.enable_login && !config.enable_signup) {
      return null;
    }
    return (
      <div className="flex h-16 shrink-0 items-center gap-2 border-t border-border px-4">
        {config.enable_login && (
          <Button variant="secondary" className="flex-1" onClick={() => fadeNavigate(navigate, routes.login)}>
            {t("action_bar_sign_in")}
          </Button>
        )}
        {config.enable_signup && (
          <Button variant="ghost" className="flex-1" onClick={() => fadeNavigate(navigate, routes.signup)}>
            {t("action_bar_sign_up")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-16 shrink-0 items-center gap-3 border-t border-border px-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold uppercase text-muted">
        {session.username()?.[0]}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{session.username()}</span>
      <button
        type="button"
        onClick={handleLogout}
        aria-label={t("action_bar_profile_logout")}
        title={t("action_bar_profile_logout")}
        className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
};

export default Navigation;
