"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { BrandLink, FooterCredit } from "@/app/components/brand/nestora-brand";
import { AlertMessage } from "@/app/components/ui/alert-message";
import { Skeleton } from "@/app/components/ui/skeleton";
import { clearAuthCookie } from "@/lib/auth/cookies";
import {
  getPasswordRuleStatuses,
  validateStrongPassword,
} from "@/lib/auth/password";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";

function readRecoveryUrlError() {
  if (typeof window === "undefined") {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash,
  );

  return (
    searchParams.get("error_description") ??
    hashParams.get("error_description") ??
    searchParams.get("error") ??
    hashParams.get("error")
  );
}

function hasRecoveryUrlParams() {
  if (typeof window === "undefined") {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash,
  );

  return (
    searchParams.get("type") === "recovery" ||
    hashParams.get("type") === "recovery" ||
    searchParams.has("code") ||
    hashParams.has("access_token")
  );
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkReady, setLinkReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordRuleStatuses = getPasswordRuleStatuses(password);

  useEffect(() => {
    let isMounted = true;

    const client = getSupabaseClient();
    if (!client) {
      Promise.resolve().then(() => {
        if (!isMounted) return;
        setError(supabaseConfigError ?? "Supabase is not configured.");
        setCheckingLink(false);
      });
      return () => {
        isMounted = false;
      };
    }

    const recoveryUrlError = readRecoveryUrlError();
    if (recoveryUrlError) {
      Promise.resolve().then(() => {
        if (!isMounted) return;
        setError(recoveryUrlError);
        setCheckingLink(false);
      });
      return () => {
        isMounted = false;
      };
    }

    const hasRecoveryParams = hasRecoveryUrlParams();
    const { data: authListener } = client.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        if (event === "PASSWORD_RECOVERY" && session) {
          setError(null);
          setSuccess(null);
          setLinkReady(true);
          setCheckingLink(false);
        }
      },
    );

    const verifySession = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 250));

      const { data, error: sessionError } = await client.auth.getSession();
      if (!isMounted) return;

      if (sessionError) {
        setError(sessionError.message);
        setCheckingLink(false);
        return;
      }

      if (data.session) {
        setLinkReady(true);
        setCheckingLink(false);
        return;
      }

      setError(
        hasRecoveryParams
          ? "This reset link could not be verified. Please request a new password reset email."
          : "Open the password reset link from your email to continue.",
      );
      setCheckingLink(false);
    };

    verifySession();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!linkReady) {
      setError("Open the password reset link from your email to continue.");
      return;
    }

    const passwordValidation = validateStrongPassword(password);
    if (!passwordValidation.isValid) {
      setError(
        `Password is not strong enough. Missing: ${passwordValidation.messages.join(", ")}.`,
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setError(supabaseConfigError ?? "Supabase is not configured.");
      return;
    }

    setSubmitting(true);

    const { error: updateError } = await client.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    await client.auth.signOut();
    clearAuthCookie();
    setPassword("");
    setConfirmPassword("");
    setLinkReady(false);
    setSuccess("Password updated. Sign in again with your new password.");
    setSubmitting(false);
  };

  if (checkingLink) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#232321] px-5 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2c2c2a] p-6 shadow-2xl shadow-black/20">
          <div className="space-y-5">
            <Skeleton className="h-8 w-48 bg-white/10" />
            <Skeleton className="h-12 w-full bg-white/10" />
            <Skeleton className="h-12 w-full bg-white/10" />
            <Skeleton className="h-12 w-full bg-white/10" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#232321] text-white">
      <header className="border-b border-white/10 bg-[#292927]/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <BrandLink className="text-lg" />
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5 sm:px-5"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Sign in
          </Link>
        </div>
      </header>

      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.18),transparent_34rem)]">
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[1fr_0.78fr] lg:px-8 lg:py-16">
          <div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Protected password reset
            </div>
            <h1 className="mt-8 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-tight text-white sm:text-6xl">
              Choose a stronger password for your account.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300 sm:text-lg">
              The reset link authorizes one secure password update through
              Supabase. After updating, sign in again to continue.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#2c2c2a] p-5 shadow-2xl shadow-black/20 sm:p-8">
            <div className="mb-8">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm shadow-violet-950/30">
                <KeyRound className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
                Reset password
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Set new password
              </h1>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                Use a password that meets every strength requirement.
              </p>
            </div>

            {success ? (
              <AlertMessage variant="success" className="mb-5">
                {success}
              </AlertMessage>
            ) : null}

            {error ? (
              <AlertMessage variant="danger" className="mb-5">
                {error}
              </AlertMessage>
            ) : null}

            {linkReady ? (
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="password" className="block text-sm font-semibold text-stone-100">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    name="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={12}
                    autoComplete="new-password"
                    aria-describedby="password-requirements"
                    placeholder="Create a strong password"
                    disabled={submitting}
                    className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-stone-500 focus:border-violet-300/70 focus:ring-2 focus:ring-violet-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <ul
                    id="password-requirements"
                    className="grid gap-1 pt-2 text-xs leading-5 text-stone-400 sm:grid-cols-2"
                  >
                    {passwordRuleStatuses.map((rule) => (
                      <li
                        key={rule.id}
                        className={rule.met ? "flex items-center gap-2 text-emerald-300" : "flex items-center gap-2"}
                      >
                        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-stone-100">
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={12}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    disabled={submitting}
                    className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-stone-500 focus:border-violet-300/70 focus:ring-2 focus:ring-violet-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white px-5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-stone-100 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                  {submitting ? "Updating password..." : "Update password"}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <Link
                  href="/forgot-password"
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/15 bg-white px-5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-stone-100"
                >
                  Request a new reset link
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5"
                >
                  Back to sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
      <footer className="bg-[#232321] px-5 py-4 text-center">
        <FooterCredit theme="dark" />
      </footer>
    </main>
  );
}
