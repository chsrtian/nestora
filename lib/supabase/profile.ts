import type { SupabaseClient } from "@supabase/supabase-js";

type PublicRole = "renter" | "landlord";
export type ProfileRole = PublicRole | "admin";

type RegistrationIntent = {
  fullName: string;
  role: PublicRole;
};

const REGISTRATION_INTENT_KEY = "rental_auth_intent";

export function saveRegistrationIntent(intent: RegistrationIntent) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(REGISTRATION_INTENT_KEY, JSON.stringify(intent));
}

export function clearRegistrationIntent() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(REGISTRATION_INTENT_KEY);
}

export function loadRegistrationIntent(): RegistrationIntent | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(REGISTRATION_INTENT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RegistrationIntent> | null;
    if (!parsed || typeof parsed.fullName !== "string") {
      return null;
    }
    if (parsed.role !== "renter" && parsed.role !== "landlord") {
      return null;
    }

    return {
      fullName: parsed.fullName,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

export async function ensureProfile(
  client: SupabaseClient,
  userId: string,
): Promise<{
  profile?: { role: ProfileRole; verification_status: string };
  created?: boolean;
  error?: string;
}> {
  const { data: profile, error } = await client
    .from("profiles")
    .select("role, verification_status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }

  if (profile) {
    return { profile: profile as { role: ProfileRole; verification_status: string }, created: false };
  }

  const intent = loadRegistrationIntent();
  const role: PublicRole = intent?.role === "landlord" ? "landlord" : "renter";
  const fullName = intent?.fullName?.trim() || null;

  const { error: insertError } = await client.from("profiles").insert({
    id: userId,
    role,
    verification_status: "unverified",
    full_name: fullName,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  clearRegistrationIntent();

  return {
    profile: { role, verification_status: "unverified" },
    created: true,
  };
}
