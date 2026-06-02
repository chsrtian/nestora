import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Map,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { BrandLink, FooterCredit } from "@/app/components/brand/nestora-brand";

const trustIndicators = [
  "No hidden fees",
  "Admin-reviewed listings",
  "Direct landlord contact",
];

const roleCards = [
  {
    title: "Renters",
    description:
      "Browse approved rentals, compare details, send inquiries, and use matching tools to narrow the search.",
    href: "/register",
    action: "Start browsing",
    icon: Users,
    tone: "violet",
  },
  {
    title: "Landlords",
    description:
      "Submit properties for review, manage listing details, respond to inquiries, and request verification.",
    href: "/register",
    action: "List a property",
    icon: Building2,
    tone: "emerald",
  },
  {
    title: "Admin Review",
    description:
      "Listings are reviewed before renter visibility, supporting a cleaner marketplace for everyone.",
    href: "#how-it-works",
    action: "Learn how it works",
    icon: ShieldCheck,
    tone: "stone",
  },
];

const featureCards = [
  {
    title: "Map View",
    description:
      "Explore approved rentals geographically and use location-aware browsing when listings include coordinates.",
    icon: Map,
    tone: "violet",
  },
  {
    title: "AI Recommendations",
    description:
      "Set preferences and rank approved rentals by fit using the marketplace recommendation workflow.",
    icon: Sparkles,
    tone: "emerald",
  },
  {
    title: "Discovery Assistant",
    description:
      "Describe what you want in plain language and use the assistant to discover matching rentals.",
    icon: MessageCircle,
    tone: "amber",
  },
  {
    title: "Verified Listings",
    description:
      "Approved-property filtering keeps renter discovery focused on listings that have passed review.",
    icon: BadgeCheck,
    tone: "stone",
  },
];

