"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import {
  ensureProfile,
  saveRegistrationIntent,
} from "@/lib/supabase/profile";

type PublicRole = "renter" | "landlord";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PublicRole>("renter");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    setSuccess(null);
    setSubmitting(true);

    if (role !== "renter" && role !== "landlord") {
      setError("Invalid role selection.");
      setSubmitting(false);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setError(supabaseConfigError ?? "Supabase is not configured.");
      setSubmitting(false);
      return;
    }

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    if (!data.user) {
      setError("Signup failed. Please try again.");
      setSubmitting(false);
      return;
    }

    saveRegistrationIntent({ fullName, role });

    if (!data.session) {
      setSuccess(
        "Check your email to confirm your account, then sign in to finish setup.",
      );
      setSubmitting(false);
      return;
    }

    const { error: profileError } = await ensureProfile(client, data.user.id);
    if (profileError) {
      setError(
        "Profile creation failed. Please sign in again to finish setup.",
      );
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
      <h1>Create account</h1>
      <form onSubmit={onSubmit}>
        <label>
          Full name
          <input
            type="text"
            name="fullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            autoComplete="name"
          />
        </label>
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
            autoComplete="new-password"
          />
        </label>
        <label>
          Role
          <select
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as PublicRole)}
          >
            <option value="renter">Renter</option>
            <option value="landlord">Landlord</option>
          </select>
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {success ? <p role="status">{success}</p> : null}
      <p>
        Already registered? <Link href="/login">Sign in</Link>
      </p>
      <p>Admin accounts must be created manually by the project owner.</p>
    </main>
  );
}
