// Hardened Supabase client with auto-retry, timeouts, and connection recovery.
// Credentials resolve from (1) embed <script data-*> globals, (2) Vite env,
// (3) known project fallback — so the client is bulletproof even if env is absent.
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Known project values (anon key is public by design) — last-resort fallback only.
const FALLBACK_URL = "https://jigtcyjgolqxlmavifxv.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppZ3RjeWpnb2xxeGxtYXZpZnh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDQ3ODUsImV4cCI6MjA5NTU4MDc4NX0.lwwXXtI3bkH4jUCaujSaYtAzlRSBf1Yzx6B7lB2rfTc";

const w = (typeof window !== "undefined" ? (window as Record<string, unknown>) : {}) as Record<string, string>;

export const SUPABASE_URL =
  w.__EMBED_SUPABASE_URL__ || import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
export const SUPABASE_ANON_KEY =
  w.__EMBED_SUPABASE_KEY__ || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_ANON_KEY;
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// Retrying fetch with a 15s timeout + exponential backoff on network failures.
// Only network errors/timeouts retry; HTTP responses (even 4xx/5xx) return as-is.
const retryingFetch: typeof fetch = async (url, options = {}) => {
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        return await fetch(url, { ...options, signal: options.signal ?? controller.signal });
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      lastError = err as Error;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500)); // 500, 1000, 2000ms
      }
    }
  }
  throw lastError ?? new Error("Network request failed after retries");
};

export const supabase: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: typeof localStorage !== "undefined" ? localStorage : undefined, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: {
    headers: { "x-client-info": "bison-booking/1.0" },
    fetch: retryingFetch,
  },
  realtime: { reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 10000) },
});

// Retry any async operation with exponential backoff.
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, label = "operation"): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      console.warn(`[Bison] ${label} failed (attempt ${i + 1}/${maxAttempts}):`, err);
      if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, Math.pow(2, i) * 600));
    }
  }
  throw lastError ?? new Error(`${label} failed after ${maxAttempts} attempts`);
}

// Call an Edge Function with retry. For public functions; admin/JWT calls should
// keep using supabase.functions.invoke (which attaches the session token).
export async function callFunction<T = unknown>(slug: string, body: object, anonKey = SUPABASE_ANON_KEY): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(`${FUNCTIONS_URL}/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as { error?: string }).error || `Function ${slug} returned ${res.status}`);
    }
    return res.json() as Promise<T>;
  }, 3, `callFunction(${slug})`);
}
