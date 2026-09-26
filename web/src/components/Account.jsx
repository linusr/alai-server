import * as React from "react";
import { useContext, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Copy, Globe, Info, Pencil, Plus, RefreshCw, Star, Trash2, X } from "lucide-react";
import routes from "./routes";
import { copyToClipboard, formatBytes, formatDateTime, formatShortDuration, openUrl } from "../app/utils";
import accountApi, { LimitBasis, Role } from "../app/AccountApi";
import db from "../app/db";
import AccountContext from "./AccountContext";
import { usePrefCache } from "./PrefCache";
import { EmailPrimaryElsewhereError, IncorrectPasswordError, UnauthorizedError } from "../app/errors";
import session from "../app/Session";
import Button from "./ui/Button";
import IconButton from "./ui/IconButton";
import Tooltip from "./ui/Tooltip";
import { Dialog, DialogContent, DialogFooter } from "./ui/Dialog";
import { Field, Input, NativeSelect } from "./ui/Field";
import PasswordInput from "./ui/PasswordInput";
import { Alert, Chip, Row, Section } from "./ui/Primitives";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "./ui/Menu";
import { useToast } from "./ui/Toast";
import cn from "./ui/cn";

const Account = () => {
  if (!session.exists()) {
    window.location.href = routes.app;
    return null;
  }
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-3 py-6 sm:px-6">
      <Basics />
      <Stats />
      <Tokens />
      <Delete />
    </div>
  );
};

/** Handles errors from account API calls: redirects to login on 401, otherwise reports the message. */
const accountErrorHandler = (onError) => async (e) => {
  if (e instanceof UnauthorizedError) {
    await session.resetAndRedirect(routes.login);
  } else {
    onError(e);
  }
};

const Basics = () => {
  const { t } = useTranslation();
  return (
    <Section title={t("account_basics_title")}>
      <Username />
      <ChangePassword />
      <Emails />
      <AccountType />
    </Section>
  );
};

const Username = () => {
  const { t } = useTranslation();
  const { account } = useContext(AccountContext);
  return (
    <Row title={t("account_basics_username_title")} description={t("account_basics_username_description")}>
      <span className="text-sm font-medium">
        {session.username()}
        {account?.role === Role.ADMIN && (
          <Tooltip content={t("account_basics_username_admin_tooltip")}>
            <span className="ml-1.5 cursor-default">👑</span>
          </Tooltip>
        )}
      </span>
    </Row>
  );
};

const ProvisionedTooltip = ({ children }) => {
  const { t } = useTranslation();
  return (
    <Tooltip content={t("account_basics_cannot_edit_or_delete_provisioned_user")}>
      <span className="inline-flex">{children}</span>
    </Tooltip>
  );
};

