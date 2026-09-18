import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

/** Browser client. Vercel should always provide the real values; fallbacks keep public pages buildable before env setup. */
export function createClient() {
  return createBrowserClient(url, key);
}
