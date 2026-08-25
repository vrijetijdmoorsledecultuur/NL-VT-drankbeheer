import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verstuurToegangscodeMail } from "@/lib/verstuurToegangscode";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: teVersturen, error } = await supabase
    .from("reservation_toegangscodes")
    .select("id, code, verstuur_email, reservation_id, reservations(huurder, activiteit, buildings(name))")
    .eq("verstuurd", false)
    .not("verstuur_email", "is", null)
    .lte("verstuur_op", new Date().toISOString());

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!teVersturen || teVersturen.length === 0) {
    return NextResponse.json({ ok: true, verstuurd: 0 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${request.headers.get("host")}`;
  let verstuurd = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of teVersturen as any[]) {
    const res = await verstuurToegangscodeMail(supabase, item, baseUrl);
    if (res.ok) verstuurd++;
  }

  return NextResponse.json({ ok: true, verstuurd });
}
