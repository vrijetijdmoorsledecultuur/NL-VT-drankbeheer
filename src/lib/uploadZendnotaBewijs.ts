"use client";

import { createClient } from "@/lib/supabase/client";

export async function uploadZendnotaBewijs(file: File, bestellingId: string): Promise<string> {
  const supabase = createClient();
  const extensie = file.name.split(".").pop() || "jpg";
  const pad = `${bestellingId}/${Date.now()}.${extensie}`;

  const { error } = await supabase.storage.from("zendnota-bewijs").upload(pad, file, { upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("zendnota-bewijs").getPublicUrl(pad);
  return data.publicUrl;
}
