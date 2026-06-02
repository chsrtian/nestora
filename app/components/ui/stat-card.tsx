import type { ReactNode } from "react";
import { cn } from "./utils";

type StatCardProps = {
  label: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, description, icon, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-neutral-500">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-neutral-950">{value}</p>
        </div>
        {icon ? <div className="rounded-xl border border-violet-100 bg-violet-50 p-2 text-violet-700">{icon}</div> : null}
      </div>
      {description ? <p className="mt-4 text-sm leading-6 text-neutral-500">{description}</p> : null}
    </div>
  );
}
