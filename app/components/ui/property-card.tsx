import type { ReactNode } from "react";
import { Bath, BedDouble, Building2, MapPin } from "lucide-react";
import { Badge } from "./badge";
import { StatusBadge } from "./status-badge";
import { cn } from "./utils";

type PropertyCardProps = {
  title: string;
  city?: string | null;
  address?: string | null;
  propertyType?: string | null;
  monthlyRent?: number | string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  amenities?: string[];
  description?: string | null;
  status?: string | null;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

function formatRent(monthlyRent: number | string | null | undefined) {
  if (monthlyRent === null || monthlyRent === undefined || monthlyRent === "") return "Price unavailable";
  const numericRent = Number(monthlyRent);
  if (Number.isNaN(numericRent)) return `${monthlyRent}/mo`;
  return `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numericRent)}/mo`;
}

export function PropertyCard({
  title,
  city,
  address,
  propertyType,
  monthlyRent,
  bedrooms,
  bathrooms,
  amenities = [],
  description,
  status,
  actions,
  meta,
  className,
}: PropertyCardProps) {
  const visibleAmenities = amenities.slice(0, 3);
  const hiddenAmenityCount = Math.max(amenities.length - visibleAmenities.length, 0);

  return (
    <article className={cn("group overflow-hidden rounded-lg border border-neutral-200 bg-white transition-colors hover:border-neutral-300", className)}>
      <div className="relative flex aspect-[4/3] items-end justify-between bg-[linear-gradient(135deg,#f5f5f4,#e7e5e4)] p-4">
        <div>
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-white/80 text-neutral-700 ring-1 ring-black/5">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{propertyType || "Rental"}</p>
        </div>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <div className="space-y-4 p-4">
        <div className="space-y-1">
          <p className="text-lg font-semibold tracking-tight text-neutral-950">{formatRent(monthlyRent)}</p>
          <h2 className="line-clamp-1 text-base font-medium text-neutral-950">{title}</h2>
          <p className="flex items-center gap-1.5 text-sm text-neutral-500">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span className="line-clamp-1">{[city, address].filter(Boolean).join(" · ") || "Location unavailable"}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-neutral-600">
          {bedrooms !== null && bedrooms !== undefined ? (
            <span className="inline-flex items-center gap-1.5">
              <BedDouble className="h-4 w-4" aria-hidden="true" />
              {bedrooms} bed
            </span>
          ) : null}
          {bathrooms !== null && bathrooms !== undefined ? (
            <span className="inline-flex items-center gap-1.5">
              <Bath className="h-4 w-4" aria-hidden="true" />
              {bathrooms} bath
            </span>
          ) : null}
        </div>
        {description ? <p className="line-clamp-2 text-sm leading-6 text-neutral-500">{description}</p> : null}
        {visibleAmenities.length ? (
          <div className="flex flex-wrap gap-2">
            {visibleAmenities.map((amenity) => (
              <Badge key={amenity}>{amenity}</Badge>
            ))}
            {hiddenAmenityCount ? <Badge>+{hiddenAmenityCount}</Badge> : null}
          </div>
        ) : null}
        {meta ? <div className="border-t border-neutral-100 pt-4 text-sm text-neutral-500">{meta}</div> : null}
        {actions ? <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">{actions}</div> : null}
      </div>
    </article>
  );
}
