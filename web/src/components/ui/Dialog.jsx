import * as React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import cn from "./cn";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

/** Centered dialog on wide screens, bottom sheet on phones. */
export const DialogContent = ({ title, description, className, children, hideClose = false, ...props }) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
    <RadixDialog.Content
      className={cn(
        "fixed z-50 flex max-h-[92dvh] w-full flex-col overflow-hidden border border-border bg-surface text-text shadow-2xl",
        "inset-x-0 bottom-0 rounded-t-3xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div className="min-w-0">
          <RadixDialog.Title className="text-lg font-semibold">{title}</RadixDialog.Title>
          {description ? (
            <RadixDialog.Description className="mt-1 text-sm text-muted">{description}</RadixDialog.Description>
          ) : (
            <RadixDialog.Description className="sr-only">{title}</RadixDialog.Description>
          )}
        </div>
        {!hideClose && (
          <RadixDialog.Close
            className="-mr-2 -mt-1 rounded-lg p-2 text-muted outline-none hover:bg-surface-2 hover:text-text focus-visible:ring-2 focus-visible:ring-accent-soft"
            aria-label="Close"
          >
            <X className="size-5" />
          </RadixDialog.Close>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">{children}</div>
    </RadixDialog.Content>
  </RadixDialog.Portal>
);

export const DialogFooter = ({ className, children }) => (
  <div className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}>{children}</div>
);
