import * as React from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bell, BellOff, Menu as MenuIcon, MoreHorizontal, RefreshCw } from "lucide-react";
import subscriptionManager from "../app/SubscriptionManager";
import routes from "./routes";
import { shortUrl, topicDisplayName } from "../app/utils";
import { SubscriptionPopup } from "./SubscriptionPopup";
import { useIsLaunchedPWA } from "./hooks";
import IconButton from "./ui/IconButton";
import TopicAvatar from "./ui/TopicAvatar";

/** Header of the main area: current topic or page, and the topic's actions. */
const ActionBar = (props) => {
  const { t } = useTranslation();
  const location = useLocation();
  const isLaunchedPWA = useIsLaunchedPWA();
  const { selected } = props;

  let title = t("nav_button_all_notifications");
  if (selected) {
    title = topicDisplayName(selected);
  } else if (location.pathname === routes.settings) {
    title = t("action_bar_settings");
  } else if (location.pathname === routes.account) {
    title = t("action_bar_account");
  }

  return (
    <header className="fixed inset-x-0 top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface/80 px-3 backdrop-blur-xl backdrop-saturate-150 sm:left-[272px] sm:px-6">
      <IconButton label={t("action_bar_show_menu")} tooltip={false} className="sm:hidden" onClick={props.onMobileDrawerToggle}>
        <MenuIcon className="size-5" />
      </IconButton>
      {selected && <TopicAvatar name={title} size={32} />}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
        {selected && <p className="truncate text-xs text-muted">{shortUrl(selected.baseUrl)}</p>}
      </div>
      {isLaunchedPWA && <ReloadButton />}
      {selected && <TopicActions subscription={selected} />}
    </header>
  );
};

const TopicActions = ({ subscription }) => {
  const { t } = useTranslation();
  const muted = !!subscription.mutedUntil;

  const handleToggleMute = async () => {
    await subscriptionManager.setMutedUntil(subscription.id, muted ? 0 : 1); // 1 = muted until unmuted
  };

  return (
    <>
      <IconButton label={t("action_bar_toggle_mute")} onClick={handleToggleMute} className={muted ? "text-warning" : undefined}>
        {muted ? <BellOff className="size-5" /> : <Bell className="size-5" />}
      </IconButton>
      <SubscriptionPopup subscription={subscription}>
        <IconButton label={t("action_bar_toggle_action_menu")}>
          <MoreHorizontal className="size-5" />
        </IconButton>
      </SubscriptionPopup>
    </>
  );
};

/** Hard refresh for the installed PWA: purges service worker caches first, since a plain reload serves the precached shell. */
const ReloadButton = () => {
  const { t } = useTranslation();

  const handleReload = async () => {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (e) {
      console.warn("[ActionBar] Error clearing caches during reload", e);
    } finally {
      window.location.reload();
    }
  };

  return (
    <IconButton label={t("action_bar_reload")} onClick={handleReload}>
      <RefreshCw className="size-5" />
    </IconButton>
  );
};

export default ActionBar;
