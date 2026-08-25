import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// LET OP: deze client gebruikt de service-role key en omzeilt alle RLS-regels.
// Enkel gebruiken in server actions / route handlers, NOOIT in client-side code,
// en enkel nadat je zelf hebt gecontroleerd dat de ingelogde gebruiker
// systeembeheerder is (zie app/(app)/beheer/actions.ts).
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
