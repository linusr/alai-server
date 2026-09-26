import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import accountApi from "../app/AccountApi";
import AvatarBox, { AuthLink } from "./AvatarBox";
import session from "../app/Session";
import routes from "./routes";
import { UnauthorizedError } from "../app/errors";
import { fadeReload } from "../app/transition";
import Button from "./ui/Button";
import { Field, Input } from "./ui/Field";
import PasswordInput from "./ui/PasswordInput";
import { Alert } from "./ui/Primitives";

const Login = () => {
  const { t } = useTranslation();
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const user = { username, password };
    try {
      const { token, username: canonicalUsername } = await accountApi.login(user);
      console.log(`[Login] User auth for user ${user.username} successful, logged in as ${canonicalUsername}`);
      await session.store(canonicalUsername, token);
      fadeReload(routes.app);
    } catch (e) {
      console.log(`[Login] User auth for user ${user.username} failed`, e);
      if (e instanceof UnauthorizedError) {
        setError(t("Login failed: Invalid username/email or password"));
      } else {
        setError(e.message);
      }
    }
  };

  if (!config.enable_login) {
    return <AvatarBox title={t("login_disabled")} />;
  }

  const footer = (config.enable_reset_password || config.enable_signup) && (
    <>
      {config.enable_reset_password && <AuthLink to={routes.passwordResetRequest}>{t("login_link_forgot_password")}</AuthLink>}
      {config.enable_signup && <AuthLink to={routes.signup}>{t("login_link_signup")}</AuthLink>}
    </>
  );

  return (
    <AvatarBox title={t("login_title")} footer={footer}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Field label={t("login_form_username_label")} htmlFor="username">
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
        <Field label={t("signup_form_password")} htmlFor="password">
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
          />
        </Field>
        {error && <Alert severity="error">{error}</Alert>}
        <Button type="submit" size="lg" disabled={username === "" || password === ""}>
          {t("login_form_button_submit")}
        </Button>
      </form>
    </AvatarBox>
  );
};

export default Login;
