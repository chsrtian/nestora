import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "border-violet-600 bg-violet-600 text-white shadow-sm shadow-violet-950/10 hover:border-violet-700 hover:bg-violet-700",
  secondary: "border-neutral-200 bg-white text-neutral-950 shadow-sm hover:border-violet-200 hover:bg-violet-50/60 hover:text-violet-700",
  ghost: "border-transparent bg-transparent text-neutral-700 hover:bg-violet-50/70 hover:text-violet-700",
  danger: "border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
  success: "border-green-200 bg-white text-green-700 hover:border-green-300 hover:bg-green-50",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-sm",
  icon: "h-10 w-10 justify-center p-0",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-xl border font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
