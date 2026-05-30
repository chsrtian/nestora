"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { clearAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import { AlertMessage } from "./ui/alert-message";

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
    <div className="space-y-2">
      <Button type="button" onClick={onLogout} disabled={submitting} variant="secondary" className="w-full">
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {submitting ? "Signing out..." : "Sign out"}
      </Button>
      {error ? <AlertMessage variant="danger">{error}</AlertMessage> : null}
    </div>
  );
}
