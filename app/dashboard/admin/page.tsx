"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  ShieldCheck,
  UserCheck,
  XCircle,
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
import { formatPriceInPHP } from "@/lib/currency";

type PendingProperty = {
  id: string;
  landlord_id: string;
  title: string;
  city: string | null;
  price: number | null;
  status: string;
  created_at: string;
};

type VerificationRequest = {
  id: string;
  landlord_id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  notes: string | null;
  profiles: { full_name: string | null; verification_status: string | null } | null;
};

type EmbeddedOne<T> = T | T[] | null;

type VerificationRequestRow = Omit<VerificationRequest, "profiles"> & {
  profiles: EmbeddedOne<VerificationRequest["profiles"]>;
};

function normalizeEmbeddedOne<T>(value: EmbeddedOne<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

const adminNavItems: SidebarNavItem[] = [
  { href: "/dashboard/admin", label: "Trust center", icon: ShieldCheck },
];

function formatPrice(value: number | null) {
  return formatPriceInPHP(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [pendingProperties, setPendingProperties] = useState<PendingProperty[]>([]);
  const [pendingRequests, setPendingRequests] = useState<VerificationRequest[]>([]);
  const [propertyActionLoading, setPropertyActionLoading] = useState<
    Record<string, boolean>
  >({});
  const [requestActionLoading, setRequestActionLoading] = useState<
    Record<string, boolean>
  >({});

  const loadAdminData = async (client: SupabaseClient) => {
    setDataLoading(true);
    setListError(null);

    const [propertiesResult, requestsResult] = await Promise.all([
      client
        .from("properties")
        .select("id, landlord_id, title, city, price, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      client
        .from("verification_requests")
        .select(
          "id, landlord_id, status, submitted_at, reviewed_at, notes, profiles:landlord_id(full_name, verification_status)",
        )
        .eq("status", "pending")
        .order("submitted_at", { ascending: false }),
    ]);

    if (propertiesResult.error) {
      setListError(propertiesResult.error.message);
      setPendingProperties([]);
    } else {
      setPendingProperties((propertiesResult.data ?? []) as PendingProperty[]);
    }

    if (requestsResult.error) {
      setListError((prev) => prev ?? requestsResult.error?.message ?? null);
      setPendingRequests([]);
    } else {
      const requests = ((requestsResult.data ?? []) as VerificationRequestRow[]).map(
        (request) => ({
          ...request,
          profiles: normalizeEmbeddedOne(request.profiles),
        }),
      );
      setPendingRequests(requests);
    }

    setDataLoading(false);
  };

  const updatePropertyStatus = async (
    propertyId: string,
    status: "approved" | "rejected",
  ) => {
    const client = getSupabaseClient();
    if (!client) {
      setActionError(supabaseConfigError ?? "Supabase is not configured.");
      return;
    }

    setActionError(null);
    setPropertyActionLoading((prev) => ({ ...prev, [propertyId]: true }));

    const { error: updateError } = await client.rpc("review_property_listing", {
      property_id: propertyId,
      decision: status,
    });

    if (updateError) {
      setActionError(updateError.message);
      setPropertyActionLoading((prev) => ({ ...prev, [propertyId]: false }));
      return;
    }

    await loadAdminData(client);
    setPropertyActionLoading((prev) => ({ ...prev, [propertyId]: false }));
  };

  const updateVerification = async (
    request: VerificationRequest,
    status: "verified" | "rejected",
  ) => {
    const client = getSupabaseClient();
    if (!client) {
      setActionError(supabaseConfigError ?? "Supabase is not configured.");
      return;
    }

    setActionError(null);
    setRequestActionLoading((prev) => ({ ...prev, [request.id]: true }));

    const { error: requestError } = await client.rpc(
      "review_landlord_verification_request",
      {
        request_id: request.id,
        decision: status,
        admin_notes: null,
      },
    );

    if (requestError) {
      setActionError(requestError.message);
      setRequestActionLoading((prev) => ({ ...prev, [request.id]: false }));
      return;
    }

    await loadAdminData(client);
    setRequestActionLoading((prev) => ({ ...prev, [request.id]: false }));
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

      if (profile.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      await loadAdminData(client);
      setLoading(false);
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <AppShell navItems={adminNavItems} title="Trust Center">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="space-y-3">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-5 w-[34rem] max-w-full" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Skeleton className="h-[28rem] w-full" />
            <Skeleton className="h-[28rem] w-full" />
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      navItems={adminNavItems}
      title="Trust Center"
      topNavAction={email ? <Badge>{email}</Badge> : null}
      sidebarFooter={<LogoutButton />}
      className="pb-8"
    >
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          eyebrow="Admin review queue"
          title="Trust & Review Center"
          description="A compact operations desk for approving pending listings and landlord trust requests."
          actions={
            <div className="flex flex-wrap gap-2">
              {dataLoading ? <Badge variant="info">Refreshing</Badge> : null}
              <Badge variant="premium">Admin only</Badge>
            </div>
          }
        />

        {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}
        {listError ? <AlertMessage variant="danger">{listError}</AlertMessage> : null}
        {actionError ? <AlertMessage variant="danger">{actionError}</AlertMessage> : null}

        <section aria-label="Review queue stats" className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-500">
                  Pending listings
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
                  {pendingProperties.length}
                </p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-2 text-violet-700">
                <Building2 className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
              <span className="text-sm text-neutral-500">Property approval queue</span>
              <Badge variant="warning">Review</Badge>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-500">
                  Pending verifications
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
                  {pendingRequests.length}
                </p>
              </div>
              <div className="rounded-xl border border-violet-100 bg-violet-50 p-2 text-violet-700">
                <UserCheck className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
              <span className="text-sm text-neutral-500">Landlord trust queue</span>
              <Badge variant="info">Trust</Badge>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b border-neutral-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                    <CardTitle>Pending property approvals</CardTitle>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">
                    Submitted rentals waiting for marketplace review.
                  </p>
                </div>
                <Badge variant="warning" className="px-3 py-1">
                  {pendingProperties.length} pending
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {dataLoading ? (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : pendingProperties.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No pending listings"
                    description="Submitted properties awaiting admin review will appear here."
                    icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
                    className="p-6"
                  />
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {pendingProperties.map((property) => {
                    const busy = Boolean(propertyActionLoading[property.id]);

                    return (
                      <article
                        key={property.id}
                        className="bg-white p-4 transition-colors hover:bg-neutral-50/70"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="line-clamp-1 text-base font-semibold text-neutral-950">
                                  {property.title}
                                </h3>
                                <StatusBadge status={property.status} />
                              </div>
                              <p className="mt-1 truncate text-sm text-neutral-500">
                                {property.city || "City not specified"} - Landlord {property.landlord_id}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-lg font-semibold tracking-tight text-neutral-950">
                                {formatPrice(property.price)}
                              </p>
                              <p className="text-xs text-neutral-500">
                                Submitted {formatDate(property.created_at)}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-2 text-sm md:grid-cols-4">
                            <div className="rounded-md bg-neutral-50 p-3">
                              <p className="text-xs font-medium uppercase text-neutral-400">
                                City
                              </p>
                              <p className="mt-1 truncate font-medium text-neutral-800">
                                {property.city || "Not specified"}
                              </p>
                            </div>
                            <div className="rounded-md bg-neutral-50 p-3">
                              <p className="text-xs font-medium uppercase text-neutral-400">
                                Landlord
                              </p>
                              <p className="mt-1 truncate font-medium text-neutral-800">
                                {property.landlord_id}
                              </p>
                            </div>
                            <div className="rounded-md bg-neutral-50 p-3">
                              <p className="text-xs font-medium uppercase text-neutral-400">
                                Current status
                              </p>
                              <div className="mt-1">
                                <StatusBadge status={property.status} />
                              </div>
                            </div>
                            <div className="rounded-md bg-neutral-50 p-3">
                              <p className="text-xs font-medium uppercase text-neutral-400">
                                Price
                              </p>
                              <p className="mt-1 font-medium text-neutral-800">
                                {formatPrice(property.price)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() =>
                                updatePropertyStatus(property.id, "rejected")
                              }
                              disabled={busy}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <XCircle className="h-4 w-4" aria-hidden="true" />
                              )}
                              Reject
                            </Button>
                            <Button
                              type="button"
                              variant="success"
                              size="sm"
                              onClick={() =>
                                updatePropertyStatus(property.id, "approved")
                              }
                              disabled={busy}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                              )}
                              Approve
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden shadow-sm">
            <CardHeader className="border-b border-neutral-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-neutral-500" aria-hidden="true" />
                    <CardTitle>Pending landlord verification</CardTitle>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-neutral-500">
                    Host trust requests waiting for admin decision.
                  </p>
                </div>
                <Badge variant="info" className="px-3 py-1">
                  {pendingRequests.length} pending
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {dataLoading ? (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No pending verifications"
                    description="Landlord verification requests awaiting admin review will appear here."
                    icon={<BadgeCheck className="h-5 w-5" aria-hidden="true" />}
                    className="p-6"
                  />
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {pendingRequests.map((request) => {
                    const busy = Boolean(requestActionLoading[request.id]);
                    const landlordName =
                      request.profiles?.full_name || "Landlord name unavailable";

                    return (
                      <article
                        key={request.id}
                        className="bg-white p-4 transition-colors hover:bg-neutral-50/70"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="line-clamp-1 text-base font-semibold text-neutral-950">
                                  {landlordName}
                                </h3>
                                <StatusBadge status={request.status} />
                              </div>
                              <p className="mt-1 truncate text-sm text-neutral-500">
                                Landlord {request.landlord_id}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <p className="text-sm font-medium text-neutral-950">
                                Request date
                              </p>
                              <p className="text-xs text-neutral-500">
                                {formatDate(request.submitted_at)}
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-2 text-sm md:grid-cols-4">
                            <div className="rounded-md bg-neutral-50 p-3">
                              <p className="text-xs font-medium uppercase text-neutral-400">
                                Landlord
                              </p>
                              <p className="mt-1 truncate font-medium text-neutral-800">
                                {landlordName}
                              </p>
                            </div>
                            <div className="rounded-md bg-neutral-50 p-3">
                              <p className="text-xs font-medium uppercase text-neutral-400">
                                Request date
                              </p>
                              <p className="mt-1 font-medium text-neutral-800">
                                {formatDate(request.submitted_at)}
                              </p>
                            </div>
                            <div className="rounded-md bg-neutral-50 p-3">
                              <p className="text-xs font-medium uppercase text-neutral-400">
                                Current status
                              </p>
                              <div className="mt-1">
                                <StatusBadge status={request.status} />
                              </div>
                            </div>
                            <div className="rounded-md bg-neutral-50 p-3">
                              <p className="text-xs font-medium uppercase text-neutral-400">
                                Profile status
                              </p>
                              <p className="mt-1 truncate font-medium text-neutral-800">
                                {request.profiles?.verification_status ||
                                  "Unknown"}
                              </p>
                            </div>
                          </div>

                          {request.notes ? (
                            <div className="rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-600">
                              {request.notes}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => updateVerification(request, "rejected")}
                              disabled={busy}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <XCircle className="h-4 w-4" aria-hidden="true" />
                              )}
                              Reject
                            </Button>
                            <Button
                              type="button"
                              variant="success"
                              size="sm"
                              onClick={() => updateVerification(request, "verified")}
                              disabled={busy}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                              )}
                              Approve
                            </Button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
