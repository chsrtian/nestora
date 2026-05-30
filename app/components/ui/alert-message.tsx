import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "./utils";

type AlertVariant = "info" | "success" | "warning" | "danger";

const variants: Record<AlertVariant, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-green-200 bg-green-50 text-green-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-red-200 bg-red-50 text-red-900",
};

const icons: Record<AlertVariant, ReactNode> = {
  info: <Info className="h-4 w-4" aria-hidden="true" />,
  success: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  warning: <TriangleAlert className="h-4 w-4" aria-hidden="true" />,
  danger: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
};

type AlertMessageProps = {
  title?: string;
  children: ReactNode;
  variant?: AlertVariant;
  className?: string;
};

export function AlertMessage({ title, children, variant = "info", className }: AlertMessageProps) {
  return (
    <div className={cn("flex gap-3 rounded-lg border p-4 text-sm leading-6", variants[variant], className)} role={variant === "danger" ? "alert" : "status"}>
      <div className="mt-0.5 shrink-0">{icons[variant]}</div>
      <div>
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={cn(title ? "mt-1" : null)}>{children}</div>
      </div>
    </div>
  );
}
