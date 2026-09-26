import * as React from "react";
import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, Eraser, Lock, LockKeyhole, LockOpen, MinusCircle, Pencil, Send, X } from "lucide-react";
import subscriptionManager from "../app/SubscriptionManager";
import accountApi, { Role } from "../app/AccountApi";
import session from "../app/Session";
import routes from "./routes";
import { formatDateTime, shuffle } from "../app/utils";
import api from "../app/Api";
import AccountContext from "./AccountContext";
import { usePrefCache } from "./PrefCache";
import { DialogError, ReserveAddDialog, ReserveDeleteDialog, ReserveEditDialog } from "./ReserveDialogs";
import { UnauthorizedError } from "../app/errors";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "./ui/Menu";
import { Dialog, DialogContent, DialogFooter } from "./ui/Dialog";
import { Input } from "./ui/Field";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import { Chip } from "./ui/Primitives";
import { useToast } from "./ui/Toast";

/**
 * Topic actions menu; `children` is the trigger element. The menu is non-modal so the dialogs it opens
 * own focus and pointer events once it closes.
 */
export const SubscriptionPopup = ({ subscription, align = "end", children }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { dateFormat, timeFormat } = usePrefCache();
  const { account } = useContext(AccountContext);
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null);
  const reservations = account?.reservations || [];
  const closeDialog = () => setDialog(null);

  const showReservationAdd = config.enable_reservations && !subscription?.reservation && account?.stats.reservations_remaining > 0;
  const showReservationAddDisabled =
    !showReservationAdd && config.enable_reservations && !subscription?.reservation && account?.stats.reservations_remaining === 0;
  const showReservationEdit = config.enable_reservations && !!subscription?.reservation;
  const showReservationDelete = config.enable_reservations && !!subscription?.reservation;

  const handleSendTestMessage = async () => {
    const { baseUrl, topic } = subscription;
    const tags = shuffle([
      "grinning",
      "octopus",
      "upside_down_face",
      "palm_tree",
      "maple_leaf",
      "apple",
      "skull",
      "warning",
      "jack_o_lantern",
      "de-server-1",
      "backups",
      "cron-script",
      "script-error",
      "phils-automation",
      "mouse",
      "go-rocks",
      "hi-ben",
    ]).slice(0, Math.round(Math.random() * 4));
    const priority = shuffle([1, 2, 3, 4, 5])[0];
    const title = shuffle([
      "",
      "",
      "", // Higher chance of no title
      "Oh my, another test message?",
      "Titles are optional, did you know that?",
      "ntfy is open source, and will always be free. Cool, right?",
      "I don't really like apples",
      "My favorite TV show is The Wire. You should watch it!",
      "You can attach files and URLs to messages too",
      "You can delay messages up to 3 days",
    ])[0];
    const nowSeconds = Math.round(Date.now() / 1000);
    const message = shuffle([
      `Hello friend, this is a test notification from ntfy web. It's ${formatDateTime(
        nowSeconds,
        dateFormat,
        timeFormat,
      )} right now. Is that early or late?`,
      `So I heard you like ntfy? If that's true, go to GitHub and star it, or to the Play store and rate it. Thanks! Oh yeah, this is a test notification.`,
      `It's almost like you want to hear what I have to say. I'm not even a machine. I'm just a sentence that Phil typed on a random Thursday.`,
      `Alright then, it's ${formatDateTime(
        nowSeconds,
        dateFormat,
        timeFormat,
      )} already. Boy oh boy, where did the time go? I hope you're alright, friend.`,
      `There are nine million bicycles in Beijing That's a fact; It's a thing we can't deny. I wonder if that's true ...`,
      `I'm really excited that you're trying out ntfy. Did you know that there are a few public topics, such as ntfy.sh/stats and ntfy.sh/announcements.`,
      `It's interesting to hear what people use ntfy for. I've heard people talk about using it for so many cool things. What do you use it for?`,
    ])[0];
    try {
      await api.publish(baseUrl, topic, message, { title, priority, tags });
    } catch (e) {
      console.log(`[SubscriptionPopup] Error publishing message`, e);
      toast(t("message_bar_error_publishing"));
    }
  };

  const handleClearAll = async () => {
    console.log(`[SubscriptionPopup] Deleting all notifications from ${subscription.id}`);
    await subscriptionManager.deleteNotifications(subscription.id);
  };

  const handleSetMutedUntil = async (mutedUntil) => {
    await subscriptionManager.setMutedUntil(subscription.id, mutedUntil);
  };

  const handleUnsubscribe = async () => {
    console.log(`[SubscriptionPopup] Unsubscribing from ${subscription.id}`, subscription);
    await subscriptionManager.remove(subscription);
    if (session.exists() && !subscription.internal) {
      try {
        await accountApi.deleteSubscription(subscription.baseUrl, subscription.topic);
      } catch (e) {
        console.log(`[SubscriptionPopup] Error unsubscribing`, e);
        if (e instanceof UnauthorizedError) {
          await session.resetAndRedirect(routes.login);
        }
      }
    }
    const newSelected = await subscriptionManager.first(); // May be undefined
    if (newSelected && !newSelected.internal) {
      navigate(routes.forSubscription(newSelected));
    } else {
      navigate(routes.app);
    }
  };

  return (
    <>
      <Menu modal={false}>
        <MenuTrigger asChild>{children}</MenuTrigger>
        <MenuContent align={align}>
          <MenuItem icon={Pencil} onSelect={() => setDialog("displayName")}>
            {t("action_bar_change_display_name")}
          </MenuItem>
          {showReservationAdd && (
            <MenuItem icon={Lock} onSelect={() => setDialog("reserveAdd")}>
              {t("action_bar_reservation_add")}
            </MenuItem>
          )}
          {showReservationAddDisabled && (
            <MenuItem icon={Lock} disabled>
              <span className="flex-1">{t("action_bar_reservation_add")}</span>
              <LimitReachedChip />
            </MenuItem>
          )}
          {showReservationEdit && (
            <MenuItem icon={LockKeyhole} onSelect={() => setDialog("reserveEdit")}>
              {t("action_bar_reservation_edit")}
            </MenuItem>
          )}
          {showReservationDelete && (
            <MenuItem icon={LockOpen} onSelect={() => setDialog("reserveDelete")}>
              {t("action_bar_reservation_delete")}
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem icon={Send} onSelect={handleSendTestMessage}>
            {t("action_bar_send_test_notification")}
          </MenuItem>
          <MenuItem icon={Eraser} onSelect={handleClearAll}>
            {t("action_bar_clear_notifications")}
          </MenuItem>
          {subscription.mutedUntil ? (
            <MenuItem icon={Bell} onSelect={() => handleSetMutedUntil(0)}>
              {t("action_bar_unmute_notifications")}
            </MenuItem>
          ) : (
            <MenuItem icon={BellOff} onSelect={() => handleSetMutedUntil(1)}>
              {t("action_bar_mute_notifications")}
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem icon={MinusCircle} danger onSelect={handleUnsubscribe}>
            {t("action_bar_unsubscribe")}
          </MenuItem>
        </MenuContent>
      </Menu>
      {dialog === "displayName" && <DisplayNameDialog subscription={subscription} onClose={closeDialog} />}
      {dialog === "reserveAdd" && <ReserveAddDialog open topic={subscription.topic} reservations={reservations} onClose={closeDialog} />}
      {dialog === "reserveEdit" && <ReserveEditDialog open reservation={subscription.reservation} onClose={closeDialog} />}
      {dialog === "reserveDelete" && <ReserveDeleteDialog open topic={subscription.topic} onClose={closeDialog} />}
    </>
  );
};

const DisplayNameDialog = ({ subscription, onClose }) => {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState(subscription.displayName ?? "");

  const handleSave = async (ev) => {
    ev.preventDefault();
    await subscriptionManager.setDisplayName(subscription.id, displayName);
    if (session.exists() && !subscription.internal) {
      try {
        console.log(`[SubscriptionSettingsDialog] Updating subscription display name to ${displayName}`);
        await accountApi.updateSubscription(subscription.baseUrl, subscription.topic, { display_name: displayName });
      } catch (e) {
        console.log(`[SubscriptionSettingsDialog] Error updating subscription`, e);
        if (e instanceof UnauthorizedError) {
          await session.resetAndRedirect(routes.login);
        } else {
          setError(e.message);
          return;
        }
      }
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={t("display_name_dialog_title")} description={t("display_name_dialog_description")}>
        <form onSubmit={handleSave}>
          <div className="relative">
            <Input
              autoFocus
              maxLength={64}
              aria-label={t("display_name_dialog_placeholder")}
              placeholder={t("display_name_dialog_placeholder")}
              value={displayName}
              onChange={(ev) => setDisplayName(ev.target.value)}
              className="pr-10"
            />
            {displayName && (
              <IconButton
                size="sm"
                label={t("common_clear")}
                tooltip={false}
                onClick={() => setDisplayName("")}
                className="absolute right-1 top-1"
              >
                <X className="size-4" />
              </IconButton>
            )}
          </div>
          <DialogError error={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common_cancel")}
            </Button>
            <Button type="submit">{t("common_save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const LimitReachedChip = () => {
  const { t } = useTranslation();
  return <Chip className="border border-accent/40 bg-transparent text-accent">{t("action_bar_reservation_limit_reached")}</Chip>;
};

/** "Limit reached" marker next to reservation actions; nothing for admins or users with reservations left. */
export const ReserveLimitChip = () => {
  const { account } = useContext(AccountContext);
  if (!account || account.role === Role.ADMIN || account.stats.reservations_remaining > 0) {
    return null;
  }
  return <LimitReachedChip />;
};
