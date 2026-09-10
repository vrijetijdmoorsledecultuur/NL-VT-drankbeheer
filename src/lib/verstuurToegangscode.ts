import type { SupabaseClient } from "@supabase/supabase-js";
import { getResend, AFZENDER } from "@/lib/resend";

type ToegangscodeMetGegevens = {
  id: string;
  code: string;
  verstuur_email: string | null;
  reservation_id: string;
  reservations?: { huurder: string; activiteit: string | null; buildings: { name: string } | null } | null;
};

export async function verstuurToegangscodeMail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  item: ToegangscodeMetGegevens,
  baseUrl: string
): Promise<{ ok: boolean; error?: string }> {
  if (!item.verstuur_email) return { ok: false, error: "Geen e-mailadres ingesteld." };

  const link = `${baseUrl}/gast/${item.code}`;
  const gebouw = item.reservations?.buildings?.name || "";
  const activiteit = item.reservations?.activiteit || "";

  try {
    const { error: sendError } = await getResend().emails.send({
      from: AFZENDER,
      to: item.verstuur_email,
      subject: `Registreer jullie drankverbruik — ${gebouw}`,
      html: `
        <p>Beste,</p>
        <p>Voor jullie activiteit${activiteit ? ` "${activiteit}"` : ""} in <strong>${gebouw}</strong> kan je zelf het drankverbruik registreren via onderstaande link. Dit duurt maar even.</p>
        <p><a href="${link}">${link}</a></p>
        <p>Code: <strong>${item.code}</strong></p>
        <p>Bedankt!</p>
      `,
    });
    if (sendError) return { ok: false, error: sendError.message || "Resend weigerde de verzending." };
    await supabase.from("reservation_toegangscodes").update({ verstuurd: true }).eq("id", item.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Versturen mislukt." };
  }
}
