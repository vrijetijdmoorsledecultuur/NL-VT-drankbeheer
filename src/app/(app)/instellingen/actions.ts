"use server";

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";

function hashPincode(pin: string, salt: string) {
  return scryptSync(pin, salt, 32).toString("hex");
}

export async function hasPincode() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("pincode_hash").eq("id", user.id).single();
  return !!data?.pincode_hash;
}

export async function setPincode(pin: string) {
  if (!/^\d{4,6}$/.test(pin)) {
    return { ok: false as const, error: "Kies een pincode van 4 tot 6 cijfers." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Niet ingelogd." };

  const salt = randomBytes(16).toString("hex");
  const hash = hashPincode(pin, salt);
  await supabase.from("profiles").update({ pincode_hash: hash, pincode_salt: salt }).eq("id", user.id);
  return { ok: true as const };
}

export async function verifyPincode(pin: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.from("profiles").select("pincode_hash, pincode_salt").eq("id", user.id).single();
  if (!data?.pincode_hash || !data?.pincode_salt) return false;

  const attempt = hashPincode(pin, data.pincode_salt);
  const a = Buffer.from(attempt, "hex");
  const b = Buffer.from(data.pincode_hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function updateOwnName(naam: string) {
  const trimmed = naam.trim();
  if (!trimmed) return { ok: false as const, error: "Vul een naam in." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Niet ingelogd." };

  await supabase.from("profiles").update({ full_name: trimmed }).eq("id", user.id);
  return { ok: true as const };
}
