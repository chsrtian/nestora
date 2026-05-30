import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "../ui/utils";

type TopNavProps = {
  title?: string;
  action?: ReactNode;
  showSearchHint?: boolean;
  className?: string;
};

export function TopNav({ title = "Rental Marketplace", action, showSearchHint = true, className }: TopNavProps) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur", className)}>
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 truncate text-sm font-semibold tracking-tight text-neutral-950">
          {title}
        </Link>
        {showSearchHint ? (
          <div className="hidden min-w-0 flex-1 justify-center lg:flex">
            <div className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-500">
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="truncate">Search rentals, cities, or amenities</span>
            </div>
          </div>
        ) : null}
        {action ? <div className="flex min-w-0 shrink items-center justify-end gap-2 overflow-hidden">{action}</div> : null}
      </div>
    </header>
  );
}
