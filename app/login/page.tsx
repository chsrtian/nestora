"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const client = getSupabaseClient();
    if (!client) {
      setError(supabaseConfigError ?? "Supabase is not configured.");
      setCheckingSession(false);
      return () => {
        isMounted = false;
      };
    }

    client.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        setError(error.message);
        setCheckingSession(false);
        return;
      }

      if (data.session) {
        setAuthCookie();
        router.replace("/dashboard");
        return;
      }

      setCheckingSession(false);
    });

    return () => {
      isMounted = false;
    };
  }, [router]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const client = getSupabaseClient();
    if (!client) {
      setError(supabaseConfigError ?? "Supabase is not configured.");
      setSubmitting(false);
      return;
    }

    const { error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setAuthCookie();
    router.replace("/dashboard");
  };

  if (checkingSession) {
    return (
      <main>
        <p>Checking session...</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Login</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      <p>
        No account? <Link href="/register">Create one</Link>
      </p>
    </main>
  );
}
