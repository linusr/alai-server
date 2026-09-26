import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import accountApi from "../app/AccountApi";
import AvatarBox from "./AvatarBox";
import routes from "./routes";
import Button from "./ui/Button";
import { Field } from "./ui/Field";
import PasswordInput from "./ui/PasswordInput";
import { Alert } from "./ui/Primitives";

// Magic-link landing page for setting a new password. There is no pre-validation: an invalid or
// expired token surfaces as an error on submit. The token is stripped from the URL on load.
const PasswordReset = () => {
  const { t } = useTranslation();
  const { token: tokenParam } = useParams();
  const navigate = useNavigate();
  const token = useRef(tokenParam);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Keeps the token out of history and Referer headers
    window.history.replaceState(null, "", routes.login);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSending(true);
      setError("");
      await accountApi.resetPassword(token.current, password);
      setDone(true);
    } catch (e) {
      console.log(`[PasswordReset] Reset failed`, e);
      setError(t("reset_password_form_error_invalid"));
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <AvatarBox title={t("reset_password_success_title")} icon={CheckCircle2} iconClassName="text-success">
        <p className="text-center text-sm text-muted">{t("reset_password_success_description")}</p>
        <Button size="lg" className="mt-5 w-full" onClick={() => navigate(routes.login)}>
          {t("login_form_button_submit")}
        </Button>
      </AvatarBox>
    );
  }

  return (
    <AvatarBox title={t("reset_password_title")}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field label={t("reset_password_form_password")} htmlFor="password">
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
        </Field>
        <Field label={t("reset_password_form_confirm")} htmlFor="confirm">
          <PasswordInput
            id="confirm"
            name="confirm"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(ev) => setConfirm(ev.target.value)}
          />
        </Field>
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" size="lg" disabled={sending || password === "" || confirm === "" || password !== confirm}>
          {t("reset_password_form_button_submit")}
        </Button>
      </form>
    </AvatarBox>
  );
};

export default PasswordReset;