function iconTone(tone: string) {
  if (tone === "emerald") return "bg-emerald-100 text-emerald-700";
  if (tone === "amber") return "bg-amber-100 text-amber-700";
  if (tone === "stone") return "bg-stone-100 text-stone-700";
  return "bg-violet-100 text-violet-700";
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#232321] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#292927]/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <BrandLink className="text-lg" />

          <nav className="hidden items-center gap-8 text-sm font-semibold text-stone-300 md:flex">
            <a href="#browse" className="transition-colors hover:text-white">
              Browse rentals
            </a>
            <a href="#landlords" className="transition-colors hover:text-white">
              For landlords
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-white">
              How it works
            </a>
          </nav>

          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5 sm:px-5"
          >
            Sign in
          </Link>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 pb-4 text-sm font-semibold text-stone-300 [scrollbar-width:none] sm:px-6 md:hidden [&::-webkit-scrollbar]:hidden">
          <a
            href="#browse"
            className="shrink-0 rounded-full border border-white/10 px-3 py-2 transition-colors hover:border-white/20 hover:text-white"
          >
            Browse rentals
          </a>
          <a
            href="#landlords"
            className="shrink-0 rounded-full border border-white/10 px-3 py-2 transition-colors hover:border-white/20 hover:text-white"
          >
            For landlords
          </a>
          <a
            href="#how-it-works"
            className="shrink-0 rounded-full border border-white/10 px-3 py-2 transition-colors hover:border-white/20 hover:text-white"
          >
            How it works
          </a>
        </nav>
      </header>

      <section
        id="browse"
        className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.18),transparent_34rem)]"
      >
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[1fr_0.95fr] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Verified listings only
            </div>

            <h1 className="mt-8 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Find your next home reviewed and approved before it reaches you.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-stone-300 sm:text-lg">
              Browse approved rental properties, compare details, send inquiries,
              and use matching tools from one focused marketplace.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white px-5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-stone-100"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                Browse rentals
              </Link>
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 px-5 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5"
              >
                <Building2 className="h-4 w-4" aria-hidden="true" />
                List a property
              </Link>
            </div>

            <div className="mt-9 grid gap-4 text-sm font-semibold text-stone-300 sm:grid-cols-3 lg:max-w-2xl">
              {trustIndicators.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[34rem] overflow-hidden rounded-2xl border border-white/10 bg-[#2c2c2a] p-4 shadow-2xl shadow-black/20 lg:min-h-[40rem]">
            <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
            <div className="grid h-full grid-rows-[auto_1fr_auto] gap-4">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/15 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
                    Marketplace flow
                  </p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    Search, compare, inquire
                  </p>
                </div>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Approved
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-3 rounded-xl border border-white/10 bg-[#242422] p-4">
                  <div className="h-3 w-24 rounded-full bg-white/20" />
                  <div className="h-11 rounded-xl border border-white/10 bg-white/5" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-10 rounded-xl border border-white/10 bg-white/5" />
                    <div className="h-10 rounded-xl border border-white/10 bg-white/5" />
                    <div className="h-10 rounded-xl border border-white/10 bg-white/5" />
                    <div className="h-10 rounded-xl border border-white/10 bg-white/5" />
                  </div>
                  <div className="pt-4">
                    <div className="h-3 w-32 rounded-full bg-violet-300/40" />
                    <div className="mt-3 space-y-2">
                      <div className="h-3 rounded-full bg-white/10" />
                      <div className="h-3 w-4/5 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#242422] p-4">
                  <div className="relative h-full min-h-72 overflow-hidden rounded-xl border border-white/10 bg-[#ded9cc]">
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(35,35,33,0.09)_1px,transparent_1px),linear-gradient(0deg,rgba(35,35,33,0.09)_1px,transparent_1px)] bg-[size:70px_70px]" />
                    <div className="absolute left-[18%] top-[24%] h-10 w-10 rounded-full border-4 border-white/70 bg-violet-500 shadow-lg shadow-black/20" />
                    <div className="absolute right-[18%] top-[38%] h-10 w-10 rounded-full border-4 border-white/70 bg-emerald-500 shadow-lg shadow-black/20" />
                    <div className="absolute bottom-[18%] left-[42%] h-10 w-10 rounded-full border-4 border-white/70 bg-[#ff385c] shadow-lg shadow-black/20" />
                    <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-white/40 bg-white/80 p-3 text-neutral-950 shadow-sm backdrop-blur">
                      <p className="text-sm font-semibold">Approved rentals on the map</p>
                      <p className="mt-1 text-xs text-neutral-600">
                        Coordinate-ready listings appear in the renter map view.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {trustIndicators.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-stone-200"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="landlords"
        className="border-b border-white/10 bg-[#2a2a28]"
        aria-labelledby="role-paths"
      >
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
            {roleCards.map((card) => {
              const Icon = card.icon;

              return (
                <article key={card.title} className="bg-[#2a2a28] p-6 sm:p-8">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${iconTone(card.tone)}`}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h2 id={card.title === "Renters" ? "role-paths" : undefined} className="mt-5 text-xl font-semibold text-white">
                    {card.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-stone-300">
                    {card.description}
                  </p>
                  <Link
                    href={card.href}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-300 transition-colors hover:text-violet-100"
                  >
                    {card.action}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#232321]">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-300">
              How it works
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Everything you need to find or fill a rental.
            </h2>
            <p className="mt-4 text-base leading-7 text-stone-300">
              One account supports browsing, listing, matching, and inquiry management
              through the existing marketplace workflows.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.title}
                  className="rounded-2xl border border-white/10 bg-[#2d2d2b] p-6 transition-colors hover:border-white/20"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconTone(card.tone)}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-white">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-stone-300">
                    {card.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#292927]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-stone-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="space-y-1">
            <p className="font-semibold text-stone-200">Nestora</p>
            <FooterCredit theme="dark" />
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/login" className="transition-colors hover:text-white">
              Sign in
            </Link>
            <Link href="/register" className="transition-colors hover:text-white">
              Create account
            </Link>
            <a href="#how-it-works" className="transition-colors hover:text-white">
              How it works
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
