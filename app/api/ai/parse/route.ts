import { NextRequest, NextResponse } from "next/server";

const MODELS = [
  "openai/gpt-oss-120b:free",
  "deepseek/deepseek-chat-v3:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
];

const SYSTEM_PROMPT = `You are an intent classifier and rental filter extractor.

STEP 1 - INTENT CLASSIFICATION:
First classify the user's message into ONE intent:
- "rental_search": A new, explicit request for rental properties (e.g., "boarding house under 2500", "apartment near CSU with wifi", "naa bay apartment duol sa CSU").
- "rental_followup": A partial request that relies on previous rental search context (e.g., "under 2500", "with parking", "duol sa mall").
- "greeting": Simple greetings or small talk (e.g., "hi", "hello", "hey", "good morning", "kumusta").
- "unrelated": Questions or topics outside the rental domain (e.g., "what is your favorite food?", "unsa imong favorite food?", "tell me a joke", "what's the weather?").
- "spam_or_gibberish": Nonsense, spam, or non-linguistic input (e.g., "asdfgh", "haha", "xyz123", random characters).

LANDMARK ALIAS DICTIONARY (treat these as landmarks, NOT cities):
- "CSU" → "Caraga State University - Cabadbaran Campus"
- "Caraga State University" → "Caraga State University - Cabadbaran Campus"
- "Caraga State University Cabadbaran" → "Caraga State University - Cabadbaran Campus"
- "CSU Cabadbaran" → "Caraga State University - Cabadbaran Campus"
- "Caraga State University - Cabadbaran Campus" → "Caraga State University - Cabadbaran Campus"

STEP 2 - FILTER EXTRACTION (only for rental_search or rental_followup):
From the message, extract rental search filters. Supported property types: boarding_house, apartment, inn, lodge, pension_house, resort, house, condo, studio, room_for_rent.
Supported amenities: wifi, parking, aircon, kitchen, laundry, security, furnished.
Location rules:
- Use "city" ONLY for verified city names (e.g., "Cabadbaran", "Butuan", "Cagayan de Oro").
- Use "near" for landmarks and natural places (e.g., "CSU", "Caraga State University", "Caraga State University - Cabadbaran Campus").
- When user says "duol sa CSU" or "near CSU", map to near: "Caraga State University - Cabadbaran Campus".
- When user says "sa Cabadbaran", map to city: "Cabadbaran".
Other: pet_friendly (boolean), min_price, max_price, bedrooms, move_in_date.

OUTPUT FORMAT - Return ONLY valid JSON with these fields:
{
  "intent": "rental_search" | "rental_followup" | "greeting" | "unrelated" | "spam_or_gibberish",
  "skip_search": true | false,
  "filters": {
    "property_type": string | null,
    "max_price": number | null,
    "min_price": number | null,
    "pet_friendly": boolean | null,
    "amenities": string[] | null,
    "city": string | null,
    "near": string | null,
    "bedrooms": number | null,
    "move_in_date": string | null
  }
}

RULES:
- For "greeting", "unrelated", or "spam_or_gibberish": intent is that value, skip_search is true, filters is {}.
- For "rental_search" or "rental_followup": skip_search is false, include extracted filters.
- Numbers as numbers, not strings.
- "under", "below", "max", "budget" → max_price.
- "over", "above", "min" → min_price.
- "Pets ok", "pet friendly", "pets allowed" → pet_friendly: true.
- "wifi", "internet", "wireless" → amenities: ["wifi"].
- "parking", "car park" → amenities: ["parking"].
- "aircon", "air conditioned" → amenities: ["aircon"].
- "kitchen" → amenities: ["kitchen"].
- "laundry", "washer" → amenities: ["laundry"].
- "security" → amenities: ["security"].
- "furnished" → amenities: ["furnished"].
- ALWAYS resolve landmarks to their full canonical name from the LANDMARK ALIAS DICTIONARY above.
- "city" is strictly for municipal/city names. "near" is strictly for landmarks/schools/natural places.
- Support Bisaya, Taglish, English, typos, incomplete sentences.
- "rental_followup" is ONLY when the message is clearly a constraint follow-up to a rental search. If context is unclear, use "rental_search".
- ALWAYS valid JSON only. No explanations, no markdown, no extra text.`;

