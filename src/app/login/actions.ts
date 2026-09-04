"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail, normalizePhone } from "@/lib/login";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://drankbeheer.vercel.app";

async function resolveActiveEmail(identifier: string) {
  const directEmail = normalizeEmail(identifier);
  const phone = directEmail ? null : normalizePhone(identifier);

  if (!directEmail && !phone) return null;

  const admin = createAdminClient();
  let query = admin
    .from("profiles")
    .select("email, active")
    .eq("active", true);
  query = directEmail ? query.eq("email", directEmail) : query.eq("phone", phone!);
  const { data: profile } = await query.maybeSingle();

  return profile?.active && profile.email ? profile.email : null;
}

export async function login(formData: FormData) {
  const identifier = String(formData.get("identifier") || "").trim();
  const pin = String(formData.get("pin") || "");
  const email = await resolveActiveEmail(identifier);

  if (!email) {
    redirect(`/login?error=${encodeURIComponent("Vul een geldig en actief e-mailadres of gsm-nummer in.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pin });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("E-mailadres/gsm-nummer of pincode is niet juist.")}`);
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("active").eq("id", data.user.id).single();
  if (!profile?.active) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("Dit account is niet actief.")}`);
  }

  redirect("/dashboard");
}

export async function requestPincodeReset(formData: FormData) {
  const identifier = String(formData.get("identifier") || "").trim();
  const email = await resolveActiveEmail(identifier);

  if (email) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_URL}/pincode-herstellen`,
    });
  }

  redirect(`/login?message=${encodeURIComponent("Als dit account actief is, ontvang je zo meteen een herstelmail.")}`);
}
