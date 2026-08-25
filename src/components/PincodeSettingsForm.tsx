"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { setPincode } from "@/app/(app)/instellingen/actions";

export default function PincodeSettingsForm({ heeftAlPincode }: { heeftAlPincode: boolean }) {
  const [pin, setPin] = useState("");
  const [bevestiging, setBevestiging] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit() {
    setError(null);
    setSaved(false);
    if (pin !== bevestiging) {
      setError("De twee pincodes komen niet overeen.");
      return;
    }
    startTransition(async () => {
      const res = await setPincode(pin);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPin("");
      setBevestiging("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-[#FDF1DE] text-[#B4790C] flex items-center justify-center shrink-0">
          <KeyRound size={15} />
        </div>
        <div className="font-bold text-[#171A2B]">{heeftAlPincode ? "Pincode wijzigen" : "Pincode instellen"}</div>
      </div>
      <p className="text-xs text-[#8A8FA8] mb-4">
        Deze pincode heeft niets te maken met je wachtwoord. Ze wordt gevraagd als extra bevestiging vlak v&oacute;&oacute;r
        gevoelige acties, zoals iets verwijderen of een telling goedkeuren.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Nieuwe pincode</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="4-6 cijfers"
            className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Bevestig</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={bevestiging}
            onChange={(e) => setBevestiging(e.target.value.replace(/\D/g, ""))}
            placeholder="Herhaal"
            className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <div className="text-xs text-[#D6493C] mt-3">{error}</div>}
      {saved && <div className="text-xs text-[#1FAE7A] mt-3">Pincode opgeslagen.</div>}

      <button
        onClick={submit}
        disabled={pending || pin.length < 4 || bevestiging.length < 4}
        className="mt-4 px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Bezig\u2026" : "Opslaan"}
      </button>
    </div>
  );
}
