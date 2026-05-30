"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogoutButton from "@/app/components/logout-button";
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

    const { error: insertError } = await client
      .from("verification_requests")
      .insert({ landlord_id: landlordId });

    if (insertError) {
      setVerificationSubmitError(insertError.message);
      setVerificationSubmitting(false);
      return;
    }

    await loadVerificationRequests(client, landlordId);
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
      setInquiries((inquiriesData ?? []) as Inquiry[]);
      setReviews((reviewsData ?? []) as Review[]);
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
        <p>Loading landlord dashboard...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Landlord Dashboard</h1>
      {error ? <p role="alert">{error}</p> : null}
      {listError ? <p role="alert">{listError}</p> : null}
      <p>Signed in as: {email ?? "Unknown"}</p>
      <p>Role: landlord</p>
      <p>Verification status: {verificationStatus ?? "Unknown"}</p>
      <p>
        <button type="button" onClick={() => router.push("/dashboard/landlord/properties/new")}>
          Post New Property
        </button>
      </p>
      {properties.length === 0 ? (
        <p>You have not posted any properties yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>City</th>
              <th>Price</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td>{p.city}</td>
                <td>{p.price}</td>
                <td>{p.status}</td>
                <td>{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section aria-label="Inquiries">
        <h2>Recent inquiries</h2>
        {inquiries.length === 0 ? (
          <p>No inquiries yet.</p>
        ) : (
          <ul>
            {inquiries.map((inquiry) => (
              <li key={inquiry.id}>
                <strong>
                  {inquiry.properties?.title || "Property"}
                </strong>
                <div>Renter: {inquiry.renter_id}</div>
                <div>Message: {inquiry.message}</div>
                <div>
                  Sent: {new Date(inquiry.created_at).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p>Replying is not available yet.</p>
      </section>

      <section aria-label="Verification requests">
        <h2>Verification requests</h2>
        {verificationError ? <p role="alert">{verificationError}</p> : null}
        {verificationSubmitError ? <p role="alert">{verificationSubmitError}</p> : null}
        {verificationLoading ? <p>Loading verification requests...</p> : null}
        {!verificationLoading && verificationRequests.length === 0 ? (
          <p>No verification requests yet.</p>
        ) : null}
        {!verificationLoading && verificationRequests.length > 0 ? (
          <ul>
            {verificationRequests.map((request) => (
              <li key={request.id}>
                <div>Status: {request.status}</div>
                <div>
                  Submitted: {new Date(request.submitted_at).toLocaleDateString()}
                </div>
                {request.reviewed_at ? (
                  <div>
                    Reviewed: {new Date(request.reviewed_at).toLocaleDateString()}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {!verificationLoading && verificationStatus === "verified" ? (
          <p>Your account is already verified.</p>
        ) : null}
        {!verificationLoading && hasPendingVerification ? (
          <p>You already have a pending request.</p>
        ) : null}
        <button
          type="button"
          onClick={onRequestVerification}
          disabled={!canRequestVerification}
        >
          {verificationSubmitting ? "Submitting..." : "Request verification"}
        </button>
      </section>

      <section aria-label="Reviews">
        <h2>Recent reviews</h2>
        {reviews.length === 0 ? (
          <p>No reviews yet.</p>
        ) : (
          <ul>
            {reviews.map((review) => (
              <li key={review.id}>
                <strong>{review.properties?.title || "Property"}</strong>
                <div>Renter: {review.renter_id}</div>
                <div>Rating: {review.rating}/5</div>
                <div>Comment: {review.comment || "No comment"}</div>
                <div>
                  Date: {new Date(review.created_at).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <LogoutButton />
    </main>
  );
}
