import { createClient } from "@/lib/supabase/server";
import type { Building, Reservation, Product, VerbruikRegel, Profile, ProductPrijs, Factuur, FactuurRegel } from "@/lib/types";
import SnelleVerwerkingView from "@/components/SnelleVerwerkingView";

export default async function VerwerkingPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: buildings },
    { data: reservations },
    { data: products },
    { data: productBuildingLinks },
    { data: leveringen },
    { data: eigenVerbruik },
    { data: prijzen },
    { data: facturen },
    { data: factuurRegels },
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase
      .from("reservations")
      .select("id, building_id, contact_id, huurder, adres, telefoon, activiteit, ruimte, begin_datum, eind_datum, toegang_start, activiteit_start, activiteit_eind, toegang_eind, status, bron")
      .order("begin_datum", { ascending: false })
      .limit(200),
    supabase
      .from("products")
      .select("id, name, prijs, categorie, verpakking, actief, afrekenmodus")
      .eq("actief", true)
      .eq("afrekenmodus", "standaard")
      .order("categorie")
      .order("name"),
    supabase.from("product_buildings").select("product_id, building_id, volgorde"),
    supabase
      .from("leveringen")
      .select("id, reservation_id, building_id, datum, product_id, aantal, wie")
      .is("reservation_id", null)
      .order("datum", { ascending: false })
      .limit(50),
    supabase
      .from("eigen_verbruik")
      .select("id, reservation_id, building_id, datum, product_id, aantal, wie")
      .is("reservation_id", null)
      .order("datum", { ascending: false })
      .limit(50),
    supabase.from("product_prijzen").select("id, product_id, prijs, geldig_vanaf, created_at"),
    supabase
      .from("facturen")
      .select("id, building_id, naam, type, datum, bedrag, wie, created_at, recreatex_verwerkt, recreatex_verwerkt_door, recreatex_verwerkt_op")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("factuur_regels").select("factuur_id, product_id, aantal, prijs"),
  ]);

  const canEdit =
    profile?.role === "systeembeheerder" ||
    profile?.role === "administratie" ||
    profile?.role === "gebouwbeheerder" ||
    profile?.role === "theatertechnieker";
  // Theatertechniekers registreren enkel hun eigen verbruik, geen leveringen
  // (dat blijft voorbehouden voor administratie/beheerders).
  const allowLeveringen = canEdit && profile?.role !== "theatertechnieker";

  return (
    <SnelleVerwerkingView
      buildings={(buildings as Building[]) || []}
      reservations={(reservations as Reservation[]) || []}
      products={(products as Product[]) || []}
      productBuildingLinks={(productBuildingLinks as { product_id: string; building_id: string; volgorde: number }[]) || []}
      recentLeveringen={(leveringen as VerbruikRegel[]) || []}
      recentEigenVerbruik={(eigenVerbruik as VerbruikRegel[]) || []}
      prijzen={(prijzen as ProductPrijs[]) || []}
      facturen={(facturen as Factuur[]) || []}
      factuurRegels={(factuurRegels as FactuurRegel[]) || []}
      canEdit={canEdit}
      allowLeveringen={allowLeveringen}
      initialKind={type === "factuur" ? "factuur" : undefined}
    />
  );
}
