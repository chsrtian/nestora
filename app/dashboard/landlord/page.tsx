"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  ClipboardList,
  Home,
  Loader2,
  MessageSquare,
  Plus,
  ShieldCheck,
  Star,
} from "lucide-react";
import { AppShell } from "@/app/components/layout/app-shell";
import type { SidebarNavItem } from "@/app/components/layout/sidebar-nav";
import { PageHeader } from "@/app/components/layout/page-header";
import LogoutButton from "@/app/components/logout-button";
import { AlertMessage } from "@/app/components/ui/alert-message";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Skeleton } from "@/app/components/ui/skeleton";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/profile";

type Property = {
  id: string;
  title: string;
  city: string;
  price: number;
  status: string;
  created_at: string;
};

type Inquiry = {
  id: string;
  property_id: string;
  renter_id: string;
  message: string;
  created_at: string;
  properties: { title: string | null } | null;
};

type Review = {
  id: string;
  property_id: string;
  renter_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  properties: { title: string | null } | null;
};

type VerificationRequest = {
  id: string;
  landlord_id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
};

type EmbeddedOne<T> = T | T[] | null;

type InquiryRow = Omit<Inquiry, "properties"> & {
  properties: EmbeddedOne<Inquiry["properties"]>;
};

type ReviewRow = Omit<Review, "properties"> & {
  properties: EmbeddedOne<Review["properties"]>;
};

