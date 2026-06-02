import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateRegistrationEmail, normalizeEmail } from "@/lib/auth/email";
import { validateStrongPassword } from "@/lib/auth/password";

type PublicRole = "renter" | "landlord";

type RegisterRequestBody = {
  fullName?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  turnstileToken?: unknown;
};

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

type TurnstileValidationResponse = {
  success: boolean;
};

const SIGNUP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const SIGNUP_RATE_LIMIT_MAX = 5;
const EMAIL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_RATE_LIMIT_MAX = 3;
const EMAIL_REGISTRATION_COOLDOWN_MS = 5 * 60 * 1000;
const IP_REGISTRATION_COOLDOWN_MS = 60 * 1000;
const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const ipRateLimits = new Map<string, RateLimitRecord>();
const emailRateLimits = new Map<string, RateLimitRecord>();
const registrationCooldowns = new Map<string, number>();

function secondsUntil(timestamp: number) {
  return Math.max(1, Math.ceil((timestamp - Date.now()) / 1000));
}

function cleanupExpiredEntries() {
  const now = Date.now();

  for (const [key, record] of ipRateLimits.entries()) {
    if (record.resetAt <= now) ipRateLimits.delete(key);
  }

  for (const [key, record] of emailRateLimits.entries()) {
    if (record.resetAt <= now) emailRateLimits.delete(key);
  }

  for (const [key, cooldownUntil] of registrationCooldowns.entries()) {
    if (cooldownUntil <= now) registrationCooldowns.delete(key);
  }
}

function consumeRateLimit(
  store: Map<string, RateLimitRecord>,
  key: string,
  maxAttempts: number,
  windowMs: number,
) {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { allowed: true as const };
  }

  if (existing.count >= maxAttempts) {
    return {
      allowed: false as const,
      retryAfterSeconds: secondsUntil(existing.resetAt),
    };
  }

  existing.count += 1;
  store.set(key, existing);
  return { allowed: true as const };
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0];
  return (
    request.headers.get("cf-connecting-ip") ??
    forwardedFor?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function createErrorResponse(
  message: string,
  status: number,
  retryAfterSeconds?: number,
) {
  return NextResponse.json(
    { error: message, retryAfterSeconds },
    {
      status,
      headers: retryAfterSeconds
        ? { "Retry-After": String(retryAfterSeconds) }
        : undefined,
    },
  );
}

async function validateTurnstileToken(token: string, remoteIp: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return {
      success: false,
      configurationError: true,
    };
  }

  let response: Response;
  try {
    response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: remoteIp === "unknown" ? undefined : remoteIp,
        idempotency_key: crypto.randomUUID(),
      }),
    });
  } catch {
    return { success: false };
  }

  if (!response.ok) {
    return { success: false };
  }

  const result = (await response.json()) as TurnstileValidationResponse;
  return { success: result.success };
}

export async function POST(request: Request) {
  cleanupExpiredEntries();

  let body: RegisterRequestBody;
  try {
    body = (await request.json()) as RegisterRequestBody;
  } catch {
    return createErrorResponse("Invalid registration request.", 400);
  }

  const clientIp = getClientIp(request);
  const fullName = getString(body.fullName).trim();
  const email = normalizeEmail(getString(body.email));
  const password = getString(body.password);
  const role = getString(body.role);
  const turnstileToken = getString(body.turnstileToken);

  const ipLimit = consumeRateLimit(
    ipRateLimits,
    clientIp,
    SIGNUP_RATE_LIMIT_MAX,
    SIGNUP_RATE_LIMIT_WINDOW_MS,
  );
  if (!ipLimit.allowed) {
    return createErrorResponse(
      "Too many registration attempts. Please wait before trying again.",
      429,
      ipLimit.retryAfterSeconds,
    );
  }

  if (!fullName) {
    return createErrorResponse("Full name is required.", 400);
  }

  const emailValidation = validateRegistrationEmail(email);
  if (!emailValidation.isValid) {
    return createErrorResponse(
      emailValidation.message ?? "Enter a valid email address.",
      400,
    );
  }

  const emailLimit = consumeRateLimit(
    emailRateLimits,
    email,
    EMAIL_RATE_LIMIT_MAX,
    EMAIL_RATE_LIMIT_WINDOW_MS,
  );
  if (!emailLimit.allowed) {
    return createErrorResponse(
      "Too many registration attempts for this email. Please wait before trying again.",
      429,
      emailLimit.retryAfterSeconds,
    );
  }

  const emailCooldown = registrationCooldowns.get(`email:${email}`);
  if (emailCooldown && emailCooldown > Date.now()) {
    return createErrorResponse(
      "A registration email was recently requested. Please wait before trying again.",
      429,
      secondsUntil(emailCooldown),
    );
  }

  const ipCooldown = registrationCooldowns.get(`ip:${clientIp}`);
  if (ipCooldown && ipCooldown > Date.now()) {
    return createErrorResponse(
      "Please wait before creating another account.",
      429,
      secondsUntil(ipCooldown),
    );
  }

  if (role !== "renter" && role !== "landlord") {
    return createErrorResponse("Invalid role selection.", 400);
  }

  const passwordValidation = validateStrongPassword(password);
  if (!passwordValidation.isValid) {
    return createErrorResponse(
      `Password is not strong enough. Missing: ${passwordValidation.messages.join(", ")}.`,
      400,
    );
  }

  if (!turnstileToken || turnstileToken.length > 2048) {
    return createErrorResponse("Complete human verification before registering.", 400);
  }

  const turnstileValidation = await validateTurnstileToken(
    turnstileToken,
    clientIp,
  );

  if ("configurationError" in turnstileValidation) {
    return createErrorResponse(
      "Human verification is not configured on the server.",
      500,
    );
  }

  if (!turnstileValidation.success) {
    return createErrorResponse(
      "Human verification failed. Please retry the challenge.",
      400,
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return createErrorResponse("Supabase is not configured.", 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: turnstileToken,
      data: {
        full_name: fullName,
        role: role as PublicRole,
      },
    },
  });

  if (error) {
    return createErrorResponse(error.message, 400);
  }

  if (!data.user) {
    return createErrorResponse("Signup failed. Please try again.", 500);
  }

  registrationCooldowns.set(
    `email:${email}`,
    Date.now() + EMAIL_REGISTRATION_COOLDOWN_MS,
  );
  registrationCooldowns.set(
    `ip:${clientIp}`,
    Date.now() + IP_REGISTRATION_COOLDOWN_MS,
  );

  return NextResponse.json(
    {
      userId: data.user.id,
      session: data.session
        ? {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          }
        : null,
      requiresEmailConfirmation: !data.session,
    },
    { status: 201 },
  );
}
