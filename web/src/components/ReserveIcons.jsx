import * as React from "react";
import { Globe, Lock } from "lucide-react";
import cn from "./ui/cn";

const PermissionInternal = React.forwardRef(({ icon: Icon, text, size = "medium", className, ...props }, ref) => (
  <span ref={ref} className={cn("relative inline-flex shrink-0 align-middle text-muted", className)} {...props}>
    <Icon className={size === "small" ? "size-4" : "size-5"} aria-hidden />
    {text && <span className="absolute -bottom-0.5 -right-1.5 text-[10px] font-semibold leading-none">{text}</span>}
  </span>
));
PermissionInternal.displayName = "PermissionInternal";

// `sx` is dropped so callers still passing MUI styling don't leak it onto the DOM.
const permissionIcon = (icon, text) => {
  const Component = React.forwardRef(({ sx, ...props }, ref) => <PermissionInternal icon={icon} text={text} ref={ref} {...props} />);
  Component.displayName = "PermissionIcon";
  return Component;
};

export const PermissionReadWrite = permissionIcon(Globe);
export const PermissionDenyAll = permissionIcon(Lock);
export const PermissionRead = permissionIcon(Globe, "R");
export const PermissionWrite = permissionIcon(Globe, "W");
