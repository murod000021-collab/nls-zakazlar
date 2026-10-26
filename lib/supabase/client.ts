import { createBrowserClient } from "@supabase/ssr";

// Brauzerda ishlatiladi. Publishable kalit ochiq bo'lishi mumkin, himoya RLS da.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
