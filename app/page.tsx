import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Home as HomeIcon, MapPin, Search, Sparkles } from "lucide-react";
import { Badge } from "./components/ui/badge";
import { buttonClasses } from "./components/ui/button";
import { PropertyCard } from "./components/ui/property-card";

const featuredListings = [
  {
    title: "Bright studio near the business district",
    city: "Makati",
    address: "Legazpi Village",
    propertyType: "Studio",
    monthlyRent: 920,
    bedrooms: 1,
    bathrooms: 1,
    amenities: ["Wi-Fi", "Air conditioning", "Security"],
    status: "approved",
  },
  {
    title: "Two-bedroom apartment with balcony",
    city: "Quezon City",
    address: "South Triangle",
    propertyType: "Apartment",
    monthlyRent: 1280,
    bedrooms: 2,
    bathrooms: 2,
    amenities: ["Parking", "Elevator", "Pet friendly"],
    status: "approved",
  },
  {
    title: "Compact condo close to transit",
    city: "Pasig",
    address: "Ortigas Center",
    propertyType: "Condo",
    monthlyRent: 1100,
    bedrooms: 1,
    bathrooms: 1,
    amenities: ["Gym", "Pool", "Wi-Fi"],
    status: "approved",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7F7F5] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-neutral-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-950 text-white">
              <HomeIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            Rental Marketplace
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-neutral-600 md:flex">
            <a href="#rentals" className="hover:text-neutral-950">
              Browse rentals
            </a>
            <a href="#landlords" className="hover:text-neutral-950">
              For landlords
            </a>
            <Link href="/login" className="hover:text-neutral-950">
              Sign in
            </Link>
          </nav>
          <Link href="/register" className={buttonClasses({ size: "sm" })}>
            Get started
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-20">
        <div className="flex flex-col justify-center">
          <Badge className="w-fit" variant="neutral">
            Approved rentals from trusted landlords
          </Badge>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-neutral-950 lg:text-6xl">
            Find your next rental without the messy search.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-neutral-600">
            Browse approved apartments, condos, rooms, and homes in one clean marketplace built for renters,
            landlords, and review teams.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className={buttonClasses({ size: "lg" })}>
              <Search className="h-4 w-4" aria-hidden="true" />
              Search rentals
            </Link>
            <Link href="/register" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              <Building2 className="h-4 w-4" aria-hidden="true" />
              List property
            </Link>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-4 border-t border-neutral-200 pt-6 text-sm">
            <div>
              <p className="font-semibold text-neutral-950">Approved</p>
              <p className="mt-1 text-neutral-500">Listings reviewed before renters browse.</p>
            </div>
            <div>
              <p className="font-semibold text-neutral-950">Verified</p>
              <p className="mt-1 text-neutral-500">Landlord trust flow built in.</p>
            </div>
            <div>
              <p className="font-semibold text-neutral-950">Fast</p>
              <p className="mt-1 text-neutral-500">Search, inquire, and review in one place.</p>
            </div>
          </div>
        </div>

        <div id="rentals" className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 px-2 pb-3">
            <div>
              <p className="text-sm font-semibold text-neutral-950">Marketplace preview</p>
              <p className="text-sm text-neutral-500">Approved rentals ready to compare</p>
            </div>
            <Badge variant="success">Preview</Badge>
          </div>
          <div className="grid gap-3 pt-3 lg:grid-cols-3">
            {featuredListings.map((listing) => (
              <PropertyCard key={listing.title} {...listing} className="shadow-none" />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
          <div className="flex gap-3">
            <Search className="mt-1 h-5 w-5 text-neutral-500" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-neutral-950">Search like a marketplace</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">Filter by city, budget, type, and amenities.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <BadgeCheck className="mt-1 h-5 w-5 text-neutral-500" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-neutral-950">Review before visibility</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">Admin approval keeps the supply clean.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Sparkles className="mt-1 h-5 w-5 text-violet-600" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-neutral-950">Premium assistant</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">Describe your needs and get smarter matches.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="landlords" className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <Badge variant="premium">For renters</Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950">Compare rentals with confidence.</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            See approved listings, send inquiries, review properties after contact, and use recommendation tools
            when browsing gets noisy.
          </p>
          <Link href="/register" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-neutral-950">
            Start searching <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <Badge>For landlords</Badge>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950">Manage listing supply like a host.</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            Post properties for review, track inquiries, request verification, and build trust before renters
            choose where to live.
          </p>
          <Link href="/register" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-neutral-950">
            List a property <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Rental Marketplace</p>
          <p className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Built for approved rental discovery
          </p>
        </div>
      </footer>
    </main>
  );
}