function normalizeEmbeddedOne<T>(value: EmbeddedOne<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

const landlordNavItems: SidebarNavItem[] = [
  { href: "/dashboard/landlord", label: "Host dashboard", icon: Home },
  {
    href: "/dashboard/landlord/properties/new",
    label: "Post property",
    icon: Plus,
  },
];

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function LandlordDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSubmitError, setVerificationSubmitError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [landlordId, setLandlordId] = useState<string | null>(null);

  const hasPendingVerification = verificationRequests.some(
    (request) => request.status === "pending",
  );
  const canRequestVerification =
    verificationStatus !== "verified" && !hasPendingVerification && !verificationSubmitting;
  const pendingListings = properties.filter(
    (property) => property.status?.toLowerCase() === "pending",
  ).length;
  const approvedListings = properties.filter(
    (property) => property.status?.toLowerCase() === "approved",
  ).length;
  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((total, review) => total + review.rating, 0) /
          reviews.length
        ).toFixed(1)
      : "New";

  const loadVerificationRequests = async (
    client: ReturnType<typeof getSupabaseClient>,
    userId: string,
  ) => {
    if (!client) return;
    setVerificationLoading(true);
    setVerificationError(null);

    const { data, error: requestError } = await client
      .from("verification_requests")
      .select("id, landlord_id, status, submitted_at, reviewed_at")
      .eq("landlord_id", userId)
      .order("submitted_at", { ascending: false });

    if (requestError) {
      setVerificationError(requestError.message);
      setVerificationRequests([]);
    } else {
      setVerificationRequests((data ?? []) as VerificationRequest[]);
    }

    setVerificationLoading(false);
  };

  const onRequestVerification = async () => {
    if (!landlordId) {
      setVerificationSubmitError("Unable to determine landlord account.");
      return;
    }

    if (verificationStatus === "verified") {
      setVerificationSubmitError("Your account is already verified.");
      return;
    }

    if (hasPendingVerification) {
      setVerificationSubmitError("You already have a pending request.");
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setVerificationSubmitError(
        supabaseConfigError ?? "Supabase is not configured.",
      );
      return;
    }

    setVerificationSubmitting(true);
    setVerificationSubmitError(null);

    const { error: insertError } = await client.rpc(
      "submit_landlord_verification_request",
    );

    if (insertError) {
      setVerificationSubmitError(insertError.message);
      setVerificationSubmitting(false);
      return;
    }

    await loadVerificationRequests(client, landlordId);
    setVerificationStatus("pending");
    setVerificationSubmitting(false);
  };

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      const client = getSupabaseClient();
      if (!client) {
        setError(supabaseConfigError ?? "Supabase is not configured.");
        setLoading(false);
        return;
      }

      const { data: sessionData, error: sessionError } =
        await client.auth.getSession();

      if (!isMounted) return;

      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      if (!sessionData.session) {
        router.replace("/login");
        return;
      }

      setAuthCookie();
      setEmail(sessionData.session.user.email ?? null);
      setLandlordId(sessionData.session.user.id);

      const { profile, error: profileError } = await ensureProfile(
        client,
        sessionData.session.user.id,
      );

      if (!isMounted) return;

      if (profileError || !profile) {
        setError("Profile not found. Please contact support.");
        setLoading(false);
        return;
      }

      if (profile.role !== "landlord") {
        router.replace("/dashboard");
        return;
      }

      setVerificationStatus(profile.verification_status);

      const { data: propertiesData, error: propertiesError } = await client
        .from("properties")
        .select("id, title, city, price, status, created_at")
        .eq("landlord_id", sessionData.session.user.id)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (propertiesError) {
        setError(propertiesError.message);
        setLoading(false);
        return;
      }

      const { data: inquiriesData, error: inquiriesError } = await client
        .from("inquiries")
        .select("id, property_id, renter_id, message, created_at, properties(title)")
        .eq("landlord_id", sessionData.session.user.id)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (inquiriesError) {
        setListError(inquiriesError.message);
      }

      const { data: reviewsData, error: reviewsError } = await client
        .from("reviews")
        .select("id, property_id, renter_id, rating, comment, created_at, properties(title)")
        .eq("landlord_id", sessionData.session.user.id)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (reviewsError) {
        setListError(reviewsError.message);
      }

      await loadVerificationRequests(client, sessionData.session.user.id);

      setProperties(propertiesData ?? []);
      const normalizedInquiries = ((inquiriesData ?? []) as InquiryRow[]).map(
        (inquiry) => ({
          ...inquiry,
          properties: normalizeEmbeddedOne(inquiry.properties),
        }),
      );
      const normalizedReviews = ((reviewsData ?? []) as ReviewRow[]).map(
        (review) => ({
          ...review,
          properties: normalizeEmbeddedOne(review.properties),
        }),
      );

      setInquiries(normalizedInquiries);
      setReviews(normalizedReviews);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <AppShell navItems={landlordNavItems} title="Host Marketplace">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-[32rem] max-w-full" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
            <Skeleton className="h-80 w-full" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      navItems={landlordNavItems}
      title="Host Marketplace"
      topNavAction={email ? <Badge>{email}</Badge> : null}
      sidebarFooter={<LogoutButton />}
      className="pb-8"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Host dashboard"
          title="Welcome back to hosting"
          description="Your listings are front and center, with renter interest, reviews, and trust signals close at hand."
          actions={
            <Button
              type="button"
              onClick={() => router.push("/dashboard/landlord/properties/new")}
              size="lg"
              className="bg-[#ff385c] hover:bg-[#e03150]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Post property
            </Button>
          }
        />

        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}
        {listError ? <AlertMessage variant="danger">{listError}</AlertMessage> : null}

        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              label: "Live portfolio",
              value: properties.length,
              detail: `${pendingListings} pending review`,
              icon: <ClipboardList className="h-4 w-4" aria-hidden="true" />,
            },
            {
              label: "Renter interest",
              value: inquiries.length,
              detail: "Recent inquiries",
              icon: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
            },
            {
              label: "Guest rating",
              value: averageRating,
              detail: reviews.length > 0 ? `${reviews.length} reviews` : "No reviews yet",
              icon: <Star className="h-4 w-4" aria-hidden="true" />,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-neutral-500">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
                    {stat.value}
                  </p>
                </div>
                <div className="rounded-md bg-neutral-950 p-2 text-white">
                  {stat.icon}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                {stat.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-label="Host listings" className="space-y-4">
            <div className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
                  Listings
                </h2>
                <p className="text-sm leading-6 text-neutral-500">
                  Properties submitted under your landlord account, ordered by newest first.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="info" className="px-3 py-1 text-sm">
                  {properties.length} total
                </Badge>
                <Badge variant="warning" className="px-3 py-1 text-sm">
                  {pendingListings} pending
                </Badge>
                <Badge variant="success" className="px-3 py-1 text-sm">
                  {approvedListings} approved
                </Badge>
              </div>
            </div>

            {properties.length === 0 ? (
              <EmptyState
                title="Start with your first listing"
                description="Create a property listing for review. New listings remain pending until approved."
                icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
                action={
                  <Button
                    type="button"
                    onClick={() =>
                      router.push("/dashboard/landlord/properties/new")
                    }
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Post property
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3">
                {properties.map((property) => (
                  <article
                    key={property.id}
                    className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm transition-colors hover:border-neutral-300"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex min-w-0 gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#ff385c]/10 text-[#ff385c]">
                          <Building2 className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="line-clamp-1 text-lg font-semibold text-neutral-950">
                              {property.title}
                            </h3>
                            <StatusBadge
                              status={property.status}
                              className="px-3 py-1 text-sm uppercase tracking-normal"
                            />
                          </div>
                          <p className="mt-1 text-sm text-neutral-500">
                            {property.city || "City not specified"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-neutral-600">
                            Submitted {formatDate(property.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-neutral-50 px-4 py-3 text-left md:text-right">
                        <p className="text-xs font-medium uppercase text-neutral-400">
                          Asking rent
                        </p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
                          {formatPrice(property.price)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 border-t border-neutral-100 pt-4 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-xs font-medium uppercase text-neutral-400">
                          Status
                        </p>
                        <div className="mt-2">
                          <StatusBadge
                            status={property.status}
                            className="px-3 py-1 text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase text-neutral-400">
                          City
                        </p>
                        <p className="mt-2 font-medium text-neutral-800">
                          {property.city || "Not set"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase text-neutral-400">
                          Created
                        </p>
                        <p className="mt-2 font-medium text-neutral-800">
                          {formatDate(property.created_at)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card className="border-neutral-950/10 shadow-sm">
              <CardHeader className="p-5 pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant="premium">Host trust</Badge>
                    <CardTitle className="mt-3 text-lg">Verification panel</CardTitle>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      Keep your host profile trustworthy for renters reviewing your listings.
                    </p>
                  </div>
                  <div className="rounded-lg bg-neutral-950 p-2 text-white">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                {verificationError ? (
                  <AlertMessage variant="danger">{verificationError}</AlertMessage>
                ) : null}
                {verificationSubmitError ? (
                  <AlertMessage variant="danger">
                    {verificationSubmitError}
                  </AlertMessage>
                ) : null}

                <div className="border-y border-neutral-200 py-4">
                  <p className="text-xs font-medium uppercase text-neutral-400">
                    Current status
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <StatusBadge
                      status={verificationStatus}
                      className="px-3 py-1.5 text-sm uppercase tracking-normal"
                    />
                    {verificationLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-neutral-500" aria-hidden="true" />
                    ) : null}
                  </div>
                </div>

                {!verificationLoading && verificationRequests.length === 0 ? (
                  <p className="text-sm leading-6 text-neutral-500">
                    No verification requests yet. Submit once you are ready for review.
                  </p>
                ) : null}

                {!verificationLoading && verificationRequests.length > 0 ? (
                  <div className="divide-y divide-neutral-100 border-y border-neutral-100">
                    {verificationRequests.map((request) => (
                      <div key={request.id} className="py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <StatusBadge status={request.status} />
                          <span className="text-xs text-neutral-500">
                            {formatDate(request.submitted_at)}
                          </span>
                        </div>
                        {request.reviewed_at ? (
                          <p className="mt-2 text-neutral-500">
                            Reviewed {formatDate(request.reviewed_at)}
                          </p>
                        ) : (
                          <p className="mt-2 text-neutral-500">
                            Waiting for admin review
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}

                {!verificationLoading && verificationStatus === "verified" ? (
                  <AlertMessage variant="success">
                    Your account is already verified.
                  </AlertMessage>
                ) : null}
                {!verificationLoading && hasPendingVerification ? (
                  <AlertMessage variant="info">
                    You already have a pending request.
                  </AlertMessage>
                ) : null}

                <Button
                  type="button"
                  onClick={onRequestVerification}
                  disabled={!canRequestVerification}
                  className="w-full"
                >
                  {verificationSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  )}
                  {verificationSubmitting
                    ? "Submitting..."
                    : "Request verification"}
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader className="p-5 pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Recent inquiries</CardTitle>
                  <p className="text-sm leading-6 text-neutral-500">
                    Messages from renters about your listings.
                  </p>
                </div>
                <Badge variant="info">{inquiries.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {inquiries.length === 0 ? (
                <EmptyState
                  title="No inquiries yet"
                  description="Renter messages will appear here once listings receive interest."
                  icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
                  className="p-6"
                />
              ) : (
                <div className="divide-y divide-neutral-100">
                  {inquiries.map((inquiry) => (
                    <article key={inquiry.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="line-clamp-1 font-medium text-neutral-950">
                            {inquiry.properties?.title || "Property"}
                          </h3>
                          <p className="mt-1 text-sm text-neutral-500">
                            Renter: {inquiry.renter_id}
                          </p>
                        </div>
                        <span className="text-xs text-neutral-500">
                          {formatDate(inquiry.created_at)}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-neutral-700">
                        {inquiry.message}
                      </p>
                    </article>
                  ))}
                </div>
              )}
              <p className="mt-4 text-sm text-neutral-500">
                Replying is not available yet.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="p-5 pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Recent reviews</CardTitle>
                  <p className="text-sm leading-6 text-neutral-500">
                    Feedback renters have left on your properties.
                  </p>
                </div>
                <Badge variant="warning">{reviews.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {reviews.length === 0 ? (
                <EmptyState
                  title="No reviews yet"
                  description="Reviews will appear after renters interact with your approved listings."
                  icon={<Star className="h-5 w-5" aria-hidden="true" />}
                  className="p-6"
                />
              ) : (
                <div className="divide-y divide-neutral-100">
                  {reviews.map((review) => (
                    <article key={review.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="line-clamp-1 font-medium text-neutral-950">
                            {review.properties?.title || "Property"}
                          </h3>
                          <p className="mt-1 text-sm text-neutral-500">
                            Renter: {review.renter_id}
                          </p>
                        </div>
                        <Badge variant="warning">{review.rating}/5</Badge>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-neutral-700">
                        {review.comment || "No comment"}
                      </p>
                      <p className="mt-2 text-xs text-neutral-500">
                        {formatDate(review.created_at)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
