"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  MailCheck,
  ShieldCheck,
} from "lucide-react";
import { BrandLink, FooterCredit } from "@/app/components/brand/nestora-brand";
import { AlertMessage } from "@/app/components/ui/alert-message";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";

function getResetRedirectUrl() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}/reset-password`;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Enter the email address for your account.");
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setError(supabaseConfigError ?? "Supabase is not configured.");
      return;
    }

    setSubmitting(true);

    const { error: resetError } = await client.auth.resetPasswordForEmail(
      trimmedEmail,
      {
        redirectTo: getResetRedirectUrl(),
      },
    );

    if (resetError) {
      setError(resetError.message);
      setSubmitting(false);
      return;
    }

    setSuccess(
      "If an account exists for that email, a password reset link has been sent.",
    );
    setEmail("");
    setSubmitting(false);
  };

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
              Secure account recovery
            </div>
            <h1 className="mt-8 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-tight text-white sm:text-6xl">
              Reset access without changing your marketplace role.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300 sm:text-lg">
              We will send a secure Supabase recovery link to the account email.
              Renter, landlord, and admin permissions stay attached to the same
              profile.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#2c2c2a] p-5 shadow-2xl shadow-black/20 sm:p-8">
            <div className="mb-8">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm shadow-violet-950/30">
                <MailCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
                Forgot password
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Send reset link
              </h1>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                Use the email connected to your Nestora account.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-semibold text-stone-100">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
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
                {submitting ? "Sending link..." : "Send reset link"}
              </button>
            </form>

            {error ? (
              <AlertMessage variant="danger" className="mt-5">
                {error}
              </AlertMessage>
            ) : null}
            {success ? (
              <AlertMessage variant="success" className="mt-5">
                {success}
              </AlertMessage>
            ) : null}

            <p className="mt-6 text-center text-sm text-stone-300">
              Remembered your password?{" "}
              <Link href="/login" className="font-semibold text-violet-300 hover:text-violet-100">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
      <footer className="bg-[#232321] px-5 py-4 text-center">
        <FooterCredit theme="dark" />
      </footer>
    </main>
  );
}
