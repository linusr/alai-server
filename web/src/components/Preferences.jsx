import * as React from "react";
import { useContext, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router-dom";
import { BellPlus, Globe, Lock, Pencil, Play, Trash2 } from "lucide-react";
import userManager from "../app/UserManager";
import cn from "./ui/cn";
import { formatDate, formatTime, playSound, shuffle, sounds } from "../app/utils";
import session from "../app/Session";
import routes from "./routes";
import accountApi, { Permission, Role } from "../app/AccountApi";
import AccountContext from "./AccountContext";
import prefs, { THEME, DATE_FORMAT, TIME_FORMAT } from "../app/Prefs";
import { ReserveAddDialog, ReserveDeleteDialog, ReserveEditDialog } from "./ReserveDialogs";
import { UnauthorizedError } from "../app/errors";
import { subscribeTopic } from "./SubscribeDialog";
import notifier from "../app/Notifier";
import { useIsLaunchedPWA, useNotificationPermissionListener } from "./hooks";
import { usePrefCache } from "./PrefCache";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Switch from "./ui/Switch";
import Tooltip from "./ui/Tooltip";
import { Dialog, DialogContent, DialogFooter } from "./ui/Dialog";
import { Field, Input, NativeSelect } from "./ui/Field";
import { Alert, Row, Section } from "./ui/Primitives";

const maybeUpdateAccountSettings = async (payload) => {
  if (!session.exists()) {
    return;
  }
  try {
    await accountApi.updateSettings(payload);
  } catch (e) {
    console.log(`[Preferences] Error updating account settings`, e);
    if (e instanceof UnauthorizedError) {
      await session.resetAndRedirect(routes.login);
    }
  }
};

const selectClass = "sm:w-64";

const Preferences = () => (
  <div className="mx-auto w-full max-w-3xl space-y-8 px-3 py-6 sm:px-6">
    <Notifications />
    <Reservations />
    <Users />
    <Appearance />
  </div>
);

const Notifications = () => {
  const { t } = useTranslation();
  const isLaunchedPWA = useIsLaunchedPWA();
  const pushPossible = useNotificationPermissionListener(() => notifier.pushPossible());

  return (
    <Section title={t("prefs_notifications_title")}>
      <Sound />
      <MinPriority />
      <DeleteAfter />
      {!isLaunchedPWA && pushPossible && <WebPushEnabled />}
    </Section>
  );
};

const Sound = () => {
  const { t } = useTranslation();
  const { sound } = usePrefCache();
  const handleChange = async (ev) => {
    await prefs.setSound(ev.target.value);
    await maybeUpdateAccountSettings({ notification: { sound: ev.target.value } });
  };
  const description =
    sound === "none"
      ? t("prefs_notifications_sound_description_none")
      : t("prefs_notifications_sound_description_some", { sound: sounds[sound]?.label });
  return (
    <Row title={t("prefs_notifications_sound_title")} description={description}>
      <div className="flex w-full items-center gap-1 sm:w-auto">
        <IconButton label={t("prefs_notifications_sound_play")} onClick={() => playSound(sound)} disabled={sound === "none"}>
          <Play className="size-4" />
        </IconButton>
        <NativeSelect
          value={sound}
          onChange={handleChange}
          aria-label={t("prefs_notifications_sound_title")}
          className={cn(selectClass, "flex-1 sm:flex-none")}
        >
          <option value="none">{t("prefs_notifications_sound_no_sound")}</option>
          {Object.entries(sounds).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </div>
    </Row>
  );
};

const MinPriority = () => {
  const { t } = useTranslation();
  const { minPriority } = usePrefCache();
  const handleChange = async (ev) => {
    const value = Number(ev.target.value);
    await prefs.setMinPriority(value);
    await maybeUpdateAccountSettings({ notification: { min_priority: value } });
  };
  const priorities = {
    1: t("priority_min"),
    2: t("priority_low"),
    3: t("priority_default"),
    4: t("priority_high"),
    5: t("priority_max"),
  };
  let description;
  if (minPriority === 1) {
    description = t("prefs_notifications_min_priority_description_any");
  } else if (minPriority === 5) {
    description = t("prefs_notifications_min_priority_description_max");
  } else {
    description = t("prefs_notifications_min_priority_description_x_or_higher", {
      number: minPriority,
      name: priorities[minPriority],
    });
  }
  return (
    <Row title={t("prefs_notifications_min_priority_title")} description={description}>
      <NativeSelect
        value={minPriority}
        onChange={handleChange}
        aria-label={t("prefs_notifications_min_priority_title")}
        className={selectClass}
      >
        <option value={1}>{t("prefs_notifications_min_priority_any")}</option>
        <option value={2}>{t("prefs_notifications_min_priority_low_and_higher")}</option>
        <option value={3}>{t("prefs_notifications_min_priority_default_and_higher")}</option>
        <option value={4}>{t("prefs_notifications_min_priority_high_and_higher")}</option>
        <option value={5}>{t("prefs_notifications_min_priority_max_only")}</option>
      </NativeSelect>
    </Row>
  );
};

const deleteAfterDescriptions = {
  0: "prefs_notifications_delete_after_never_description",
  10800: "prefs_notifications_delete_after_three_hours_description",
  86400: "prefs_notifications_delete_after_one_day_description",
  604800: "prefs_notifications_delete_after_one_week_description",
  2592000: "prefs_notifications_delete_after_one_month_description",
};

const DeleteAfter = () => {
  const { t } = useTranslation();
  const { deleteAfter } = usePrefCache();
  const handleChange = async (ev) => {
    const value = Number(ev.target.value);
    await prefs.setDeleteAfter(value);
    await maybeUpdateAccountSettings({ notification: { delete_after: value } });
  };
  const descriptionKey = deleteAfterDescriptions[deleteAfter];
  return (
    <Row title={t("prefs_notifications_delete_after_title")} description={descriptionKey ? t(descriptionKey) : ""}>
      <NativeSelect
        value={deleteAfter}
        onChange={handleChange}
        aria-label={t("prefs_notifications_delete_after_title")}
        className={selectClass}
      >
        <option value={0}>{t("prefs_notifications_delete_after_never")}</option>
        <option value={10800}>{t("prefs_notifications_delete_after_three_hours")}</option>
        <option value={86400}>{t("prefs_notifications_delete_after_one_day")}</option>
        <option value={604800}>{t("prefs_notifications_delete_after_one_week")}</option>
        <option value={2592000}>{t("prefs_notifications_delete_after_one_month")}</option>
      </NativeSelect>
    </Row>
  );
};

const WebPushEnabled = () => {
  const { t } = useTranslation();
  const { webPushEnabled: enabled } = usePrefCache();
  return (
    <Row
      title={t("prefs_notifications_web_push_title")}
      description={enabled ? t("prefs_notifications_web_push_enabled_description") : t("prefs_notifications_web_push_disabled_description")}
    >
      <Switch
        checked={!!enabled}
        onCheckedChange={(checked) => prefs.setWebPushEnabled(checked)}
        aria-label={t("prefs_notifications_web_push_title")}
      />
    </Row>
  );
};

const Reservations = () => {
  const { t } = useTranslation();
  const { account } = useContext(AccountContext);
  const [dialogKey, setDialogKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!config.enable_reservations || !session.exists() || !account) {
    return null;
  }
  const reservations = account.reservations || [];
  const limitReached = account.role === Role.USER && account.stats.reservations_remaining === 0;

  const handleAddClick = () => {
    setDialogKey((prev) => prev + 1);
    setDialogOpen(true);
  };

  return (
    <Section title={t("prefs_reservations_title")} description={t("prefs_reservations_description")}>
      {reservations.length > 0 && <ReservationList reservations={reservations} />}
      <div className="flex flex-col gap-3 p-4">
        {limitReached && <Alert severity="info">{t("prefs_reservations_limit_reached")}</Alert>}
        <div>
          <Button variant="secondary" size="sm" onClick={handleAddClick} disabled={limitReached}>
            {t("prefs_reservations_add_button")}
          </Button>
        </div>
      </div>
      <ReserveAddDialog
        key={`reservationAddDialog${dialogKey}`}
        open={dialogOpen}
        reservations={reservations}
        onClose={() => setDialogOpen(false)}
      />
    </Section>
  );
};

const permissionStyles = {
  [Permission.READ_WRITE]: { icon: Globe, label: "prefs_reservations_table_everyone_read_write" },
  [Permission.READ_ONLY]: { icon: Globe, badge: "R", label: "prefs_reservations_table_everyone_read_only" },
  [Permission.WRITE_ONLY]: { icon: Globe, badge: "W", label: "prefs_reservations_table_everyone_write_only" },
  [Permission.DENY_ALL]: { icon: Lock, label: "prefs_reservations_table_everyone_deny_all" },
};

const ReservationList = ({ reservations }) => {
  const { t } = useTranslation();
  const [dialogKey, setDialogKey] = useState(0);
  const [dialogReservation, setDialogReservation] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { subscriptions } = useOutletContext();
  const localTopics = new Set((subscriptions ?? []).filter((s) => s.baseUrl === config.base_url).map((s) => s.topic));

  const openDialog = (reservation, setOpen) => {
    setDialogKey((prev) => prev + 1);
    setDialogReservation(reservation);
    setOpen(true);
  };

  return (
    <div role="list" aria-label={t("prefs_reservations_table")} className="divide-y divide-border">
      {reservations.map((reservation) => {
        const permission = permissionStyles[reservation.everyone];
        const Icon = permission?.icon ?? Globe;
        return (
          <div key={reservation.topic} role="listitem" className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{reservation.topic}</p>
              {permission && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  {permission.badge && <span className="font-semibold">{permission.badge}</span>}
                  <span className="truncate">{t(permission.label)}</span>
                </p>
              )}
            </div>
            {!localTopics.has(reservation.topic) && (
              <Tooltip content={t("prefs_reservations_table_click_to_subscribe")}>
                <Button variant="subtle" size="sm" onClick={() => subscribeTopic(config.base_url, reservation.topic, {})}>
                  <BellPlus className="size-3.5" />
                  <span className="hidden sm:inline">{t("prefs_reservations_table_not_subscribed")}</span>
                </Button>
              </Tooltip>
            )}
            <div className="flex shrink-0 items-center">
              <IconButton label={t("prefs_reservations_edit_button")} onClick={() => openDialog(reservation, setEditDialogOpen)}>
                <Pencil className="size-4" />
              </IconButton>
              <IconButton label={t("prefs_reservations_delete_button")} onClick={() => openDialog(reservation, setDeleteDialogOpen)}>
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          </div>
        );
      })}
      <ReserveEditDialog
        key={`reservationEditDialog${dialogKey}`}
        open={editDialogOpen}
        reservation={dialogReservation}
        reservations={reservations}
        onClose={() => setEditDialogOpen(false)}
      />
      <ReserveDeleteDialog
        key={`reservationDeleteDialog${dialogKey}`}
        open={deleteDialogOpen}
        topic={dialogReservation?.topic}
        onClose={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
};

/** Stored credentials for this server's protected topics; only relevant when not signed in. */
const Users = () => {
  const { t } = useTranslation();
  const [dialogKey, setDialogKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const user = useLiveQuery(() => userManager.get(config.base_url));

  if (session.exists()) {
    return null;
  }

  const openDialog = () => {
    setDialogKey((prev) => prev + 1);
    setDialogOpen(true);
  };

  const handleSubmit = async (updated) => {
    setDialogOpen(false);
    try {
      await userManager.save({ ...updated, baseUrl: config.base_url });
    } catch (e) {
      console.log(`[Preferences] Error saving user`, e);
    }
  };

  const handleDelete = async () => {
    try {
      await userManager.delete(config.base_url);
    } catch (e) {
      console.error(`[Preferences] Error deleting user`, e);
    }
  };

  return (
    <Section title={t("prefs_users_title")} description={t("prefs_users_description")}>
      {user ? (
        <div className="flex items-center gap-3 px-4 py-3" aria-label={t("prefs_users_table")}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-semibold uppercase text-muted">
            {user.username?.[0]}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{user.username}</p>
          <IconButton label={t("prefs_users_edit_button")} onClick={openDialog}>
            <Pencil className="size-4" />
          </IconButton>
          <IconButton label={t("prefs_users_delete_button")} onClick={handleDelete}>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      ) : (
        <div className="p-4">
          <Button variant="secondary" size="sm" onClick={openDialog}>
            {t("prefs_users_add_button")}
          </Button>
        </div>
      )}
      <UserDialog
        key={`userDialog${dialogKey}`}
        open={dialogOpen}
        user={user ?? null}
        onCancel={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </Section>
  );
};

const UserDialog = ({ open, user, onCancel, onSubmit }) => {
  const { t } = useTranslation();
  const editMode = user !== null;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const submitEnabled = username.length > 0 && password.length > 0;

  useEffect(() => {
    if (editMode) {
      setUsername(user.username);
      setPassword(user.password);
    }
  }, [editMode, user]);

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (submitEnabled) {
      onSubmit({ username, password });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent title={editMode ? t("prefs_users_dialog_title_edit") : t("prefs_users_dialog_title_add")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label={t("prefs_users_dialog_username_label")} htmlFor="pref-user-username">
            <Input
              id="pref-user-username"
              autoComplete="username"
              value={username}
              onChange={(ev) => setUsername(ev.target.value)}
              autoFocus
            />
          </Field>
          <Field label={t("prefs_users_dialog_password_label")} htmlFor="pref-user-password">
            <Input
              id="pref-user-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </Field>
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("common_cancel")}
            </Button>
            <Button type="submit" disabled={!submitEnabled}>
              {editMode ? t("common_save") : t("common_add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const Appearance = () => {
  const { t } = useTranslation();
  return (
    <Section title={t("prefs_appearance_title")}>
      <Theme />
      <DateFormat />
      <TimeFormat />
      <Language />
    </Section>
  );
};

const usePrefersDark = () => {
  const query = "(prefers-color-scheme: dark)";
  const [dark, setDark] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const listener = (ev) => setDark(ev.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);
  return dark;
};

const Theme = () => {
  const { t } = useTranslation();
  const { theme } = usePrefCache();
  const prefersDark = usePrefersDark();
  return (
    <Row title={t("prefs_appearance_theme_title")}>
      <NativeSelect
        value={theme}
        onChange={(ev) => prefs.setTheme(ev.target.value)}
        aria-label={t("prefs_appearance_theme_title")}
        className={selectClass}
      >
        <option value={THEME.SYSTEM}>
          {t("prefs_system_default")} ({prefersDark ? t("prefs_appearance_theme_dark") : t("prefs_appearance_theme_light")})
        </option>
        <option value={THEME.DARK}>{t("prefs_appearance_theme_dark")}</option>
        <option value={THEME.LIGHT}>{t("prefs_appearance_theme_light")}</option>
      </NativeSelect>
    </Row>
  );
};

// April 26, 14:30 of the current year: the day can't pass for a month, and 14:30 separates 12h from 24h clocks.
const EXAMPLE_TIMESTAMP = Math.round(new Date(new Date().getFullYear(), 3, 26, 14, 30).getTime() / 1000);

const DateFormat = () => {
  const { t } = useTranslation();
  const { dateFormat } = usePrefCache();
  const handleChange = async (ev) => {
    await prefs.setDateFormat(ev.target.value);
    await maybeUpdateAccountSettings({ date_format: ev.target.value });
  };
  const options = [
    [DATE_FORMAT.SYSTEM, "prefs_system_default"],
    [DATE_FORMAT.ISO8601, "prefs_appearance_date_format_iso8601"],
    [DATE_FORMAT.DMY, "prefs_appearance_date_format_dmy"],
    [DATE_FORMAT.DMY_DOT, "prefs_appearance_date_format_dmy_dot"],
    [DATE_FORMAT.MDY, "prefs_appearance_date_format_mdy"],
  ];
  return (
    <Row title={t("prefs_appearance_date_format_title")}>
      <NativeSelect value={dateFormat} onChange={handleChange} aria-label={t("prefs_appearance_date_format_title")} className={selectClass}>
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {t(label)} · {formatDate(EXAMPLE_TIMESTAMP, value)}
          </option>
        ))}
      </NativeSelect>
    </Row>
  );
};

const TimeFormat = () => {
  const { t } = useTranslation();
  const { timeFormat, dateFormat } = usePrefCache();
  // ISO 8601 dates are always 24-hour; the stored pref is kept for when another date format is chosen.
  const fixedTo24h = dateFormat === DATE_FORMAT.ISO8601;
  const handleChange = async (ev) => {
    await prefs.setTimeFormat(ev.target.value);
    await maybeUpdateAccountSettings({ time_format: ev.target.value });
  };
  const options = [
    [TIME_FORMAT.SYSTEM, "prefs_system_default"],
    [TIME_FORMAT.H12, "prefs_appearance_time_format_12h"],
    [TIME_FORMAT.H24, "prefs_appearance_time_format_24h"],
  ];
  return (
    <Row title={t("prefs_appearance_time_format_title")}>
      <NativeSelect
        value={fixedTo24h ? TIME_FORMAT.H24 : timeFormat}
        onChange={handleChange}
        disabled={fixedTo24h}
        aria-label={t("prefs_appearance_time_format_title")}
        className={selectClass}
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {t(label)} · {formatTime(EXAMPLE_TIMESTAMP, value)}
          </option>
        ))}
      </NativeSelect>
    </Row>
  );
};

// Language names from https://www.omniglot.com/language/names.htm; flags are deliberately not paired with languages.
const languages = [
  ["en", "English"],
  ["ar", "العربية"],
  ["id", "Bahasa Indonesia"],
  ["bg", "Български"],
  ["cs", "Čeština"],
  ["zh_Hant", "繁體中文"],
  ["zh_Hans", "简体中文"],
  ["da", "Dansk"],
  ["de", "Deutsch"],
  ["et", "Eesti"],
  ["es", "Español"],
  ["fr", "Français"],
  ["gl", "Galego"],
  ["it", "Italiano"],
  ["hu", "Magyar"],
  ["ko", "한국어"],
  ["ja", "日本語"],
  ["nl", "Nederlands"],
  ["nb_NO", "Norsk bokmål"],
  ["uk", "Українська"],
  ["pt", "Português"],
  ["pt_BR", "Português (Brasil)"],
  ["pl", "Polski"],
  ["ru", "Русский"],
  ["ro", "Română"],
  ["sk", "Slovenčina"],
  ["fi", "Suomi"],
  ["sv", "Svenska"],
  ["tr", "Türkçe"],
  ["ta", "தமிழ்"],
];

const flags = ["🇬🇧", "🇺🇸", "🇪🇸", "🇫🇷", "🇧🇬", "🇨🇿", "🇩🇪", "🇵🇱", "🇺🇦", "🇨🇳", "🇮🇹", "🇭🇺", "🇧🇷", "🇳🇱", "🇮🇩", "🇯🇵", "🇷🇺", "🇹🇷", "🇫🇮"];

const Language = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "en";
  // Windows fonts don't render flag emoji
  const [randomFlags] = useState(() => shuffle([...flags]).slice(0, 3));
  const showFlags = !navigator.userAgent.includes("Windows");
  const title = showFlags ? `${t("prefs_appearance_language_title")} ${randomFlags.join(" ")}` : t("prefs_appearance_language_title");

  const handleChange = async (ev) => {
    await i18n.changeLanguage(ev.target.value);
    await maybeUpdateAccountSettings({ language: ev.target.value });
  };

  return (
    <Row title={title}>
      <NativeSelect value={lang} onChange={handleChange} aria-label={t("prefs_appearance_language_title")} className={selectClass}>
        {languages.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </NativeSelect>
    </Row>
  );
};

export default Preferences;
