"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Loader2,
  Search,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { BrandLink, FooterCredit } from "@/app/components/brand/nestora-brand";
import { TurnstileWidget } from "@/app/components/auth/turnstile-widget";
import { setAuthCookie } from "@/lib/auth/cookies";
import {
  normalizeEmail,
  validateRegistrationEmail,
} from "@/lib/auth/email";
import { getSupabaseClient, supabaseConfigError } from "@/lib/supabase/client";
import {
  ensureProfile,
  saveRegistrationIntent,
} from "@/lib/supabase/profile";
import { AlertMessage } from "../components/ui/alert-message";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../components/ui/utils";
import {
  getPasswordRuleStatuses,
  validateStrongPassword,
} from "@/lib/auth/password";

type PublicRole = "renter" | "landlord";

type RegisterApiResponse = {
  userId?: string;
  session?: {
    access_token: string;
    refresh_token: string;
  } | null;
  requiresEmailConfirmation?: boolean;
  error?: string;
  retryAfterSeconds?: number;
};

const REGISTRATION_COOLDOWN_KEY = "rental_registration_cooldown_until";
const SUCCESS_COOLDOWN_SECONDS = 300;
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const marketplaceAccess = [
  "Renter accounts can browse approved rentals and send inquiries.",
  "Landlord accounts can submit listings for admin review.",
  "Admin accounts remain manually created by the project owner.",
];

