import * as React from "react";
import { useTranslation } from "react-i18next";
import { PermissionDenyAll, PermissionRead, PermissionReadWrite, PermissionWrite } from "./ReserveIcons";
import { Permission } from "../app/AccountApi";
import cn from "./ui/cn";

/** Vertical radio group of icon + label rows; `options` are `{ value, icon: <element>, label }`. */
export const ChoiceList = ({ label, options, value, onChange, className }) => (
  <div role="radiogroup" aria-label={label} className={cn("flex flex-col gap-1.5", className)}>
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
            selected ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
          )}
        >
          {option.icon}
          <span className={cn("flex-1", selected && "font-medium")}>{option.label}</span>
          <span
            aria-hidden
            className={cn(
              "size-4 shrink-0 rounded-full border-2",
              selected ? "border-accent bg-accent shadow-[inset_0_0_0_2px_var(--surface)]" : "border-border-strong",
            )}
          />
        </button>
      );
    })}
  </div>
);

/** Access level that everyone else gets on a reserved topic. */
const ReserveTopicSelect = ({ value, onChange, className }) => {
  const { t } = useTranslation();
  const options = [
    { value: Permission.DENY_ALL, icon: <PermissionDenyAll size="small" />, label: t("prefs_reservations_table_everyone_deny_all") },
    { value: Permission.READ_ONLY, icon: <PermissionRead size="small" />, label: t("prefs_reservations_table_everyone_read_only") },
    { value: Permission.WRITE_ONLY, icon: <PermissionWrite size="small" />, label: t("prefs_reservations_table_everyone_write_only") },
    { value: Permission.READ_WRITE, icon: <PermissionReadWrite size="small" />, label: t("prefs_reservations_table_everyone_read_write") },
  ];
  return (
    <ChoiceList
      label={t("prefs_reservations_dialog_access_label")}
      options={options}
      value={value}
      onChange={onChange}
      className={className}
    />
  );
};

export default ReserveTopicSelect;
