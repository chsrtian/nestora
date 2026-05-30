import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./utils";

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-950",
        "focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/10",
        "disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500",
        className,
      )}
      {...props}
    />
  );
}
