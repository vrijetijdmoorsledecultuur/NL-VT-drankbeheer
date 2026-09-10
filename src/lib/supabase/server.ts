import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client. Use this in Server Components, Server Actions
// and Route Handlers. It reads/writes the auth session via cookies.
export async function createClient() {
  const cookieStore = await cookies();
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — the middleware refreshes
            // the session instead, so this can be safely ignored.
          }
        },
      },
    }
  );
}
