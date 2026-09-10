"use client";

import { useState, useTransition } from "react";
import { Download, ShieldCheck } from "lucide-react";
import { exporteerVolledigeBackup } from "@/app/(app)/beheer/actions";

export default function BackupCard() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [gelukt, setGelukt] = useState(false);

  function download() {
    setError(null);
    startTransition(async () => {
      try {
        const data = await exporteerVolledigeBackup();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const datum = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `beheerportaal-backup-${datum}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setGelukt(true);
        setTimeout(() => setGelukt(false), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Back-up maken mislukt.");
      }
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mt-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-[#E1F5F1] text-[#1B9C82] flex items-center justify-center shrink-0">
          <ShieldCheck size={15} />
        </div>
        <div className="font-bold text-[#171A2B]">Back-up</div>
      </div>
      <p className="text-xs text-[#8A8FA8] mb-4">
        Supabase maakt zelf al doorlopend automatische back-ups op databankniveau (zie Supabase &gt; Settings &gt;
        Database). Dit hier is een extra, downloadbare momentopname van alle gegevens &mdash; bewaar dit bestand
        ergens veilig buiten deze app, bv. in een gedeelde gemeentelijke map.
      </p>
      <button
        onClick={download}
        disabled={pending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
      >
        <Download size={15} />
        {pending ? "Bezig\u2026" : "Volledige back-up downloaden"}
      </button>
      {gelukt && <div className="text-xs text-[#1FAE7A] mt-2">Back-up gedownload.</div>}
      {error && <div className="text-xs text-[#D6493C] mt-2">{error}</div>}
      <p className="text-[11px] text-[#B0B4CC] mt-3">
        Dit bestand terugzetten gebeurt momenteel nog niet automatisch vanuit de app &mdash; bij een probleem
        kan dit bestand wel dienen als referentie om gegevens manueel te herstellen via Supabase.
      </p>
    </div>
  );
}
