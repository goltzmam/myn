import { createBrowserClient } from "@supabase/ssr";
export function browserDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Configure Supabase in .env.local first.");
  return createBrowserClient(url, key);
}
