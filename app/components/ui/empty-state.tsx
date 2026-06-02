import type { ReactNode } from "react";
import { cn } from "./utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm", className)}>
      {icon ? <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-700">{icon}</div> : null}
      <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">{description}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
