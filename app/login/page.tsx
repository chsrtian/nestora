"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";
import { BrandLink, FooterCredit } from "@/app/components/brand/nestora-brand";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { AlertMessage } from "../components/ui/alert-message";
import { Skeleton } from "../components/ui/skeleton";

const roleHighlights = [
  {
    title: "Renters",
    description: "Browse approved rentals and send inquiries.",
    icon: Search,
  },
  {
    title: "Landlords",
    description: "Manage listings and renter conversations.",
    icon: Building2,
  },
  {
    title: "Admin Review",
    description: "Review listings before renter visibility.",
    icon: ShieldCheck,
  },
];

const trustItems = [
  "Verified listings only",
  "Admin-reviewed listings",
  "Direct landlord contact",
];

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
      Promise.resolve().then(() => {
        if (!isMounted) return;
        setError(supabaseConfigError ?? "Supabase is not configured.");
        setCheckingSession(false);
      });
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
      <main className="flex min-h-screen items-center justify-center bg-[#232321] px-5 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2c2c2a] p-6 shadow-2xl shadow-black/20">
          <div className="space-y-5">
            <Skeleton className="h-8 w-40 bg-white/10" />
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
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5 sm:px-5"
          >
            Create account
          </Link>
        </div>
      </header>

      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.18),transparent_34rem)]">
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[1fr_0.82fr] lg:px-8 lg:py-16">
          <div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Verified rental access
            </div>
            <h1 className="mt-8 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-tight text-white sm:text-6xl">
              Sign in to continue your Nestora workflow.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300 sm:text-lg">
              One account connects renters, landlords, and review teams across
              approved listings, inquiries, map browsing, and matching tools.
            </p>

            <div className="mt-8 grid gap-4 text-sm font-semibold text-stone-300 sm:grid-cols-3">
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
              {roleHighlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.title} className="bg-[#2a2a28] p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h2 className="mt-4 text-base font-semibold text-white">
                      {item.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-stone-300">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#2c2c2a] p-5 shadow-2xl shadow-black/20 sm:p-8">
            <div className="mb-8">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm shadow-violet-950/30">
                <KeyRound className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
                Secure sign in
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Welcome back
              </h1>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                Sign in to your Nestora account.
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
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-stone-500 focus:border-violet-300/70 focus:ring-2 focus:ring-violet-400/20"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="password" className="block text-sm font-semibold text-stone-100">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-semibold text-violet-300 hover:text-violet-100"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-stone-500 focus:border-violet-300/70 focus:ring-2 focus:ring-violet-400/20"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white px-5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-stone-100 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            {error ? (
              <AlertMessage variant="danger" className="mt-5">
                {error}
              </AlertMessage>
            ) : null}

            <p className="mt-6 text-center text-sm text-stone-300">
              No account?{" "}
              <Link href="/register" className="font-semibold text-violet-300 hover:text-violet-100">
                Create one
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
