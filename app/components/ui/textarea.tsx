import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "./utils";

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<"textarea">>(
  function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-28 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 text-neutral-950",
        "placeholder:text-neutral-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/10",
        "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
        className,
      )}
      {...props}
    />
  );
  },
);
