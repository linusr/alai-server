import * as React from "react";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import accountApi from "../app/AccountApi";
import AvatarBox, { AuthLink } from "./AvatarBox";
import routes from "./routes";
import Button from "./ui/Button";
import { Field, Input } from "./ui/Field";

// Asks the server to email a reset link for a username or email. The server's response is uniform,
// so the page always shows the same confirmation. The emailed link opens PasswordReset.
const PasswordResetRequest = () => {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSending(true);
      await accountApi.requestPasswordReset(identifier);
    } catch (e) {
      console.log(`[PasswordResetRequest] Request failed`, e);
    } finally {
      setSending(false);
      setSent(true); // Same outcome on success and failure, so accounts cannot be enumerated
    }
  };

  const backToLogin = <AuthLink to={routes.login}>{t("reset_password_back_to_login")}</AuthLink>;

  if (!config.enable_reset_password) {
    return <AvatarBox title={t("reset_password_disabled")} footer={backToLogin} />;
  }

  if (sent) {
    return (
      <AvatarBox title={t("reset_password_sent_title")} icon={CheckCircle2} iconClassName="text-success" footer={backToLogin}>
        <p className="text-center text-sm text-muted">{t("reset_password_sent_description")}</p>
      </AvatarBox>
    );
  }

  return (
    <AvatarBox title={t("reset_password_request_title")} footer={config.enable_login && backToLogin}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="space-y-1.5 text-sm">
          <p className="text-muted">{t("reset_password_request_description")}</p>
          <p className="font-medium">{t("reset_password_request_primary_required")}</p>
        </div>
        <Field label={t("reset_password_request_identifier_label")} htmlFor="identifier">
          <Input
            id="identifier"
            name="identifier"
            required
            autoFocus
            value={identifier}
            onChange={(ev) => setIdentifier(ev.target.value.trim())}
          />
        </Field>
        <Button type="submit" size="lg" disabled={sending || identifier === ""}>
          {t("reset_password_request_button_submit")}
        </Button>
      </form>
    </AvatarBox>
  );
};

export default PasswordResetRequest;
