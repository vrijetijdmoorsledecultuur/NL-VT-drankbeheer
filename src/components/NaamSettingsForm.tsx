"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { updateOwnName } from "@/app/(app)/instellingen/actions";

export default function NaamSettingsForm({ huidigeNaam }: { huidigeNaam: string }) {
  const router = useRouter();
  const [naam, setNaam] = useState(huidigeNaam);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateOwnName(naam);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-[#EFEBFF] text-[#6D5AE6] flex items-center justify-center shrink-0">
          <User size={15} />
        </div>
        <div className="font-bold text-[#171A2B]">Jouw naam</div>
      </div>
      <p className="text-xs text-[#8A8FA8] mb-4">Dit is wat andere gebruikers en het dashboard van je te zien krijgen.</p>

      <input
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        placeholder="Bv. Niek Lyphout"
        className="w-full rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
      />
      {error && <div className="text-xs text-[#D6493C] mt-2">{error}</div>}
      {saved && <div className="text-xs text-[#1FAE7A] mt-2">Naam opgeslagen.</div>}

      <button
        onClick={submit}
        disabled={pending || !naam.trim()}
        className="mt-3 px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Bezig\u2026" : "Opslaan"}
      </button>
    </div>
  );
}
