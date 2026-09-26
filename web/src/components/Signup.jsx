import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import accountApi from "../app/AccountApi";
import AvatarBox, { AuthLink } from "./AvatarBox";
import session from "../app/Session";
import routes from "./routes";
import { AccountActionLimitReachedError, UserExistsError } from "../app/errors";
import { fadeReload } from "../app/transition";
import Button from "./ui/Button";
import { Field, Input } from "./ui/Field";
import PasswordInput from "./ui/PasswordInput";
import { Alert } from "./ui/Primitives";

const Signup = () => {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const user = { username, password };
    try {
      await accountApi.create(user.username, user.password, email);
      const { token, username: canonicalUsername } = await accountApi.login(user);
      console.log(`[Signup] User signup for user ${user.username} successful, logged in as ${canonicalUsername}`);
      await session.store(canonicalUsername, token);
      fadeReload(routes.app);
    } catch (e) {
      console.log(`[Signup] Signup for user ${user.username} failed`, e);
      if (e instanceof UserExistsError) {
        setError(t("signup_error_username_taken", { username: e.username }));
      } else if (e instanceof AccountActionLimitReachedError) {
        setError(t("signup_error_creation_limit_reached"));
      } else {
        setError(e.message);
      }
    }
  };

  if (!config.enable_signup) {
    return <AvatarBox title={t("signup_disabled")} />;
  }

  const footer = config.enable_login && <AuthLink to={routes.login}>{t("signup_already_have_account")}</AuthLink>;

  return (
    <AvatarBox title={t("signup_title")} footer={footer}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field label={t("signup_form_username")} htmlFor="username">
          <Input
            id="username"
            name="username"
            required
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(ev) => setUsername(ev.target.value.trim())}
          />
        </Field>
        {config.enable_emails && (
          <Field label={t("signup_form_email")} htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value.trim())}
            />
          </Field>
        )}
        <Field label={t("signup_form_password")} htmlFor="password">
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
        </Field>
        <Field label={t("signup_form_confirm_password")} htmlFor="confirm">
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
        <Button type="submit" size="lg" disabled={username === "" || password === "" || password !== confirm}>
          {t("signup_form_button_submit")}
        </Button>
      </form>
    </AvatarBox>
  );
};

export default Signup;
