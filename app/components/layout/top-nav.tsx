import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { BrandMark } from "@/app/components/brand/nestora-brand";
import { cn } from "../ui/utils";

type TopNavProps = {
  title?: string;
  action?: ReactNode;
  showSearchHint?: boolean;
  className?: string;
};

export function TopNav({ title = "Nestora", action, showSearchHint = true, className }: TopNavProps) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur", className)}>
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3 text-sm font-semibold tracking-tight text-neutral-950">
          <BrandMark className="h-9 w-9 border-neutral-200" />
          <span className="truncate">{title}</span>
        </Link>
        {showSearchHint ? (
          <div className="hidden min-w-0 flex-1 justify-center lg:flex">
            <div className="flex h-9 w-full max-w-md items-center gap-2 rounded-xl border border-neutral-200 bg-[#FAFAF8] px-3 text-sm text-neutral-500 shadow-sm">
              <Search className="h-4 w-4 text-violet-500" aria-hidden="true" />
              <span className="truncate">Search rentals, cities, or amenities</span>
            </div>
          </div>
        ) : null}
        {action ? <div className="flex min-w-0 shrink items-center justify-end gap-2 overflow-hidden">{action}</div> : null}
      </div>
    </header>
  );
}
