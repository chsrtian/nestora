"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, KeyRound, Loader2 } from "lucide-react";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import { AlertMessage } from "../components/ui/alert-message";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { FormField } from "../components/ui/form-field";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";

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
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F5] px-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-5 p-6">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F7F5] text-neutral-950">
      <header className="border-b border-neutral-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight text-neutral-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-950 text-white">
              <Home className="h-4 w-4" aria-hidden="true" />
            </span>
            Rental Marketplace
          </Link>
          <Link href="/register" className="text-sm font-medium text-neutral-600 hover:text-neutral-950">
            Create account
          </Link>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
        <div className="hidden lg:block">
          <p className="text-sm font-medium text-neutral-500">Secure rental workspace</p>
          <h1 className="mt-4 max-w-2xl text-5xl font-semibold tracking-tight text-neutral-950">
            Sign in to manage your rental search or listings.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-neutral-600">
            One account for browsing approved rentals, sending inquiries, managing listings, and reviewing trust
            workflows.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="font-semibold text-neutral-950">Renters</p>
              <p className="mt-1 text-neutral-500">Search and inquire.</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="font-semibold text-neutral-950">Landlords</p>
              <p className="mt-1 text-neutral-500">Manage listings.</p>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <p className="font-semibold text-neutral-950">Admin Review</p>
              <p className="mt-1 text-neutral-500">Handled by authorized project admins.</p>
            </div>
          </div>
        </div>

        <Card className="w-full shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-8">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-neutral-950 text-white">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Welcome back</h1>
              <p className="mt-2 text-sm leading-6 text-neutral-500">Sign in to your rental marketplace account.</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <FormField label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </FormField>
              <FormField label="Password" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                />
              </FormField>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {submitting ? "Signing in..." : "Sign in"}
              </Button>
            </form>

            {error ? (
              <AlertMessage variant="danger" className="mt-5">
                {error}
              </AlertMessage>
            ) : null}

            <p className="mt-6 text-center text-sm text-neutral-500">
              No account?{" "}
              <Link href="/register" className="font-medium text-neutral-950 hover:underline">
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
