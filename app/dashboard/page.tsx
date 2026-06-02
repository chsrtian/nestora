"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/app/components/brand/nestora-brand";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { ensureProfile, type ProfileRole } from "@/lib/supabase/profile";

const WORKSPACE_TRANSITION_MS = 900;

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
      const redirectToWorkspace = async (path: string) => {
        await new Promise((resolve) =>
          window.setTimeout(resolve, WORKSPACE_TRANSITION_MS),
        );
        if (!isMounted) return;
        router.replace(path);
      };

      if (role === "renter") {
        await redirectToWorkspace("/dashboard/renter");
        return;
      }
      if (role === "landlord") {
        await redirectToWorkspace("/dashboard/landlord");
        return;
      }
      if (role === "admin") {
        await redirectToWorkspace("/dashboard/admin");
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
      <main className="flex min-h-screen items-center justify-center bg-[#232321] px-5 text-white">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#2c2c2a] p-7 text-center shadow-2xl shadow-black/25">
          <BrandMark className="mx-auto h-14 w-14" priority />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
            Signing in...
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Loading your workspace
          </h1>
          <p className="mt-2 text-sm leading-6 text-stone-300">
            Preparing the right dashboard for your account.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-stone-300">
            <Loader2 className="h-4 w-4 animate-spin text-violet-300" aria-hidden="true" />
            <span>Almost there</span>
          </div>
          <div className="mt-6 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-violet-400" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F7F5] px-5 text-neutral-950">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <BrandMark className="h-10 w-10 border-neutral-200" />
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
        </div>
        {error ? (
          <p role="alert" className="mt-4 text-sm leading-6 text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
