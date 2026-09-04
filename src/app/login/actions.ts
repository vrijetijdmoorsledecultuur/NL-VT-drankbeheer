"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail, normalizePhone } from "@/lib/login";
import { AFZENDER, getResend } from "@/lib/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://drankbeheer.vercel.app";
const BEHEER_RECOVERY_EMAIL = "vrijetijd.moorslede.cultuur@gmail.com";

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
    if (email === BEHEER_RECOVERY_EMAIL) {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${APP_URL}/pincode-herstellen` },
      });

      if (!error && data.properties?.action_link) {
        const herstelLink = data.properties.action_link
          .replaceAll("&", "&amp;")
          .replaceAll('"', "&quot;");
        await getResend().emails.send({
          from: AFZENDER,
          to: email,
          subject: "Nieuwe pincode voor Drankbeheer",
          html: `<p>Je vroeg een nieuwe pincode aan voor Drankbeheer.</p><p><a href="${herstelLink}">Kies een nieuwe pincode</a></p><p>Deze link is tijdelijk geldig. Heb je dit niet aangevraagd, dan mag je deze mail negeren.</p>`,
        });
      }
    } else {
      const supabase = await createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${APP_URL}/pincode-herstellen`,
      });
    }
  }

  redirect(`/login?message=${encodeURIComponent("Als dit account actief is, ontvang je zo meteen een herstelmail.")}`);
}
