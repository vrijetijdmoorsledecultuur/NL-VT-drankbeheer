"use server";

import { createClient } from "@/lib/supabase/server";

export type GastContext = {
  reservation_id: string;
  building_id: string;
  huurder: string;
  activiteit: string | null;
  gebouw_naam: string;
};
export type GastProduct = { id: string; name: string; categorie: string };

export async function getGastContext(code: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("gast_context", { p_code: code });
  return (data as GastContext[] | null)?.[0] || null;
}

export async function getGastProducten(code: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("gast_producten", { p_code: code });
  return (data as GastProduct[]) || [];
}

export async function submitGastTelling(code: string, naam: string, regels: { productId: string; aantal: number }[]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_gast_telling", {
    p_code: code,
    p_naam: naam,
    p_regels: regels.map((r) => ({ product_id: r.productId, aantal: r.aantal })),
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
