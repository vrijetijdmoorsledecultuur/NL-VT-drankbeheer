import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Building, Product, Leverancier, Bestelling, BestellingRegel, Profile } from "@/lib/types";
import BestellingenView from "@/components/BestellingenView";

export default async function BestellingenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>();
  if (profile?.role === "theatertechnieker") redirect("/dashboard");

  const [
    { data: buildings },
    { data: products },
    { data: productBuildings },
    { data: leveranciers },
    { data: bestellingen },
    { data: bestellingRegels },
  ] = await Promise.all([
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase.from("products").select("id, name, prijs, categorie, verpakking, actief, afrekenmodus").eq("actief", true).eq("afrekenmodus", "standaard").order("categorie").order("name"),
    supabase.from("product_buildings").select("product_id, building_id, volgorde"),
    supabase.from("leveranciers").select("id, naam, email, telefoon, actief").order("naam"),
    supabase.from("bestellingen").select("id, building_id, leverancier_id, status, notitie, aangemaakt_door, created_at, verstuurd_op").order("created_at", { ascending: false }),
    supabase.from("bestelling_regels").select("bestelling_id, product_id, besteld_aantal, geleverd_aantal"),
  ]);

  const canEdit = profile?.role === "systeembeheerder" || profile?.role === "administratie" || profile?.role === "gebouwbeheerder";
  const defaultNaam = profile?.full_name || profile?.email || "";

  return (
    <BestellingenView
      buildings={(buildings as Building[]) || []}
      products={(products as Product[]) || []}
      productBuildings={(productBuildings as { product_id: string; building_id: string; volgorde: number }[]) || []}
      leveranciers={(leveranciers as Leverancier[]) || []}
      bestellingen={(bestellingen as Bestelling[]) || []}
      bestellingRegels={(bestellingRegels as BestellingRegel[]) || []}
      canEdit={canEdit}
      defaultNaam={defaultNaam}
    />
  );
}
