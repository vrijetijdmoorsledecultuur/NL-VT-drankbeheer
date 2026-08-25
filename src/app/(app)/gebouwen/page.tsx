import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Building, Product, Telplek, TelplekProduct, TelplekVasteVoorraadRegel, Profile } from "@/lib/types";
import GebouwenTable from "@/components/GebouwenTable";
import UniversalTellerLinkCard from "@/components/UniversalTellerLinkCard";
import TelplekkenBeheer from "@/components/TelplekkenBeheer";

export default async function GebouwenPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: buildings },
    { data: activeBuildings },
    { data: tellerInstellingen },
    { data: telplekken },
    { data: telplekProducten },
    { data: vasteVoorraadRegels },
    { data: products },
    { data: productBuildingLinks },
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("buildings").select("id, name, actief").order("name"),
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase.from("teller_instellingen").select("token").eq("id", true).single(),
    supabase.from("telplekken").select("id, building_id, naam, volgorde, vereist_telplek_id, heeft_vaste_voorraad, actief").eq("actief", true).order("volgorde"),
    supabase.from("telplek_producten").select("telplek_id, product_id, standaard"),
    supabase.from("telplek_vaste_voorraad").select("telplek_id, product_id, aantal"),
    supabase.from("products").select("id, name, prijs, categorie, verpakking, actief, afrekenmodus").eq("actief", true).eq("afrekenmodus", "standaard").order("categorie").order("name"),
    supabase.from("product_buildings").select("product_id, building_id"),
  ]);
  if (profile?.role === "theatertechnieker") redirect("/dashboard");


  const canEdit = profile?.role === "systeembeheerder" || profile?.role === "administratie";

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-1">Gebouwen & locaties</h1>
      <p className="text-[#8A8FA8] text-sm mb-6">Alle actieve en inactieve locaties.</p>
      <GebouwenTable buildings={(buildings as Building[]) || []} canEdit={canEdit} />
      {tellerInstellingen?.token && (
        <UniversalTellerLinkCard token={tellerInstellingen.token} canEdit={canEdit} />
      )}
      <TelplekkenBeheer
        buildings={(activeBuildings as Building[]) || []}
        telplekken={(telplekken as Telplek[]) || []}
        telplekProducten={(telplekProducten as TelplekProduct[]) || []}
        vasteVoorraadRegels={(vasteVoorraadRegels as TelplekVasteVoorraadRegel[]) || []}
        products={(products as Product[]) || []}
        productBuildingLinks={(productBuildingLinks as { product_id: string; building_id: string }[]) || []}
        canEdit={canEdit}
      />
    </div>
  );
}
