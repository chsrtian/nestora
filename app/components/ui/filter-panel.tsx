import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "./utils";

type FilterPanelProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function FilterPanel({ title = "Filters", description, children, actions, className }: FilterPanelProps) {
  return (
    <section className={cn("rounded-xl border border-neutral-200/80 bg-white p-5 shadow-sm", className)}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-violet-100 bg-violet-50 p-2 text-violet-700">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-950">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-neutral-500">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}