function getStoredCooldownUntil() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = Number(localStorage.getItem(REGISTRATION_COOLDOWN_KEY));
  return Number.isFinite(storedValue) && storedValue > Date.now()
    ? storedValue
    : null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<PublicRole>("renter");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(
    getStoredCooldownUntil,
  );
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const passwordRuleStatuses = getPasswordRuleStatuses(password);
  const cooldownSeconds = cooldownUntil
    ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
    : 0;
  const isCoolingDown = cooldownSeconds > 0;
  const isSubmitDisabled =
    submitting ||
    registrationComplete ||
    isCoolingDown ||
    !turnstileSiteKey ||
    !turnstileToken;

  const startCooldown = (seconds: number) => {
    const nextCooldownUntil = Date.now() + seconds * 1000;
    setCooldownUntil(nextCooldownUntil);
    if (typeof window !== "undefined") {
      localStorage.setItem(
        REGISTRATION_COOLDOWN_KEY,
        String(nextCooldownUntil),
      );
    }
  };

  const resetCaptcha = () => {
    setTurnstileToken(null);
    setCaptchaResetSignal((current) => current + 1);
  };

  const handleTurnstileError = useCallback((message: string) => {
    setError(message);
  }, []);

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

  useEffect(() => {
    if (!cooldownUntil) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [cooldownUntil]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (submitting || registrationComplete) {
      return;
    }

    if (isCoolingDown) {
      setError(`Please wait ${cooldownSeconds} seconds before trying again.`);
      return;
    }

    setSubmitting(true);

    if (role !== "renter" && role !== "landlord") {
      setError("Invalid role selection.");
      setSubmitting(false);
      return;
    }

    const trimmedFullName = fullName.trim();
    if (!trimmedFullName) {
      setError("Full name is required.");
      setSubmitting(false);
      return;
    }

    const trimmedEmail = normalizeEmail(email);
    const emailValidation = validateRegistrationEmail(trimmedEmail);
    if (!emailValidation.isValid) {
      setError(emailValidation.message ?? "Enter a valid email address.");
      setSubmitting(false);
      return;
    }

    const passwordValidation = validateStrongPassword(password);
    if (!passwordValidation.isValid) {
      setError(
        `Password is not strong enough. Missing: ${passwordValidation.messages.join(", ")}.`,
      );
      setSubmitting(false);
      return;
    }

    if (!turnstileSiteKey) {
      setError("Human verification is not configured.");
      setSubmitting(false);
      return;
    }

    if (!turnstileToken) {
      setError("Complete human verification before registering.");
      setSubmitting(false);
      return;
    }

    let result: RegisterApiResponse;
    let response: Response;
    try {
      response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: trimmedFullName,
          email: trimmedEmail,
          password,
          role,
          turnstileToken,
        }),
      });
      result = (await response.json()) as RegisterApiResponse;
    } catch {
      setError("Registration failed. Please check your connection and try again.");
      resetCaptcha();
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      if (result.retryAfterSeconds) {
        startCooldown(result.retryAfterSeconds);
      }
      setError(result.error ?? "Signup failed. Please try again.");
      resetCaptcha();
      setSubmitting(false);
      return;
    }

    if (!result.userId) {
      setError("Signup failed. Please try again.");
      resetCaptcha();
      setSubmitting(false);
      return;
    }

    saveRegistrationIntent({ fullName: trimmedFullName, role });

    if (!result.session) {
      setSuccess(
        "Check your email to confirm your account, then sign in to finish setup.",
      );
      setRegistrationComplete(true);
      startCooldown(SUCCESS_COOLDOWN_SECONDS);
      setSubmitting(false);
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setError(supabaseConfigError ?? "Supabase is not configured.");
      resetCaptcha();
      setSubmitting(false);
      return;
    }

    const { error: sessionError } = await client.auth.setSession(result.session);
    if (sessionError) {
      setError("Account created. Please sign in to finish setup.");
      resetCaptcha();
      setSubmitting(false);
      return;
    }

    const { error: profileError } = await ensureProfile(client, result.userId);
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
      <main className="flex min-h-screen items-center justify-center bg-[#232321] px-5 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#2c2c2a] p-6 shadow-2xl shadow-black/20">
          <div className="space-y-5">
            <Skeleton className="h-8 w-48 bg-white/10" />
            <Skeleton className="h-12 w-full bg-white/10" />
            <Skeleton className="h-12 w-full bg-white/10" />
            <Skeleton className="h-12 w-full bg-white/10" />
            <Skeleton className="h-24 w-full bg-white/10" />
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
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/5 sm:px-5"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,91,255,0.18),transparent_34rem)]">
        <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-start gap-8 px-5 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.88fr)] lg:px-8 lg:py-10">
          <div className="lg:pt-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Verified rental discovery
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
              Find smarter rentals with Nestora.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300 sm:text-lg">
              Start as a renter to browse approved listings and send inquiries,
              or join as a landlord to submit properties for admin review.
            </p>

            <div className="mt-6 space-y-3 text-sm font-semibold text-stone-300">
              {marketplaceAccess.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-2xl border border-white/10 bg-[#2c2c2a] p-4 shadow-2xl shadow-black/10 sm:p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet-200">
                Choose your access
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <Search className="h-5 w-5 text-violet-300" aria-hidden="true" />
                  <h2 className="mt-3 text-base font-semibold text-white">
                    Renter
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-stone-300">
                    Search approved rentals, inquire, and review after contact.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <Building2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
                  <h2 className="mt-3 text-base font-semibold text-white">
                    Landlord
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-stone-300">
                    Post properties for review and manage renter inquiries.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#2c2c2a] p-5 shadow-2xl shadow-black/20 sm:p-8">
            <div className="mb-8">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-violet-500 text-white shadow-sm shadow-violet-950/30">
                <UserPlus className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-200">
                Create account
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Join Nestora
              </h1>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                Choose the role that matches how you will use Nestora.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="fullName" className="block text-sm font-semibold text-stone-100">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Your name"
                  disabled={submitting || registrationComplete}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-stone-500 focus:border-violet-300/70 focus:ring-2 focus:ring-violet-400/20"
                />
              </div>
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
                  disabled={submitting || registrationComplete}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-stone-500 focus:border-violet-300/70 focus:ring-2 focus:ring-violet-400/20"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-stone-100">
                  Password
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
                  placeholder="Create a password"
                  disabled={submitting || registrationComplete}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base text-white outline-none transition placeholder:text-stone-500 focus:border-violet-300/70 focus:ring-2 focus:ring-violet-400/20"
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
                <p className="text-sm font-semibold text-stone-100">Role</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRole("renter")}
                    disabled={submitting || registrationComplete}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      role === "renter"
                        ? "border-violet-300/70 bg-violet-400/15 text-white"
                        : "border-white/10 bg-white/[0.04] text-stone-300 hover:border-white/20 hover:bg-white/[0.07]",
                    )}
                    aria-pressed={role === "renter"}
                  >
                    <Search className="h-5 w-5" aria-hidden="true" />
                    <span className="mt-3 block text-sm font-semibold">Renter</span>
                    <span className="mt-1 block text-sm leading-6 text-stone-300">
                      Search and inquire about approved rentals.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("landlord")}
                    disabled={submitting || registrationComplete}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-colors",
                      role === "landlord"
                        ? "border-violet-300/70 bg-violet-400/15 text-white"
                        : "border-white/10 bg-white/[0.04] text-stone-300 hover:border-white/20 hover:bg-white/[0.07]",
                    )}
                    aria-pressed={role === "landlord"}
                  >
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                    <span className="mt-3 block text-sm font-semibold">Landlord</span>
                    <span className="mt-1 block text-sm leading-6 text-stone-300">
                      Post properties and manage renter inquiries.
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-stone-100">
                  Human verification
                </p>
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  disabled={submitting || registrationComplete}
                  resetSignal={captchaResetSignal}
                  onTokenChange={setTurnstileToken}
                  onError={handleTurnstileError}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white px-5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-stone-100 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {submitting
                  ? "Creating account..."
                  : isCoolingDown
                    ? `Try again in ${cooldownSeconds}s`
                    : registrationComplete
                      ? "Check your email"
                      : "Create account"}
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

            <div className="mt-6 space-y-3 text-center text-sm text-stone-300">
              <p>
                Already registered?{" "}
                <Link href="/login" className="font-semibold text-violet-300 hover:text-violet-100">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
      <footer className="bg-[#232321] px-5 py-4 text-center">
        <FooterCredit theme="dark" />
      </footer>
    </main>
  );
}
