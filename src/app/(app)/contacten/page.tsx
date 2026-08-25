import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Contact, Profile } from "@/lib/types";
import ContactenList from "@/components/ContactenList";
import { hasPincode } from "@/app/(app)/instellingen/actions";

export default async function ContactenPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: contacts }, heeftPincode] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("contacts").select("id, ruwe_naam, vereniging, contactpersoon, telefoon, adres").order("ruwe_naam"),
    hasPincode(),
  ]);
  if (profile?.role === "theatertechnieker") redirect("/dashboard");


  const canEdit = profile?.role === "systeembeheerder" || profile?.role === "administratie" || profile?.role === "gebouwbeheerder";

  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wide text-[#6D5AE6] uppercase">Beheerportaal</div>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-1">Contactenbeheer</h1>

      <div className="bg-[#EFEBFF] rounded-2xl p-4 mb-6 flex items-start gap-3">
        <div className="text-sm text-[#5B5F82]">
          Alle namen zoals ze uit de PDF-uploads komen. Splits ze op in vereniging + contactpersoon &mdash; dat
          blijft daarna gelden bij elke toekomstige upload met dezelfde naam.
        </div>
      </div>

      <ContactenList contacts={(contacts as Contact[]) || []} canEdit={canEdit} heeftPincode={heeftPincode} />
    </div>
  );
}
