import * as React from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "./Field";
import cn from "./cn";

/** Password input with a show/hide toggle inside the field. */
const PasswordInput = React.forwardRef(({ className, ...props }, ref) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
      <button
        type="button"
        aria-label={t("signup_form_toggle_password_visibility")}
        onClick={() => setVisible((v) => !v)}
        onMouseDown={(ev) => ev.preventDefault()}
        className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
