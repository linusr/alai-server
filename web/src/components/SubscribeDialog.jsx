import * as React from "react";
import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, Plus, Shuffle } from "lucide-react";
import api from "../app/Api";
import { randomAlphanumericString, shortUrl, topicUrl, validTopic } from "../app/utils";
import userManager from "../app/UserManager";
import subscriptionManager from "../app/SubscriptionManager";
import poller from "../app/Poller";
import session from "../app/Session";
import routes from "./routes";
import accountApi, { Permission, Role } from "../app/AccountApi";
import ReserveTopicSelect from "./ReserveTopicSelect";
import AccountContext from "./AccountContext";
import { TopicReservedError, UnauthorizedError } from "../app/errors";
import { ReserveLimitChip } from "./SubscriptionPopup";
import { DialogError } from "./ReserveDialogs";
import { Dialog, DialogContent, DialogFooter } from "./ui/Dialog";
import { Field, Input } from "./ui/Field";
import Button from "./ui/Button";
import Switch from "./ui/Switch";
import TopicAvatar from "./ui/TopicAvatar";

export const subscribeTopic = async (baseUrl, topic, opts) => {
  const subscription = await subscriptionManager.upsert(baseUrl, topic, opts);
  if (session.exists()) {
    try {
      await accountApi.addSubscription(baseUrl, topic);
    } catch (e) {
      console.log(`[SubscribeDialog] Subscribing to topic ${topic} failed`, e);
      if (e instanceof UnauthorizedError) {
        await session.resetAndRedirect(routes.login);
      }
    }
  }
  return subscription;
};

