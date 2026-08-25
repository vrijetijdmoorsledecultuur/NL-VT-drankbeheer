"use client";

import { useEffect, useState } from "react";
import { X, ShieldAlert } from "lucide-react";
import { verifyPincode } from "@/app/(app)/instellingen/actions";

export default function PincodeConfirmModal({
  open,
  title,
  description,
  onCancel,
  onConfirmed,
}: {
  open: boolean;
  title: string;
  description?: string;
  onCancel: () => void;
  onConfirmed: () => void;
}) {
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function submit() {
    setChecking(true);
    setError(null);
    const ok = await verifyPincode(pin);
    setChecking(false);
    if (!ok) {
      setError("Onjuiste pincode.");
      return;
    }
    onConfirmed();
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#FDECEC] text-[#D6493C] flex items-center justify-center">
            <ShieldAlert size={17} />
          </div>
          <button onClick={onCancel} className="text-[#8A8FA8] hover:text-[#171A2B]">
            <X size={18} />
          </button>
        </div>
        <div className="font-bold text-[#171A2B] mb-1">{title}</div>
        {description && <p className="text-sm text-[#8A8FA8] mb-4">{description}</p>}

        <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Pincode</label>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2.5 text-sm"
        />
        {error && <div className="text-xs text-[#D6493C] mt-2">{error}</div>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={submit}
            disabled={checking || pin.length < 4}
            className="flex-1 py-2.5 rounded-lg bg-[#D6493C] text-white text-sm font-semibold disabled:opacity-50"
          >
            {checking ? "Bezig\u2026" : "Bevestigen"}
          </button>
          <button onClick={onCancel} className="px-4 py-2.5 rounded-lg border border-[#ECECF3] text-sm font-semibold text-[#8A8FA8]">
            Annuleer
          </button>
        </div>
      </div>
    </div>
  );
}
