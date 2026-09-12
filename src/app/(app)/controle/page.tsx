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
  ProductPrijs,
  ReservationBoete,
  Factuur,
  FactuurRegel,
} from "@/lib/types";
import ControleApp from "@/components/controle/ControleApp";
import { hasPincode } from "@/app/(app)/instellingen/actions";

export default async function ControlePage({ searchParams }: { searchParams: Promise<{ reservationId?: string }> }) {
  const { reservationId } = await searchParams;
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
    { data: verwerkteTellingen },
    { data: ruweTellingRegels },
    { data: telplekken },
    { data: toegangscodes },
    { data: prijzen },
    { data: facturen },
    { data: factuurRegels },
    heeftPincode,
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase
      .from("reservations")
      .select("id, building_id, contact_id, huurder, adres, telefoon, activiteit, ruimte, begin_datum, eind_datum, toegang_start, activiteit_start, activiteit_eind, toegang_eind, status, bron, recreatex_verwerkt, recreatex_verwerkt_door, recreatex_verwerkt_op")
      .order("begin_datum", { ascending: false })
      .limit(500),
    supabase.from("products").select("id, name, prijs, categorie, verpakking, actief, afrekenmodus").eq("actief", true).order("categorie").order("name"),
    supabase.from("product_buildings").select("product_id, building_id"),
    supabase.from("reservation_product_tellingen").select("reservation_id, product_id, vooraf, nadien, vooraf_frigo, vooraf_bakken, vooraf_los, nadien_frigo, nadien_bakken, nadien_los"),
    supabase.from("leveringen").select("id, reservation_id, building_id, datum, product_id, aantal, wie"),
    supabase.from("eigen_verbruik").select("id, reservation_id, building_id, datum, product_id, aantal, wie"),
    supabase.from("reservation_boetes").select("reservation_id, product_id, bewijs_url"),
    supabase.from("reservation_extra_producten").select("reservation_id, product_id"),
    supabase.from("contacts").select("id, ruwe_naam, vereniging, contactpersoon, telefoon, adres"),
    supabase
      .from("ruwe_tellingen")
      .select("id, building_id, reservation_id, type, ingevoerd_door, status, afwijking_bevestigd, telplek_id, vaste_voorraad_bevestigd, created_at")
      .eq("status", "open")
      .order("created_at"),
    supabase
      .from("ruwe_tellingen")
      .select("id, building_id, reservation_id, type, ingevoerd_door, status, afwijking_bevestigd, telplek_id, vaste_voorraad_bevestigd, created_at")
      .eq("status", "verwerkt")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("ruwe_telling_regels").select("ruwe_telling_id, product_id, aantal, frigo, bakken, los"),
    supabase.from("telplekken").select("id, building_id, naam, volgorde, vereist_telplek_id, heeft_vaste_voorraad, actief"),
    supabase
      .from("reservation_toegangscodes")
      .select("id, reservation_id, code, geldig_vanaf, geldig_tot, verstuur_email, verstuur_op, verstuurd, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("product_prijzen").select("id, product_id, prijs, geldig_vanaf, created_at"),
    supabase.from("facturen").select("id, building_id, naam, type, datum, bedrag, wie, created_at, status, goedgekeurd_door, goedgekeurd_op, recreatex_verwerkt, recreatex_verwerkt_door, recreatex_verwerkt_op").order("created_at", { ascending: false }).limit(50),
    supabase.from("factuur_regels").select("factuur_id, product_id, aantal, prijs"),
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
      boetes={(boetes as ReservationBoete[]) || []}
      extraProducten={(extraProducten as { reservation_id: string; product_id: string }[]) || []}
      contacts={(contacts as Contact[]) || []}
      ruweTellingen={(ruweTellingen as RuweTelling[]) || []}
      verwerkteTellingen={(verwerkteTellingen as RuweTelling[]) || []}
      ruweTellingRegels={(ruweTellingRegels as RuweTellingRegel[]) || []}
      telplekken={(telplekken as Telplek[]) || []}
      toegangscodes={(toegangscodes as ReservationToegangscode[]) || []}
      prijzen={(prijzen as ProductPrijs[]) || []}
      facturen={(facturen as Factuur[]) || []}
      factuurRegels={(factuurRegels as FactuurRegel[]) || []}
      canEdit={canEdit}
      initialReservationId={reservationId}
      heeftPincode={heeftPincode}
    />
  );
}
