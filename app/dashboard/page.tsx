"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile, type ProfileRole } from "@/lib/supabase/profile";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      const role = profile.role as ProfileRole;
      if (role === "renter") {
        router.replace("/dashboard/renter");
        return;
      }
      if (role === "landlord") {
        router.replace("/dashboard/landlord");
        return;
      }
      if (role === "admin") {
        router.replace("/dashboard/admin");
        return;
      }

      setError("Unknown role. Please contact support.");
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
        <p>Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Dashboard</h1>
      {error ? <p role="alert">{error}</p> : null}
    </main>
  );
}
