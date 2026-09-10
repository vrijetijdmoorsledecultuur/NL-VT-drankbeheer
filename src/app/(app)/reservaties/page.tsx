import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Building, Reservation, Contact, Profile } from "@/lib/types";
import PdfUploadFlow from "@/components/PdfUploadFlow";
import ReservationsList from "@/components/ReservationsList";
import { hasPincode } from "@/app/(app)/instellingen/actions";

export default async function ReservatiesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: buildings }, { data: reservations }, { data: contacts }, heeftPincode] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase
      .from("reservations")
      .select("id, building_id, contact_id, huurder, adres, telefoon, activiteit, ruimte, begin_datum, eind_datum, toegang_start, activiteit_start, activiteit_eind, toegang_eind, status, bron, recreatex_verwerkt, recreatex_verwerkt_door, recreatex_verwerkt_op")
      .order("begin_datum", { ascending: false })
      .limit(200),
    supabase.from("contacts").select("id, ruwe_naam, vereniging, contactpersoon, telefoon, adres"),
    hasPincode(),
  ]);
  if (profile?.role === "theatertechnieker") redirect("/dashboard");


  const canEdit = profile?.role === "systeembeheerder" || profile?.role === "administratie" || profile?.role === "gebouwbeheerder";

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-2xl font-bold text-[#171A2B]">Reservatiedossiers</h1>
        {canEdit && (
          <Link
            href="/reservaties/nieuw"
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold"
          >
            <Plus size={15} /> Nieuwe reservatie
          </Link>
        )}
      </div>
      <p className="text-[#8A8FA8] text-sm mb-6">
        Upload een reserveringsoverzicht (PDF) van de gemeentelijke reservatietool. De gegevens worden uitgelezen
        en getoond ter controle — pas aan waar nodig, en bewaar pas als alles klopt.
      </p>

      {canEdit && <PdfUploadFlow buildings={(buildings as Building[]) || []} />}

      <h2 className="text-lg font-bold text-[#171A2B] mb-1 mt-10">Opgeslagen reservaties</h2>
      <p className="text-[#8A8FA8] text-sm mb-4">Meest recente 200, nieuwste eerst.</p>
      <ReservationsList
        reservations={(reservations as Reservation[]) || []}
        buildings={(buildings as Building[]) || []}
        contacts={(contacts as Contact[]) || []}
        canEdit={canEdit}
        heeftPincode={heeftPincode}
        initialTab={tab === "afgelopen" || tab === "kalender" ? tab : "komende"}
      />
    </div>
  );
}
