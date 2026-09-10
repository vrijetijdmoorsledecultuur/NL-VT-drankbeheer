"use client";

import { createClient } from "@/lib/supabase/client";

export async function uploadBoeteBewijs(file: File, reservationId: string, productId: string): Promise<string> {
  const supabase = createClient();
  const extensie = file.name.split(".").pop() || "jpg";
  const pad = `${reservationId}/${productId}-${Date.now()}.${extensie}`;

  const { error } = await supabase.storage.from("boete-bewijs").upload(pad, file, { upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("boete-bewijs").getPublicUrl(pad);
  return data.publicUrl;
}
