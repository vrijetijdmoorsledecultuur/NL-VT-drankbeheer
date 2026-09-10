import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { getGebouwen } from "@/app/tellen/[token]/actions";
import TellerApp from "@/components/TellerApp";

export default async function IngelogdTellenPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: instellingen }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("teller_instellingen").select("token").eq("id", true).single(),
  ]);

  const token = instellingen?.token;
  if (!token) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-[#171A2B] mb-1">Tellen</h1>
        <p className="text-[#8A8FA8] text-sm">De tellen-link is nog niet ingesteld door de systeembeheerder.</p>
      </div>
    );
  }

  const gebouwen = await getGebouwen(token);
  const defaultNaam = profile?.full_name || profile?.email || "";

  return (
    <div className="-m-4 md:-m-8">
      <TellerApp
        token={token}
        gebouwen={gebouwen}
        defaultNaam={defaultNaam}
        initialType={type === "vooraf" || type === "nadien" || type === "controle" ? type : undefined}
      />
    </div>
  );
}
