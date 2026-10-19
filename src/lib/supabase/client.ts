import { createBrowserClient } from "@supabase/ssr";

/** Cliente Supabase para componentes do navegador (usa a chave pública). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
