"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Home, Loader2, Search } from "lucide-react";
import { setAuthCookie } from "@/lib/auth/cookies";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import {
  ensureProfile,
  saveRegistrationIntent,
} from "@/lib/supabase/profile";
import { AlertMessage } from "../components/ui/alert-message";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { FormField } from "../components/ui/form-field";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../components/ui/utils";

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
      <main className="flex min-h-screen items-center justify-center bg-[#F7F7F5] px-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-5 p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
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
          <Link href="/login" className="text-sm font-medium text-neutral-600 hover:text-neutral-950">
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_480px] lg:px-8">
        <div className="hidden lg:block">
          <p className="text-sm font-medium text-neutral-500">Join the rental marketplace</p>
          <h1 className="mt-4 max-w-2xl text-5xl font-semibold tracking-tight text-neutral-950">
            Start as a renter or list your first property.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-neutral-600">
            Create a renter account to browse approved rentals, or join as a landlord to submit listings for review
            and verification.
          </p>
          <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">
            <p className="text-sm font-semibold text-neutral-950">Marketplace access</p>
            <div className="mt-4 grid gap-3">
              <div className="flex items-start gap-3">
                <Search className="mt-1 h-4 w-4 text-neutral-500" aria-hidden="true" />
                <p className="text-sm leading-6 text-neutral-500">Renters can search approved rentals, inquire, and review after contact.</p>
              </div>
              <div className="flex items-start gap-3">
                <Building2 className="mt-1 h-4 w-4 text-neutral-500" aria-hidden="true" />
                <p className="text-sm leading-6 text-neutral-500">Landlords can post properties for admin review and request verification.</p>
              </div>
            </div>
          </div>
        </div>

        <Card className="w-full shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">Create your account</h1>
              <p className="mt-2 text-sm leading-6 text-neutral-500">Choose the role that matches how you will use the marketplace.</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <FormField label="Full name" htmlFor="fullName">
                <Input
                  id="fullName"
                  type="text"
                  name="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Your name"
                />
              </FormField>
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
                  autoComplete="new-password"
                  placeholder="Create a password"
                />
              </FormField>

              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-900">Role</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRole("renter")}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      role === "renter"
                        ? "border-neutral-950 bg-white text-neutral-950"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300 hover:bg-white",
                    )}
                    aria-pressed={role === "renter"}
                  >
                    <Search className="h-5 w-5" aria-hidden="true" />
                    <span className="mt-3 block text-sm font-semibold">Renter</span>
                    <span className="mt-1 block text-sm leading-6 text-neutral-500">Search and inquire about approved rentals.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("landlord")}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      role === "landlord"
                        ? "border-neutral-950 bg-white text-neutral-950"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-neutral-300 hover:bg-white",
                    )}
                    aria-pressed={role === "landlord"}
                  >
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                    <span className="mt-3 block text-sm font-semibold">Landlord</span>
                    <span className="mt-1 block text-sm leading-6 text-neutral-500">Post properties and manage renter inquiries.</span>
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {submitting ? "Creating account..." : "Create account"}
              </Button>
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

            <div className="mt-6 space-y-3 text-center text-sm text-neutral-500">
              <p>
                Already registered?{" "}
                <Link href="/login" className="font-medium text-neutral-950 hover:underline">
                  Sign in
                </Link>
              </p>
              <p>Admin accounts must be created manually by the project owner.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
