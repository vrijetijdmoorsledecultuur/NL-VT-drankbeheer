import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Product, Building, Profile, Telplek, TelplekProduct, ProductPrijs } from "@/lib/types";
import ProductenTable from "@/components/ProductenTable";
import ProductVolgordeBeheer from "@/components/ProductVolgordeBeheer";
import PrijsGeschiedenisBeheer from "@/components/PrijsGeschiedenisBeheer";

export default async function ProductenPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: products }, { data: buildings }, { data: links }, { data: telplekken }, { data: telplekProducten }, { data: prijzen }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("products").select("id, name, prijs, categorie, verpakking, actief, afrekenmodus").order("categorie").order("name"),
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase.from("product_buildings").select("product_id, building_id, volgorde"),
    supabase.from("telplekken").select("id, building_id, naam, volgorde, vereist_telplek_id, heeft_vaste_voorraad, actief").eq("actief", true).order("volgorde"),
    supabase.from("telplek_producten").select("telplek_id, product_id, standaard, volgorde"),
    supabase.from("product_prijzen").select("id, product_id, prijs, geldig_vanaf, created_at"),
  ]);
  if (profile?.role === "theatertechnieker") redirect("/dashboard");


  const canEdit = profile?.role === "systeembeheerder" || profile?.role === "administratie";

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-1">Producten & prijzen</h1>
      <p className="text-[#8A8FA8] text-sm mb-6">
        Vink per gebouw aan of een product tot het standaardassortiment behoort. Niet-standaard producten kan je
        later per reservatie nog als uitzonderlijk aanbod toevoegen.
      </p>
      <ProductenTable
        products={(products as Product[]) || []}
        buildings={(buildings as Building[]) || []}
        links={(links as { product_id: string; building_id: string }[]) || []}
        canEdit={canEdit}
      />
      <PrijsGeschiedenisBeheer
        products={(products as Product[]) || []}
        prijzen={(prijzen as ProductPrijs[]) || []}
        canEdit={canEdit}
      />
      <ProductVolgordeBeheer
        products={(products as Product[]) || []}
        buildings={(buildings as Building[]) || []}
        telplekken={(telplekken as Telplek[]) || []}
        telplekProducten={(telplekProducten as TelplekProduct[]) || []}
        canEdit={canEdit}
      />
    </div>
  );
}
