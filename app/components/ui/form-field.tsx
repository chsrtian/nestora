import type { ReactNode } from "react";
import { cn } from "./utils";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  description?: string;
  error?: string | null;
  children: ReactNode;
  className?: string;
};

export function FormField({ label, htmlFor, description, error, children, className }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-900">
        {label}
      </label>
      {children}
      {description ? <p className="text-sm leading-6 text-neutral-500">{description}</p> : null}
      {error ? (
        <p role="alert" className="text-sm leading-6 text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
