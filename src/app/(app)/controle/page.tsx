import { createClient } from "@/lib/supabase/server";
import type {
  Building,
  Reservation,
  Product,
  Telling,
  VerbruikRegel,
  Contact,
  Profile,
  RuweTelling,
  RuweTellingRegel,
  Telplek,
  ReservationToegangscode,
} from "@/lib/types";
import ControleApp from "@/components/controle/ControleApp";
import { hasPincode } from "@/app/(app)/instellingen/actions";

export default async function ControlePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: buildings },
    { data: reservations },
    { data: products },
    { data: productBuildings },
    { data: tellingen },
    { data: leveringen },
    { data: eigenVerbruik },
    { data: boetes },
    { data: extraProducten },
    { data: contacts },
    { data: ruweTellingen },
    { data: ruweTellingRegels },
    { data: telplekken },
    { data: toegangscodes },
    heeftPincode,
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase
      .from("reservations")
      .select("id, building_id, contact_id, huurder, adres, telefoon, activiteit, ruimte, begin_datum, eind_datum, toegang_start, activiteit_start, activiteit_eind, toegang_eind, status, bron")
      .order("begin_datum", { ascending: false })
      .limit(500),
    supabase.from("products").select("id, name, prijs, categorie, verpakking, actief, afrekenmodus").eq("actief", true).order("categorie").order("name"),
    supabase.from("product_buildings").select("product_id, building_id"),
    supabase.from("reservation_product_tellingen").select("reservation_id, product_id, vooraf, nadien"),
    supabase.from("leveringen").select("id, reservation_id, building_id, datum, product_id, aantal, wie"),
    supabase.from("eigen_verbruik").select("id, reservation_id, building_id, datum, product_id, aantal, wie"),
    supabase.from("reservation_boetes").select("reservation_id, product_id"),
    supabase.from("reservation_extra_producten").select("reservation_id, product_id"),
    supabase.from("contacts").select("id, ruwe_naam, vereniging, contactpersoon, telefoon, adres"),
    supabase
      .from("ruwe_tellingen")
      .select("id, building_id, reservation_id, type, ingevoerd_door, status, afwijking_bevestigd, telplek_id, vaste_voorraad_bevestigd, created_at")
      .eq("status", "open")
      .order("created_at"),
    supabase.from("ruwe_telling_regels").select("ruwe_telling_id, product_id, aantal"),
    supabase.from("telplekken").select("id, building_id, naam, volgorde, vereist_telplek_id, heeft_vaste_voorraad, actief"),
    supabase
      .from("reservation_toegangscodes")
      .select("id, reservation_id, code, geldig_vanaf, geldig_tot, verstuur_email, verstuur_op, verstuurd, created_at")
      .order("created_at", { ascending: false }),
    hasPincode(),
  ]);

  const canEdit = profile?.role === "systeembeheerder" || profile?.role === "administratie" || profile?.role === "gebouwbeheerder";

  return (
    <ControleApp
      buildings={(buildings as Building[]) || []}
      reservations={(reservations as Reservation[]) || []}
      products={(products as Product[]) || []}
      productBuildings={(productBuildings as { product_id: string; building_id: string }[]) || []}
      tellingen={(tellingen as Telling[]) || []}
      leveringen={(leveringen as VerbruikRegel[]) || []}
      eigenVerbruik={(eigenVerbruik as VerbruikRegel[]) || []}
      boetes={(boetes as { reservation_id: string; product_id: string }[]) || []}
      extraProducten={(extraProducten as { reservation_id: string; product_id: string }[]) || []}
      contacts={(contacts as Contact[]) || []}
      ruweTellingen={(ruweTellingen as RuweTelling[]) || []}
      ruweTellingRegels={(ruweTellingRegels as RuweTellingRegel[]) || []}
      telplekken={(telplekken as Telplek[]) || []}
      toegangscodes={(toegangscodes as ReservationToegangscode[]) || []}
      canEdit={canEdit}
      heeftPincode={heeftPincode}
    />
  );
}
