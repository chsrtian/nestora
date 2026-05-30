"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogout = async () => {
    const client = getSupabaseClient();
    if (!client) {
      setError(supabaseConfigError ?? "Supabase is not configured.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error } = await client.auth.signOut();
    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    clearAuthCookie();

    router.replace("/login");
  };

  return (
    <div>
      <button type="button" onClick={onLogout} disabled={submitting}>
        {submitting ? "Signing out..." : "Sign out"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
