import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./utils";

type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info" | "premium";

const variants: Record<BadgeVariant, string> = {
  neutral: "border-neutral-200 bg-neutral-50 text-neutral-700",
  success: "border-green-200 bg-green-50 text-green-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  premium: "border-violet-200 bg-violet-50 text-violet-700",
};

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  variant?: BadgeVariant;
};

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
