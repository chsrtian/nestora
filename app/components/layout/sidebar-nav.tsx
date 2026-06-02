"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../ui/utils";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

type SidebarNavProps = {
  items: SidebarNavItem[];
  footer?: React.ReactNode;
  className?: string;
};

type MobileNavProps = {
  items: SidebarNavItem[];
};

export function SidebarNav({ items, footer, className }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <aside className={cn("hidden border-r border-neutral-200 bg-white lg:flex lg:w-64 lg:flex-col", className)}>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-violet-200 bg-violet-50 text-violet-700 shadow-sm"
                  : "border-transparent text-neutral-600 hover:border-violet-100 hover:bg-violet-50/60 hover:text-violet-700",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge ? (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", active ? "bg-white text-violet-700" : "bg-violet-50 text-violet-700")}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      {footer ? <div className="border-t border-neutral-200 p-3">{footer}</div> : null}
    </aside>
  );
}

export function MobileNav({ items }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard navigation"
      className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
              active
                ? "border-violet-200 bg-violet-50 text-violet-700 shadow-sm"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-violet-200 hover:bg-violet-50/60 hover:text-violet-700",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
            {item.badge ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  active ? "bg-white text-violet-700" : "bg-violet-50 text-violet-700",
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
