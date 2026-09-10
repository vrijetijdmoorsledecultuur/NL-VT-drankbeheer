import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Building, Product, Reservation, Telling, VerbruikRegel, Voorraadverplaatsing, VoorraadControletelling, Profile } from "@/lib/types";
import VoorraadView from "@/components/VoorraadView";

export default async function VoorraadPage() {
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
    { data: reservations },
    { data: tellingen },
    { data: leveringen },
    { data: eigenVerbruik },
    { data: verplaatsingen },
    { data: controletellingen },
  ] = await Promise.all([
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase.from("products").select("id, name, prijs, categorie, verpakking, actief, afrekenmodus").eq("actief", true).eq("afrekenmodus", "standaard").order("categorie").order("name"),
    supabase.from("product_buildings").select("product_id, building_id, volgorde, minimum_voorraad, streef_voorraad"),
    supabase.from("reservations").select("id, building_id, huurder, activiteit, begin_datum, eind_datum, status"),
    supabase.from("reservation_product_tellingen").select("reservation_id, product_id, vooraf, nadien"),
    supabase.from("leveringen").select("id, reservation_id, building_id, datum, product_id, aantal, wie"),
    supabase.from("eigen_verbruik").select("id, reservation_id, building_id, datum, product_id, aantal, wie"),
    supabase.from("voorraadverplaatsingen").select("id, product_id, van_building_id, naar_building_id, aantal, datum, reden, wie"),
    supabase.from("voorraad_controletellingen").select("id, building_id, product_id, aantal, datum, created_at"),
  ]);

  const canEdit = profile?.role === "systeembeheerder" || profile?.role === "administratie" || profile?.role === "gebouwbeheerder";
  const defaultNaam = profile?.full_name || profile?.email || "";

  return (
    <VoorraadView
      buildings={(buildings as Building[]) || []}
      products={(products as Product[]) || []}
      productBuildings={
        (productBuildings as {
          product_id: string;
          building_id: string;
          volgorde: number;
          minimum_voorraad: number | null;
          streef_voorraad: number | null;
        }[]) || []
      }
      reservations={(reservations as Reservation[]) || []}
      tellingen={(tellingen as Telling[]) || []}
      leveringen={(leveringen as VerbruikRegel[]) || []}
      eigenVerbruik={(eigenVerbruik as VerbruikRegel[]) || []}
      verplaatsingen={(verplaatsingen as Voorraadverplaatsing[]) || []}
      controletellingen={(controletellingen as VoorraadControletelling[]) || []}
      canEdit={canEdit}
      defaultNaam={defaultNaam}
    />
  );
}
