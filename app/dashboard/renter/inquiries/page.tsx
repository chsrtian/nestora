"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Calendar, Heart, MapPin, MessageSquare, Ruler } from "lucide-react";
import { AppShell } from "@/app/components/layout/app-shell";
import type { SidebarNavItem } from "@/app/components/layout/sidebar-nav";
import LogoutButton from "@/app/components/logout-button";
import { AlertMessage } from "@/app/components/ui/alert-message";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Skeleton } from "@/app/components/ui/skeleton";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/profile";
import { formatMonthlyRentInPHP } from "@/lib/currency";

type Inquiry = {
  id: string;
  property_id: string;
  message: string;
  created_at: string;
  properties: {
    id: string;
    title: string;
    city: string | null;
    price: number | null;
  } | null;
};

const renterNavItems: SidebarNavItem[] = [
  { href: "/dashboard/renter", label: "Browse rentals", icon: Building2 },
  { href: "/dashboard/renter/map", label: "Map", icon: MapPin },
  {
    href: "/dashboard/renter/recommendations",
    label: "Recommendations",
    icon: Ruler,
  },
  {
    href: "/dashboard/renter/assistant",
    label: "AI Assistant",
    icon: Building2,
  },
  {
    href: "/dashboard/renter/saved",
    label: "Saved",
    icon: Heart,
  },
  {
    href: "/dashboard/renter/inquiries",
    label: "My inquiries",
    icon: MessageSquare,
  },
];

export default function MyInquiriesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  useEffect(() => {
    const initialize = async () => {
      const client = getSupabaseClient();
      if (!client) {
        setError(supabaseConfigError ?? "Supabase is not configured.");
        setLoading(false);
        return;
      }

      const userData = await client.auth.getUser();
      if (userData.error || !userData.data.user) {
        router.push("/login");
        return;
      }

      const userId = userData.data.user.id;
      setEmail(userData.data.user.email ?? null);
      setAuthCookie();

      const { profile, error: profileError } = await ensureProfile(client, userId);
      if (profileError || !profile) {
        setError(profileError || "Failed to load profile.");
        setLoading(false);
        return;
      }

      // Fetch inquiries
      const { data: inquiriesData, error: inquiriesError } = await client
        .from("inquiries")
        .select(
          "id, property_id, message, created_at, properties(id, title, city, price)",
        )
        .eq("renter_id", userId)
        .order("created_at", { ascending: false });

      if (inquiriesError) {
        setError(inquiriesError.message ?? "Failed to load inquiries.");
        setLoading(false);
        return;
      }

      // Handle the response properly - properties might be nested in different formats
      const inquiriesList = inquiriesData as unknown as Array<Record<string, unknown>>;
      const inqs = (inquiriesList ?? [])
        .map((inq: Record<string, unknown>) => {
          const prop = Array.isArray(inq.properties) ? (inq.properties[0] as Inquiry["properties"]) : (inq.properties as Inquiry["properties"]);
          return {
            id: inq.id,
            property_id: inq.property_id,
            message: inq.message,
            created_at: inq.created_at,
            properties: prop,
          } as Inquiry;
        })
        .filter((inq): inq is Inquiry => Boolean(inq.id) && Boolean(inq.message));
      
      setInquiries(inqs);
      setLoading(false);
    };

    initialize();
  }, [router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  if (loading) {
    return (
      <AppShell navItems={renterNavItems} title="My Inquiries">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-12 w-full" />
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      navItems={renterNavItems}
      title="My Inquiries"
      topNavAction={email ? <Badge>{email}</Badge> : null}
      sidebarFooter={<LogoutButton />}
      className="px-3 py-3 pb-5 sm:px-4 lg:px-6"
    >
      <div className="mx-auto max-w-4xl space-y-4">
        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}

        {inquiries.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-6 w-6" aria-hidden="true" />}
            title="No inquiries yet"
            description="Browse rentals and send inquiries to landlords about properties you're interested in."
            action={
              <Button onClick={() => router.push("/dashboard/renter")}>
                Browse Rentals
              </Button>
            }
          />
        ) : (
          <>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="text-sm font-medium text-neutral-600">
                You have {inquiries.length} {inquiries.length === 1 ? "inquiry" : "inquiries"}
              </p>
            </div>

            <div className="space-y-3">
              {inquiries.map((inquiry) => (
                <article
                  key={inquiry.id}
                  className="overflow-hidden rounded-lg border border-neutral-200 bg-white transition-colors hover:border-neutral-300"
                >
                  <div className="p-4">
                    <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-semibold text-neutral-950">
                          {inquiry.properties?.title || "Unknown Property"}
                        </h3>
                        <div className="mt-1 flex flex-col gap-2 text-sm text-neutral-600 sm:flex-row sm:items-center">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {inquiry.properties?.city || "Unknown location"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="shrink-0 font-semibold">
                              {formatMonthlyRentInPHP(inquiry.properties?.price)}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-4 rounded-md bg-neutral-50 p-3">
                      <p className="line-clamp-3 text-sm text-neutral-700">
                        {inquiry.message || "No message provided"}
                      </p>
                    </div>

                    <div className="flex flex-col items-start justify-between gap-3 border-t border-neutral-100 pt-3 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                        <Calendar className="h-4 w-4" aria-hidden="true" />
                        {formatDate(inquiry.created_at)}
                      </div>
                      <Button
                        onClick={() =>
                          router.push(`/dashboard/renter?property=${inquiry.property_id}`)
                        }
                        variant="secondary"
                        size="sm"
                      >
                        View Property
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
