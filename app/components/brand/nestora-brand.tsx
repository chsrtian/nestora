import Image from "next/image";
import Link from "next/link";
import { cn } from "@/app/components/ui/utils";

export const NESTORA_LOGO_SRC = "/brand/nestora-logo.png";

type BrandMarkProps = {
  className?: string;
  priority?: boolean;
};

type BrandLinkProps = {
  className?: string;
  markClassName?: string;
  theme?: "dark" | "light";
};

type FooterCreditProps = {
  className?: string;
  theme?: "dark" | "light";
};

export function BrandMark({ className, priority = false }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "relative block h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-stone-200 shadow-sm",
        className,
      )}
    >
      <Image
        src={NESTORA_LOGO_SRC}
        alt=""
        fill
        sizes="44px"
        className="object-cover"
        priority={priority}
      />
    </span>
  );
}

export function BrandLink({
  className,
  markClassName,
  theme = "dark",
}: BrandLinkProps) {
  return (
    <Link
      href="/"
      className={cn(
        "flex min-w-0 items-center gap-3 font-semibold tracking-tight",
        theme === "dark" ? "text-white" : "text-neutral-950",
        className,
      )}
    >
      <BrandMark className={markClassName} priority />
      <span className="truncate">Nestora</span>
    </Link>
  );
}

export function FooterCredit({ className, theme = "light" }: FooterCreditProps) {
  return (
    <p
      className={cn(
        "text-xs leading-5",
        theme === "dark" ? "text-stone-500" : "text-neutral-500",
        className,
      )}
    >
      {"\u00a9"} 2026 Nestora. Developed by Christian Roble.
    </p>
  );
}
