"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import LogoutButton from "@/app/components/logout-button";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/profile";

type PendingProperty = {
  id: string;
  landlord_id: string;
  title: string;
  city: string | null;
  price: number;
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

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);
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
      setPendingRequests((requestsResult.data ?? []) as VerificationRequest[]);
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

    const { error: updateError } = await client
      .from("properties")
      .update({ status })
      .eq("id", propertyId);

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

    if (!adminId) {
      setActionError("Admin session is missing.");
      return;
    }

    setActionError(null);
    setRequestActionLoading((prev) => ({ ...prev, [request.id]: true }));

    const { error: requestError } = await client
      .from("verification_requests")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
      })
      .eq("id", request.id);

    if (requestError) {
      setActionError(requestError.message);
      setRequestActionLoading((prev) => ({ ...prev, [request.id]: false }));
      return;
    }

    const { error: profileError } = await client
      .from("profiles")
      .update({ verification_status: status })
      .eq("id", request.landlord_id);

    if (profileError) {
      setActionError(
        `Verification request updated, but profile update failed: ${profileError.message}`,
      );
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
      setAdminId(sessionData.session.user.id);

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
      <main>
        <p>Loading admin dashboard...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Admin Dashboard</h1>
      {error ? <p role="alert">{error}</p> : null}
      {listError ? <p role="alert">{listError}</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      <p>Signed in as: {email ?? "Unknown"}</p>
      <p>Role: admin</p>

      <section aria-label="Pending properties">
        <h2>Pending properties</h2>
        {dataLoading ? <p>Loading pending properties...</p> : null}
        {!dataLoading && pendingProperties.length === 0 ? (
          <p>No pending properties.</p>
        ) : null}
        {!dataLoading && pendingProperties.length > 0 ? (
          <ul>
            {pendingProperties.map((property) => (
              <li key={property.id}>
                <strong>{property.title}</strong>
                <div>City: {property.city || "Not specified"}</div>
                <div>Price: {property.price}</div>
                <div>Landlord ID: {property.landlord_id}</div>
                <div>
                  Submitted: {new Date(property.created_at).toLocaleDateString()}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => updatePropertyStatus(property.id, "approved")}
                    disabled={Boolean(propertyActionLoading[property.id])}
                  >
                    {propertyActionLoading[property.id]
                      ? "Updating..."
                      : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePropertyStatus(property.id, "rejected")}
                    disabled={Boolean(propertyActionLoading[property.id])}
                  >
                    {propertyActionLoading[property.id]
                      ? "Updating..."
                      : "Reject"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-label="Pending verification requests">
        <h2>Pending landlord verification</h2>
        {dataLoading ? <p>Loading verification requests...</p> : null}
        {!dataLoading && pendingRequests.length === 0 ? (
          <p>No pending verification requests.</p>
        ) : null}
        {!dataLoading && pendingRequests.length > 0 ? (
          <ul>
            {pendingRequests.map((request) => (
              <li key={request.id}>
                <strong>Landlord ID: {request.landlord_id}</strong>
                <div>
                  Name: {request.profiles?.full_name || "Not available"}
                </div>
                <div>
                  Current status:{" "}
                  {request.profiles?.verification_status || "Unknown"}
                </div>
                <div>
                  Submitted: {new Date(request.submitted_at).toLocaleDateString()}
                </div>
                {request.notes ? <div>Notes: {request.notes}</div> : null}
                <div>
                  <button
                    type="button"
                    onClick={() => updateVerification(request, "verified")}
                    disabled={Boolean(requestActionLoading[request.id])}
                  >
                    {requestActionLoading[request.id]
                      ? "Updating..."
                      : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateVerification(request, "rejected")}
                    disabled={Boolean(requestActionLoading[request.id])}
                  >
                    {requestActionLoading[request.id]
                      ? "Updating..."
                      : "Reject"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <LogoutButton />
    </main>
  );
}
