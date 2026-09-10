import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Building, Profile } from "@/lib/types";
import SnelleVerhuringForm from "@/components/SnelleVerhuringForm";

export default async function NieuweReservatiePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: buildings }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
  ]);
  if (profile?.role === "theatertechnieker") redirect("/dashboard");

  const canEdit = profile?.role === "systeembeheerder" || profile?.role === "administratie" || profile?.role === "gebouwbeheerder";
  if (!canEdit) redirect("/reservaties");

  return (
    <div>
      <Link href="/reservaties" className="text-sm text-[#6D5AE6] font-medium mb-4 flex items-center gap-1 w-fit">
        <ChevronLeft size={14} /> Reservatiedossiers
      </Link>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-1">Historische telling</h1>
      <p className="text-[#8A8FA8] text-sm mb-6">
        Voeg een reservatie manueel toe — voor een historische activiteit die nog niet in de app staat, of een
        snelle verhuring zonder Recreatex-PDF. Na het opslaan kom je meteen in het telscherm terecht, klaar om de
        aantallen in te vullen.
      </p>

      <SnelleVerhuringForm buildings={(buildings as Building[]) || []} standalone />
    </div>
  );
}