/** Subscribes to a topic on this server, asking for credentials when the topic requires them. */
const SubscribeDialog = (props) => {
  const { t } = useTranslation();
  const [topic, setTopic] = useState("");
  const [showLoginPage, setShowLoginPage] = useState(false);

  const handleSuccess = async (name = topic) => {
    console.log(`[SubscribeDialog] Subscribing to topic ${name}`);
    const subscription = await subscribeTopic(config.base_url, name, {});
    poller.pollInBackground(subscription); // Dangle!
    props.onSuccess(subscription);
  };

  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onCancel()}>
      <DialogContent
        title={showLoginPage ? t("subscribe_dialog_login_title") : t("subscribe_dialog_subscribe_title")}
        description={showLoginPage ? t("subscribe_dialog_login_description") : t("subscribe_dialog_subscribe_description")}
      >
        {showLoginPage ? (
          <LoginPage topic={topic} onBack={() => setShowLoginPage(false)} onSuccess={() => handleSuccess()} />
        ) : (
          <SubscribePage
            topic={topic}
            setTopic={setTopic}
            subscriptions={props.subscriptions}
            onCancel={props.onCancel}
            onNeedsLogin={() => setShowLoginPage(true)}
            onSuccess={handleSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

const SubscribePage = (props) => {
  const { t } = useTranslation();
  const { account } = useContext(AccountContext);
  const [error, setError] = useState("");
  const [reserveTopicVisible, setReserveTopicVisible] = useState(false);
  const [everyone, setEveryone] = useState(Permission.DENY_ALL);
  const baseUrl = config.base_url;
  const { topic } = props;
  const existingTopicUrls = props.subscriptions.map((s) => topicUrl(s.baseUrl, s.topic));
  const showReserveTopicCheckbox = config.enable_reservations && !!account;
  const reserveTopicEnabled =
    session.exists() && (account?.role === Role.ADMIN || (account?.role === Role.USER && (account?.stats.reservations_remaining || 0) > 0));
  const subscribeButtonEnabled = validTopic(topic) && !existingTopicUrls.includes(topicUrl(baseUrl, topic));

  const subscribe = async (name) => {
    const user = await userManager.get(baseUrl); // May be undefined
    const username = user ? user.username : t("subscribe_dialog_error_user_anonymous");

    const success = await api.topicAuth(baseUrl, name, user);
    if (!success) {
      console.log(`[SubscribeDialog] Login to ${topicUrl(baseUrl, name)} failed for user ${username}`);
      if (user) {
        setError(t("subscribe_dialog_error_user_not_authorized", { username }));
        return;
      }
      props.onNeedsLogin();
      return;
    }

    if (session.exists() && reserveTopicVisible) {
      console.log(`[SubscribeDialog] Reserving topic ${name} with everyone access ${everyone}`);
      try {
        await accountApi.upsertReservation(name, everyone);
      } catch (e) {
        console.log(`[SubscribeDialog] Error reserving topic`, e);
        if (e instanceof UnauthorizedError) {
          await session.resetAndRedirect(routes.login);
        } else if (e instanceof TopicReservedError) {
          setError(t("subscribe_dialog_error_topic_already_reserved"));
          return;
        }
      }
    }

    console.log(`[SubscribeDialog] Successful login to ${topicUrl(baseUrl, name)} for user ${username}`);
    props.onSuccess(name);
  };

  const handleSubscribe = async (ev) => {
    ev.preventDefault();
    if (subscribeButtonEnabled) {
      await subscribe(topic);
    }
  };

  const handlePick = async (name) => {
    props.setTopic(name);
    await subscribe(name);
  };

  return (
    <form onSubmit={handleSubscribe} className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="flex h-10 min-w-0 flex-1 items-center overflow-hidden rounded-xl border border-border-strong bg-surface-2 transition-colors focus-within:border-accent focus-within:ring-3 focus-within:ring-accent-soft">
          <span className="max-w-[45%] shrink-0 truncate pl-3 text-sm text-muted">{shortUrl(baseUrl)}/</span>
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            maxLength={64}
            aria-label={t("subscribe_dialog_subscribe_topic_placeholder")}
            placeholder={t("subscribe_dialog_subscribe_topic_placeholder")}
            value={topic}
            onChange={(ev) => props.setTopic(ev.target.value)}
            className="h-full min-w-0 flex-1 bg-surface pl-1 pr-3 text-sm placeholder:text-muted/70 focus:outline-none"
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => props.setTopic(randomAlphanumericString(16))} className="shrink-0">
          <Shuffle className="size-4" aria-hidden />
          <span className="max-sm:sr-only">{t("subscribe_dialog_subscribe_button_generate_topic_name")}</span>
        </Button>
      </div>

      <TopicSuggestions account={account} filter={topic} subscribedTopics={existingTopicUrls} onPick={handlePick} />

      {showReserveTopicCheckbox && (
        <div className="flex flex-col gap-3">
          <label htmlFor="subscribe-reserve" className="flex items-center gap-3 text-sm">
            <Switch
              id="subscribe-reserve"
              disabled={!reserveTopicEnabled}
              checked={reserveTopicVisible}
              onCheckedChange={setReserveTopicVisible}
            />
            <span className={reserveTopicEnabled ? undefined : "text-muted"}>{t("reserve_dialog_checkbox_label")}</span>
            <ReserveLimitChip />
          </label>
          {reserveTopicVisible && <ReserveTopicSelect value={everyone} onChange={setEveryone} />}
        </div>
      )}

      <DialogError error={error} />
      <DialogFooter className="mt-2">
        <Button type="button" variant="ghost" onClick={props.onCancel}>
          {t("subscribe_dialog_subscribe_button_cancel")}
        </Button>
        <Button type="submit" disabled={!subscribeButtonEnabled}>
          {t("subscribe_dialog_subscribe_button_subscribe")}
        </Button>
      </DialogFooter>
    </form>
  );
};

const permissionLabels = {
  "read-only": "subscribe_dialog_permission_read_only",
  "write-only": "subscribe_dialog_permission_write_only",
  "read-write": "subscribe_dialog_permission_read_write",
};

/** Topics the account already knows about, grouped by where they come from; a topic appears in its first group only. */
const TopicSuggestions = ({ account, filter, subscribedTopics, onPick }) => {
  const { t } = useTranslation();
  const [activeTopics, setActiveTopics] = useState([]);
  const isAdmin = account?.role === Role.ADMIN;

  useEffect(() => {
    if (isAdmin) {
      accountApi.activeTopics().then(setActiveTopics);
    }
  }, [isAdmin]);

  const groups = useMemo(() => {
    const seen = new Set(subscribedTopics);
    const query = filter.trim().toLowerCase();
    const take = (items) =>
      items.filter((item) => {
        const url = topicUrl(config.base_url, item.topic);
        if (seen.has(url) || item.topic === account?.sync_topic || item.topic.includes("*")) {
          return false;
        }
        seen.add(url);
        return !query || item.topic.toLowerCase().includes(query);
      });
    return [
      {
        title: t("subscribe_dialog_topics_reserved"),
        items: take((account?.reservations ?? []).map((r) => ({ topic: r.topic, reserved: true }))),
      },
      {
        title: t("subscribe_dialog_topics_access"),
        items: take((account?.access ?? []).map((g) => ({ topic: g.topic, detail: t(permissionLabels[g.permission] ?? g.permission) }))),
      },
      {
        title: t("subscribe_dialog_topics_synced"),
        items: take(
          (account?.subscriptions ?? [])
            .filter((sub) => sub.base_url === config.base_url)
            .map((sub) => ({ topic: sub.topic, detail: sub.display_name })),
        ),
      },
      { title: t("subscribe_dialog_topics_active"), items: take(activeTopics.map((name) => ({ topic: name }))) },
    ].filter((group) => group.items.length > 0);
  }, [account, activeTopics, filter, subscribedTopics]);

  if (groups.length === 0) {
    return null;
  }
  return (
    <div className="-mx-2 max-h-72 overflow-y-auto">
      {groups.map((group) => (
        <div key={group.title} className="mb-2 last:mb-0">
          <p className="px-2 pb-1 pt-1 text-xs font-medium text-muted">{group.title}</p>
          {group.items.map((item) => (
            <button
              key={item.topic}
              type="button"
              onClick={() => onPick(item.topic)}
              className="group flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              <TopicAvatar name={item.topic} size={28} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.topic}</span>
                {item.detail && <span className="block truncate text-xs text-muted">{item.detail}</span>}
              </span>
              {item.reserved && <Lock className="size-3.5 shrink-0 text-muted" aria-hidden />}
              <Plus
                className="size-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                aria-hidden
              />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

const LoginPage = (props) => {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const baseUrl = config.base_url;
  const { topic } = props;

  const handleLogin = async (ev) => {
    ev.preventDefault();
    const user = { baseUrl, username, password };
    const success = await api.topicAuth(baseUrl, topic, user);
    if (!success) {
      console.log(`[SubscribeDialog] Login to ${topicUrl(baseUrl, topic)} failed for user ${username}`);
      setError(t("subscribe_dialog_error_user_not_authorized", { username }));
      return;
    }
    console.log(`[SubscribeDialog] Successful login to ${topicUrl(baseUrl, topic)} for user ${username}`);
    await userManager.save(user);
    props.onSuccess();
  };

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4">
      <Field label={t("subscribe_dialog_login_username_label")} htmlFor="subscribe-username">
        <Input id="subscribe-username" autoComplete="username" autoFocus value={username} onChange={(ev) => setUsername(ev.target.value)} />
      </Field>
      <Field label={t("subscribe_dialog_login_password_label")} htmlFor="subscribe-password">
        <Input
          id="subscribe-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
        />
      </Field>
      <DialogError error={error} />
      <DialogFooter className="mt-2">
        <Button type="button" variant="ghost" onClick={props.onBack}>
          {t("common_back")}
        </Button>
        <Button type="submit">{t("subscribe_dialog_login_button_login")}</Button>
      </DialogFooter>
    </form>
  );
};

export default SubscribeDialog;
