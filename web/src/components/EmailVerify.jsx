import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import accountApi from "../app/AccountApi";
import AvatarBox from "./AvatarBox";
import routes from "./routes";
import Button from "./ui/Button";

const STATUS_VERIFYING = "verifying";
const STATUS_SUCCESS = "success";
const STATUS_ERROR = "error";

// Magic-link landing page for email verification. Verification is a POST, so link prefetchers and
// scanners loading this page cannot consume the single-use token. The token is stripped from the URL on load.
const EmailVerify = () => {
  const { t } = useTranslation();
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(STATUS_VERIFYING);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) {
      return; // StrictMode double-invokes effects; the token is single-use
    }
    ran.current = true;
    window.history.replaceState(null, "", routes.account);
    (async () => {
      try {
        await accountApi.verifyEmailToken(token);
        setStatus(STATUS_SUCCESS);
      } catch (e) {
        console.log(`[EmailVerify] Verification failed`, e);
        setStatus(STATUS_ERROR);
      }
    })();
  }, [token]);

  if (status === STATUS_VERIFYING) {
    return <AvatarBox title={t("email_verify_progress_title")} icon={Loader2} iconClassName="animate-spin text-muted" />;
  }

  const success = status === STATUS_SUCCESS;
  return (
    <AvatarBox
      title={t(success ? "email_verify_success_title" : "email_verify_error_title")}
      icon={success ? CheckCircle2 : AlertCircle}
      iconClassName={success ? "text-success" : "text-danger"}
    >
      <p className="text-center text-sm text-muted">{t(success ? "email_verify_success_description" : "email_verify_error_description")}</p>
      <Button size="lg" className="mt-5 w-full" onClick={() => navigate(routes.account)}>
        {t("email_verify_button_account")}
      </Button>
    </AvatarBox>
  );
};

export default EmailVerify;