type RateLimitStore = Map<string, { count: number; resetTime: number }>;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = forwarded?.split(",")[0]?.trim() ?? "";
  const ip = realIp || request.headers.get("x-real-ip") || "unknown";
  return `ai:${ip}`;
}

function checkRateLimit(key: string, store: RateLimitStore): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetTime) {
    store.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

const rateStore: RateLimitStore = new Map();

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI_TIMEOUT")), ms),
    ),
  ]);

export async function POST(request: NextRequest) {
  try {
    const key = getClientKey(request);
    if (!checkRateLimit(key, rateStore)) {
      return NextResponse.json(
        { error: "RATE_LIMIT", message: "Too many requests. Please wait a moment." },
        { status: 429 },
      );
    }

    const body = await request.json();
    const message = typeof body.message === "string" ? messageTrim(body.message) : "";
    const sessionHistory: Array<{ role: string; content: string }> =
      Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return NextResponse.json(
        { error: "INVALID_INPUT", message: "Message is required." },
        { status: 400 },
      );
    }

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) {
      return NextResponse.json(
        { success: true, intent: "rental_search", skip_search: false, filters: {}, fromAI: false, fallback: true },
        { status: 200 },
      );
    }

    const messages = buildRequestMessages(message, sessionHistory);

    let lastError: Error | null = null;
    let result: { intent: string; skip_search: boolean; filters: Record<string, unknown> } | null = null;

    for (const model of MODELS) {
      try {
        const response = await withTimeout(
          fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openrouterKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": request.headers.get("referer") || "http://localhost:3000",
              "X-Title": "Nestora",
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0,
              max_tokens: 256,
              response_format: { type: "json_object" },
            }),
          }),
          12_000,
        );

        if (!response.ok) {
          lastError = new Error(`Model ${model} returned ${response.status}`);
          continue;
        }

        const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const raw = data.choices?.[0]?.message?.content?.trim() ?? "";

        if (!raw) {
          lastError = new Error(`Model ${model} returned empty content`);
          continue;
        }

        try {
          const parsed = JSON.parse(raw) as {
            intent?: unknown;
            skip_search?: unknown;
            filters?: unknown;
          };
          const intent = typeof parsed.intent === "string" ? parsed.intent : "rental_search";
          const skipSearch = typeof parsed.skip_search === "boolean" ? parsed.skip_search : false;
          const filters =
            parsed.filters && typeof parsed.filters === "object" && !Array.isArray(parsed.filters)
              ? (parsed.filters as Record<string, unknown>)
              : {};

          result = { intent, skip_search: skipSearch, filters };
          return NextResponse.json(
            { success: true, ...result, fromAI: true, model },
            { status: 200 },
          );
        } catch {
          lastError = new Error(`Model ${model} returned malformed JSON`);
          continue;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    const isTimeout = lastError?.message?.includes("AI_TIMEOUT");
    const isRateLimited = lastError?.message?.includes("429");
    if (isTimeout || isRateLimited) {
      return NextResponse.json(
        { success: true, intent: "rental_search", skip_search: false, filters: {}, fromAI: false, fallback: true },
        { status: 200 },
      );
    }

    console.error("[ai-parse] All models failed, using fallback.", lastError?.message);
    return NextResponse.json(
      { success: true, intent: "rental_search", skip_search: false, filters: {}, fromAI: false, fallback: true },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { success: true, intent: "rental_search", skip_search: false, filters: {}, fromAI: false, fallback: true },
      { status: 200 },
    );
  }
}

function messageTrim(value: string): string {
  return value.trim();
}

function buildRequestMessages(
  message: string,
  history: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-10).map((item) => ({
      role: (item.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: item.content,
    })),
    { role: "user", content: message },
  ];
}
