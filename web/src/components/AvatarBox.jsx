import * as React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../img/alai.svg";
import routes from "./routes";
import { fadeNavigate } from "../app/transition";
import { Card } from "./ui/Primitives";
import cn from "./ui/cn";

/** Centered card with the app logo, used by the sign-in, sign-up, password reset and email verification pages. */
const AvatarBox = ({ title, icon: Icon, iconClassName, children, footer }) => {
  const navigate = useNavigate();
  const avatar = <img src={logo} alt="Alai" className="size-14 rounded-2xl" />;
  const handleLogoClick = (ev) => {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) {
      return;
    }
    ev.preventDefault();
    fadeNavigate(navigate, routes.app);
  };
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10 text-text">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          {/* With forced login there is no app to return to, so the logo is not a link */}
          {config.require_login ? (
            avatar
          ) : (
            <a href={routes.app} onClick={handleLogoClick} className="rounded-2xl leading-none">
              {avatar}
            </a>
          )}
        </div>
        <Card className="p-6 shadow-sm sm:p-8">
          {title && (
            <div className="mb-5 flex items-center justify-center gap-2 text-center">
              {Icon && <Icon className={cn("size-6 shrink-0", iconClassName)} aria-hidden />}
              <h1 className="text-xl font-semibold">{title}</h1>
            </div>
          )}
          {children}
        </Card>
        {footer && <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
};

export const AuthLink = ({ className, ...props }) => (
  <NavLink className={cn("font-medium text-accent hover:underline", className)} {...props} />
);

export default AvatarBox;
