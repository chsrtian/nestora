import type { ComponentPropsWithoutRef } from "react";
import { cn } from "./utils";

export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-neutral-200/70", className)} {...props} />;
}

export function PropertyCardSkeleton() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <Skeleton className="aspect-[4/3] w-full rounded-md" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
