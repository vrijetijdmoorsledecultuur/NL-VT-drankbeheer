"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addVerplaatsing(input: {
  productId: string;
  vanBuildingId: string;
  naarBuildingId: string;
  aantal: number;
  datum: string;
  reden: string;
  wie: string;
}) {
  const supabase = await createClient();
  await supabase.from("voorraadverplaatsingen").insert({
    product_id: input.productId,
    van_building_id: input.vanBuildingId,
    naar_building_id: input.naarBuildingId,
    aantal: input.aantal,
    datum: input.datum,
    reden: input.reden || null,
    wie: input.wie || null,
  });
  revalidatePath("/verwerking");
}

export async function removeVerplaatsing(id: string) {
  const supabase = await createClient();
  await supabase.from("voorraadverplaatsingen").delete().eq("id", id);
  revalidatePath("/verwerking");
}