const ChangePassword = () => {
  const { t } = useTranslation();
  const [dialogKey, setDialogKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { account } = useContext(AccountContext);

  const handleDialogOpen = () => {
    setDialogKey((prev) => prev + 1);
    setDialogOpen(true);
  };

  const button = (
    <Button variant="secondary" size="sm" onClick={handleDialogOpen} disabled={account?.provisioned}>
      <Pencil className="size-3.5" />
      {t("account_basics_password_dialog_title")}
    </Button>
  );

  return (
    <Row title={t("account_basics_password_title")} description={t("account_basics_password_description")}>
      {account?.provisioned ? <ProvisionedTooltip>{button}</ProvisionedTooltip> : button}
      <ChangePasswordDialog key={`changePasswordDialog${dialogKey}`} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Row>
  );
};

const ChangePasswordDialog = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const handleError = accountErrorHandler((e) =>
    setError(e instanceof IncorrectPasswordError ? t("account_basics_password_dialog_current_password_incorrect") : e.message),
  );
  const valid = newPassword.length > 0 && currentPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!valid) {
      return;
    }
    try {
      await accountApi.changePassword(currentPassword, newPassword);
      onClose();
    } catch (e) {
      console.log(`[Account] Error changing password`, e);
      await handleError(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent title={t("account_basics_password_dialog_title")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label={t("account_basics_password_dialog_current_password_label")} htmlFor="current-password">
            <PasswordInput
              id="current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(ev) => setCurrentPassword(ev.target.value)}
            />
          </Field>
          <Field label={t("account_basics_password_dialog_new_password_label")} htmlFor="new-password">
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(ev) => setNewPassword(ev.target.value)}
            />
          </Field>
          <Field label={t("account_basics_password_dialog_confirm_password_label")} htmlFor="confirm-password">
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(ev) => setConfirmPassword(ev.target.value)}
            />
          </Field>
          {error && <Alert severity="error">{error}</Alert>}
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("common_cancel")}
            </Button>
            <Button type="submit" disabled={!valid}>
              {t("account_basics_password_dialog_button_submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AccountType = () => {
  const { t } = useTranslation();
  const { account } = useContext(AccountContext);
  if (!account) {
    return null;
  }

  let accountType;
  let qualifier;
  if (account.role === Role.ADMIN) {
    accountType = t("account_basics_tier_admin");
    qualifier = account.tier
      ? t("account_basics_tier_admin_suffix_with_tier", { tier: account.tier.name })
      : t("account_basics_tier_admin_suffix_no_tier");
  } else {
    accountType = account.tier ? account.tier.name : t("account_basics_tier_basic");
  }

  return (
    <Row title={t("account_basics_tier_title")} description={t("account_basics_tier_description")}>
      <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
        {accountType}
        {qualifier && <Chip>{qualifier}</Chip>}
        {account.provisioned && <Chip>{t("account_basics_tier_provisioned")}</Chip>}
      </div>
    </Row>
  );
};

const Emails = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { account } = useContext(AccountContext);
  const [dialogKey, setDialogKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!config.enable_emails) {
    return null;
  }

  if (account?.limits.emails === 0) {
    return (
      <Row title={t("account_basics_emails_title")} description={t("account_basics_emails_description")}>
        <span className="text-sm italic text-muted">{t("account_usage_emails_none")}</span>
      </Row>
    );
  }

  // The account view refreshes via the server's sync event, so actions need no explicit refetch.
  const runEmailAction = async (fn) => {
    try {
      await fn();
    } catch (e) {
      console.log(`[Account] Email action failed`, e);
      if (e instanceof UnauthorizedError) {
        await session.resetAndRedirect(routes.login);
      } else if (e instanceof EmailPrimaryElsewhereError) {
        toast(t("account_basics_emails_primary_elsewhere"));
      } else {
        toast(e.message);
      }
    }
  };

  const handleCopy = (email) => {
    copyToClipboard(email);
    toast(t("account_basics_emails_copied_to_clipboard"));
  };
  const handleDelete = (email) => runEmailAction(() => accountApi.deleteEmail(email));
  const handleSetPrimary = (email) => runEmailAction(() => accountApi.setPrimaryEmail(email));
  const handleResend = (email) =>
    runEmailAction(async () => {
      await accountApi.resendEmailVerification(email);
      toast(t("account_basics_emails_resent"));
    });

  const emails = account?.emails ?? [];
  const verifiedEmails = emails.filter((e) => !e.pending).sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0));
  const pendingEmails = emails.filter((e) => e.pending);
  const hasNoEmails = verifiedEmails.length === 0 && pendingEmails.length === 0;
  // Provisioned users cannot reset passwords, so recovery nudges would only confuse them
  const recoveryRelevant = config.enable_reset_password && !account?.provisioned;
  const showNoEmailWarning = recoveryRelevant && hasNoEmails;
  const showNoPrimaryWarning = recoveryRelevant && !hasNoEmails && !verifiedEmails.some((e) => e.primary);

  return (
    <div className="p-4">
      <p className="text-sm font-medium">{t("account_basics_emails_title")}</p>
      <p className="mt-0.5 text-sm text-muted">{t("account_basics_emails_description")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {[...verifiedEmails, ...pendingEmails].map((email) => (
          <EmailChip
            key={email.address}
            email={email}
            onCopy={handleCopy}
            onSetPrimary={handleSetPrimary}
            onResend={handleResend}
            onDelete={handleDelete}
          />
        ))}
        {hasNoEmails && <span className="text-sm italic text-muted">{t("account_basics_emails_no_emails_yet")}</span>}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDialogKey((prev) => prev + 1);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          {t("account_basics_emails_dialog_title")}
        </Button>
      </div>
      {showNoEmailWarning && (
        <Alert severity="warning" className="mt-3">
          {t("account_basics_emails_no_recovery_warning")}
        </Alert>
      )}
      {showNoPrimaryWarning && (
        <Alert severity="warning" className="mt-3">
          {t("account_basics_emails_no_primary_warning")}
        </Alert>
      )}
      <AddEmailDialog key={`addEmailDialog${dialogKey}`} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
};

const EmailChip = ({ email, onCopy, onSetPrimary, onResend, onDelete }) => {
  const { t } = useTranslation();
  const hint = email.pending
    ? t("account_basics_emails_chip_actions_unverified")
    : t(email.primary ? "account_basics_emails_chip_actions_primary" : "account_basics_emails_chip_actions_verified");
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          title={hint}
          className={cn(
            "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-border-strong px-3 text-sm transition-colors hover:bg-surface-2",
            email.pending && "border-dashed text-muted",
          )}
        >
          {email.primary && <Star className="size-3.5 fill-warning text-warning" aria-hidden />}
          <span className="truncate">{email.address}</span>
          {email.pending && <span className="text-xs italic">({t("account_basics_emails_unverified")})</span>}
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        <MenuItem icon={Copy} onSelect={() => onCopy(email.address)}>
          {t("common_copy_to_clipboard")}
        </MenuItem>
        {!email.pending && !email.primary && (
          <MenuItem icon={Star} onSelect={() => onSetPrimary(email.address)}>
            {t("account_basics_emails_set_primary")}
          </MenuItem>
        )}
        {email.pending && (
          <MenuItem icon={RefreshCw} onSelect={() => onResend(email.address)}>
            {t("account_basics_emails_resend")}
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem icon={Trash2} danger onSelect={() => onDelete(email.address)}>
          {t("account_basics_emails_delete")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
};

const AddEmailDialog = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const handleError = accountErrorHandler((e) => setError(e.message));
  const valid = /^[^\s,;]+@[^\s,;]+$/.test(email);

  // The server emails a magic link; the address shows as unverified once the account refreshes.
  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!valid || sending) {
      return;
    }
    try {
      setSending(true);
      setError("");
      await accountApi.startEmailVerification(email);
      setSent(true);
    } catch (e) {
      console.log(`[Account] Error starting email verification`, e);
      await handleError(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        title={t("account_basics_emails_dialog_title")}
        description={sent ? t("account_basics_emails_dialog_check_inbox") : t("account_basics_emails_dialog_description")}
      >
        {sent ? (
          <DialogFooter className="mt-0">
            <Button onClick={onClose}>{t("common_close")}</Button>
          </DialogFooter>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label={t("account_basics_emails_dialog_email_label")} htmlFor="add-email">
              <Input
                id="add-email"
                type="email"
                autoFocus
                placeholder={t("account_basics_emails_dialog_email_placeholder")}
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
              />
            </Field>
            {error && <Alert severity="error">{error}</Alert>}
            <DialogFooter className="mt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {t("common_cancel")}
              </Button>
              <Button type="submit" disabled={sending || !valid}>
                {t("account_basics_emails_dialog_verify_button")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

const InfoHint = ({ content }) => (
  <Tooltip content={content}>
    <span className="ml-1 inline-flex cursor-default align-middle text-muted">
      <Info className="size-3.5" aria-label={content} />
    </span>
  </Tooltip>
);

/** One usage line: current value, limit (or "unlimited" for admins), and a progress bar. */
const Usage = ({ title, hint, description, value, limit, percent }) => (
  <div className="p-4">
    <div className="flex items-baseline justify-between gap-4">
      <p className="text-sm font-medium">
        {title}
        {hint && <InfoHint content={hint} />}
      </p>
      <p className="shrink-0 text-sm tabular-nums text-muted">
        <span className="font-medium text-text">{value}</span> {limit}
      </p>
    </div>
    {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
    <div
      className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
      role="progressbar"
      aria-label={title}
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full", percent >= 90 ? "bg-danger" : "bg-accent")} style={{ width: `${percent}%` }} />
    </div>
  </div>
);

const Stats = () => {
  const { t, i18n } = useTranslation();
  const { account } = useContext(AccountContext);
  if (!account) {
    return null;
  }

  const isUser = account.role === Role.USER;
  const percent = (value, max) => {
    if (!isUser) return 0;
    return max > 0 ? Math.min((value / max) * 100, 100) : 100;
  };
  const limitLabel = (limit) => (isUser ? t("account_usage_of_limit", { limit }) : t("account_usage_unlimited"));
  const resetsDaily = t("account_usage_limits_reset_daily");

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t("account_usage_title")}</h2>
      <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {(account.role === Role.ADMIN || account.limits.reservations > 0) && (
          <Usage
            title={t("account_usage_reservations_title")}
            value={account.stats.reservations.toLocaleString()}
            limit={limitLabel(account.limits.reservations.toLocaleString())}
            percent={percent(account.stats.reservations, account.limits.reservations)}
          />
        )}
        <Usage
          title={t("account_usage_messages_title")}
          hint={resetsDaily}
          value={account.stats.messages.toLocaleString()}
          limit={limitLabel(account.limits.messages.toLocaleString())}
          percent={percent(account.stats.messages, account.limits.messages)}
        />
        {config.enable_emails && (
          <Usage
            title={t("account_usage_emails_title")}
            hint={resetsDaily}
            value={account.stats.emails.toLocaleString()}
            limit={limitLabel(account.limits.emails.toLocaleString())}
            percent={percent(account.stats.emails, account.limits.emails)}
          />
        )}
        <Usage
          title={t("account_usage_attachment_storage_title")}
          description={t("account_usage_attachment_storage_description", {
            filesize: formatBytes(account.limits.attachment_file_size),
            expiry: formatShortDuration(account.limits.attachment_expiry_duration * 1000, i18n.resolvedLanguage),
          })}
          value={formatBytes(account.stats.attachment_total_size)}
          limit={limitLabel(formatBytes(account.limits.attachment_total_size))}
          percent={percent(account.stats.attachment_total_size, account.limits.attachment_total_size)}
        />
        {config.enable_reservations && isUser && account.limits.reservations === 0 && (
          <Row title={t("account_usage_reservations_title")}>
            <span className="text-sm italic text-muted">{t("account_usage_reservations_none")}</span>
          </Row>
        )}
      </div>
      {isUser && account.limits.basis === LimitBasis.IP && <p className="text-sm text-muted">{t("account_usage_basis_ip_description")}</p>}
    </section>
  );
};

const DocsLink = ({ children }) => (
  <a href="/docs/publish/#access-tokens" className="font-medium text-accent hover:underline">
    {children}
  </a>
);

const Tokens = () => {
  const { t } = useTranslation();
  const { account } = useContext(AccountContext);
  const [dialogKey, setDialogKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const tokens = account?.tokens || [];

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{t("account_tokens_title")}</h2>
          <p className="mt-0.5 text-sm text-muted">
            <Trans i18nKey="account_tokens_description" components={{ Link: <DocsLink /> }} />
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => {
            setDialogKey((prev) => prev + 1);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" />
          {t("account_tokens_table_create_token_button")}
        </Button>
      </div>
      {tokens.length > 0 && <TokensList tokens={tokens} />}
      <TokenDialog key={`tokenDialogCreate${dialogKey}`} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </section>
  );
};

const TokensList = ({ tokens: unsorted }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { dateFormat, timeFormat } = usePrefCache();
  const [upsertDialogKey, setUpsertDialogKey] = useState(0);
  const [upsertDialogOpen, setUpsertDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);

  const current = session.token();
  const tokens = [...unsorted].sort((a, b) => {
    if (a.token === current) return -1;
    if (b.token === current) return 1;
    return a.token.localeCompare(b.token);
  });

  const handleEditClick = (token) => {
    setUpsertDialogKey((prev) => prev + 1);
    setSelectedToken(token);
    setUpsertDialogOpen(true);
  };

  const handleDialogClose = () => {
    setUpsertDialogOpen(false);
    setDeleteDialogOpen(false);
    setSelectedToken(null);
  };

  const handleCopy = (token) => {
    copyToClipboard(token);
    toast(t("account_tokens_table_copied_to_clipboard"));
  };

  return (
    <>
      <ul aria-label={t("account_tokens_title")} className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {tokens.map((token) => {
          const isCurrent = token.token === current;
          const locked = isCurrent || token.provisioned;
          const hasLastAccess = Number.isFinite(token.last_access) && token.last_access > 0;
          const lockedReason = isCurrent
            ? t("account_tokens_table_cannot_delete_or_edit")
            : t("account_tokens_table_cannot_delete_or_edit_provisioned_token");
          return (
            <li key={token.token} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">
                    {isCurrent ? <em>{t("account_tokens_table_current_session")}</em> : token.label || "-"}
                  </p>
                  {token.provisioned && <Chip>{t("account_basics_tier_provisioned")}</Chip>}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <code className="font-mono text-xs text-muted">{token.token.slice(0, 12)}…</code>
                  <IconButton size="sm" label={t("common_copy_to_clipboard")} onClick={() => handleCopy(token.token)} className="size-6">
                    <Copy className="size-3.5" />
                  </IconButton>
                </div>
                <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-2">
                  <div className="flex gap-1">
                    <dt>{t("account_tokens_table_expires_header")}:</dt>
                    <dd className="text-text">
                      {token.expires ? formatDateTime(token.expires, dateFormat, timeFormat) : t("account_tokens_table_never_expires")}
                    </dd>
                  </div>
                  <div className="flex items-center gap-1">
                    <dt>{t("account_tokens_table_last_access_header")}:</dt>
                    <dd className="flex items-center gap-1 text-text">
                      {hasLastAccess ? formatDateTime(token.last_access, dateFormat, timeFormat) : "-"}
                      {token.last_origin && (
                        <IconButton
                          size="sm"
                          className="size-5"
                          label={t("account_tokens_table_last_origin_tooltip", { ip: token.last_origin })}
                          onClick={() => openUrl(`https://whatismyipaddress.com/ip/${token.last_origin}`)}
                        >
                          <Globe className="size-3.5" />
                        </IconButton>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="flex shrink-0 gap-1">
                {locked ? (
                  <Tooltip content={lockedReason}>
                    <span className="inline-flex gap-1">
                      <IconButton label={t("account_tokens_dialog_title_edit")} tooltip={false} disabled>
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton label={t("account_tokens_dialog_title_delete")} tooltip={false} disabled>
                        <X className="size-4" />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : (
                  <>
                    <IconButton label={t("account_tokens_dialog_title_edit")} onClick={() => handleEditClick(token)}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton
                      label={t("account_tokens_dialog_title_delete")}
                      className="hover:text-danger"
                      onClick={() => {
                        setSelectedToken(token);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <TokenDialog key={`tokenDialogEdit${upsertDialogKey}`} open={upsertDialogOpen} token={selectedToken} onClose={handleDialogClose} />
      <TokenDeleteDialog open={deleteDialogOpen} token={selectedToken} onClose={handleDialogClose} />
    </>
  );
};

const TokenDialog = ({ open, token, onClose }) => {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [label, setLabel] = useState(token?.label || "");
  const [expires, setExpires] = useState(token ? -1 : 0);
  const editMode = !!token;
  const handleError = accountErrorHandler((e) => setError(e.message));

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    try {
      if (editMode) {
        await accountApi.updateToken(token.token, label, expires);
      } else {
        await accountApi.createToken(label, expires);
      }
      onClose();
    } catch (e) {
      console.log(`[Account] Error saving token`, e);
      await handleError(e);
    }
  };

  const days = [3, 7, 30, 90, 180];
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent title={editMode ? t("account_tokens_dialog_title_edit") : t("account_tokens_dialog_title_create")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label={t("account_tokens_dialog_label")} htmlFor="token-label">
            <Input id="token-label" value={label} onChange={(ev) => setLabel(ev.target.value)} />
          </Field>
          <Field label={t("account_tokens_dialog_expires_label")} htmlFor="token-expires">
            <NativeSelect id="token-expires" value={expires} onChange={(ev) => setExpires(Number(ev.target.value))}>
              {editMode && <option value={-1}>{t("account_tokens_dialog_expires_unchanged")}</option>}
              <option value={0}>{t("account_tokens_dialog_expires_never")}</option>
              <option value={21600}>{t("account_tokens_dialog_expires_x_hours", { hours: 6 })}</option>
              <option value={43200}>{t("account_tokens_dialog_expires_x_hours", { hours: 12 })}</option>
              {days.map((d) => (
                <option key={d} value={d * 86400}>
                  {t("account_tokens_dialog_expires_x_days", { days: d })}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {error && <Alert severity="error">{error}</Alert>}
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("account_tokens_dialog_button_cancel")}
            </Button>
            <Button type="submit">{editMode ? t("account_tokens_dialog_button_update") : t("account_tokens_dialog_button_create")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const TokenDeleteDialog = ({ open, token, onClose }) => {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const handleError = accountErrorHandler((e) => setError(e.message));

  const handleSubmit = async () => {
    try {
      await accountApi.deleteToken(token.token);
      onClose();
    } catch (e) {
      console.log(`[Account] Error deleting token`, e);
      await handleError(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        title={t("account_tokens_delete_dialog_title")}
        description={<Trans i18nKey="account_tokens_delete_dialog_description" />}
      >
        {error && <Alert severity="error">{error}</Alert>}
        <DialogFooter className={error ? "mt-4" : "mt-0"}>
          <Button variant="ghost" onClick={onClose}>
            {t("common_cancel")}
          </Button>
          <Button variant="danger" onClick={handleSubmit}>
            {t("account_tokens_delete_dialog_submit_button")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Delete = () => {
  const { t } = useTranslation();
  const [dialogKey, setDialogKey] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { account } = useContext(AccountContext);

  const button = (
    <Button
      variant="secondary"
      className="text-danger hover:bg-danger/10"
      disabled={account?.provisioned}
      onClick={() => {
        setDialogKey((prev) => prev + 1);
        setDialogOpen(true);
      }}
    >
      <Trash2 className="size-4" />
      {t("account_delete_title")}
    </Button>
  );

  return (
    <Section title={t("account_delete_title")}>
      <Row title={t("account_delete_title")} description={t("account_delete_description")}>
        {account?.provisioned ? <ProvisionedTooltip>{button}</ProvisionedTooltip> : button}
        <DeleteAccountDialog key={`deleteAccountDialog${dialogKey}`} open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </Row>
    </Section>
  );
};

const DeleteAccountDialog = ({ open, onClose }) => {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const handleError = accountErrorHandler((e) =>
    setError(e instanceof IncorrectPasswordError ? t("account_basics_password_dialog_current_password_incorrect") : e.message),
  );

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (password.length === 0) {
      return;
    }
    try {
      await accountApi.delete(password);
      await db().delete();
      console.debug(`[Account] Account deleted`);
      await session.resetAndRedirect(routes.app, { fade: true });
    } catch (e) {
      console.log(`[Account] Error deleting account`, e);
      await handleError(e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent title={t("account_delete_title")} description={t("account_delete_dialog_description")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label={t("account_delete_dialog_label")} htmlFor="account-delete-confirm">
            <PasswordInput
              id="account-delete-confirm"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </Field>
          {error && <Alert severity="error">{error}</Alert>}
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("account_delete_dialog_button_cancel")}
            </Button>
            <Button type="submit" variant="danger" disabled={password.length === 0}>
              {t("account_delete_dialog_button_submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Account;
