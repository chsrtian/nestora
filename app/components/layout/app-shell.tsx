import type { ReactNode } from "react";
import { MobileNav, SidebarNav, type SidebarNavItem } from "./sidebar-nav";
import { TopNav } from "./top-nav";
import { cn } from "../ui/utils";

type AppShellProps = {
  navItems: SidebarNavItem[];
  children: ReactNode;
  topNavAction?: ReactNode;
  sidebarFooter?: ReactNode;
  title?: string;
  showSearchHint?: boolean;
  className?: string;
};

export function AppShell({
  navItems,
  children,
  topNavAction,
  sidebarFooter,
  title,
  showSearchHint,
  className,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#F7F7F5] text-neutral-950">
      <TopNav title={title} action={topNavAction} showSearchHint={showSearchHint} />
      <div className="sticky top-16 z-20 border-b border-neutral-200 bg-[#F7F7F5]/95 backdrop-blur lg:hidden">
        <MobileNav items={navItems} />
        {sidebarFooter ? <div className="px-4 pb-3 sm:px-6">{sidebarFooter}</div> : null}
      </div>
      <div className="lg:flex">
        <SidebarNav items={navItems} footer={sidebarFooter} />
        <main className={cn("min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8", className)}>{children}</main>
      </div>
    </div>
  );
}
