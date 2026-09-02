"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail, normalizePhone } from "@/lib/login";

export async function login(formData: FormData) {
  const identifier = String(formData.get("identifier") || "").trim();
  const pin = String(formData.get("pin") || "");
  const directEmail = normalizeEmail(identifier);
  const phone = directEmail ? null : normalizePhone(identifier);

  if (!directEmail && !phone) {
    redirect(`/login?error=${encodeURIComponent("Vul een geldig e-mailadres of gsm-nummer in.")}`);
  }

  let email = directEmail;
  if (phone) {
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("email, active").eq("phone", phone).maybeSingle();
    if (!profile?.email || !profile.active) {
      redirect(`/login?error=${encodeURIComponent("Deze combinatie is niet geldig of het account is niet actief.")}`);
    }
    email = profile.email;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email!, password: pin });

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
