"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, ClipboardList } from "lucide-react";
import { regenerateUniversalTellerToken } from "@/app/(app)/gebouwen/actions";

export default function UniversalTellerLinkCard({ token, canEdit }: { token: string; canEdit: boolean }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function link() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/tellen/${token}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard kan geblokkeerd zijn; negeer stil
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mt-6">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#FDECEC] text-[#D6493C] flex items-center justify-center shrink-0">
          <ClipboardList size={15} />
        </div>
        <div>
          <div className="font-bold text-[#171A2B]">Tellen-link (poetspersoneel)</div>
          <div className="text-xs text-[#8A8FA8]">
            &Eacute;&eacute;n link voor iedereen &mdash; ze kiezen zelf hun gebouw en telplek. Geen account nodig, en
            invoer telt pas na goedkeuring in Registraties &middot; controle.
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <div className="text-xs text-[#8A8FA8] truncate font-mono">/tellen/{token}</div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ECECF3] text-xs font-semibold text-[#171A2B] hover:bg-[#F7F7FB]"
          >
            {copied ? <Check size={13} className="text-[#1FAE7A]" /> : <Copy size={13} />}
            {copied ? "Gekopieerd" : "Kopieer link"}
          </button>
          {canEdit && (
            <button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await regenerateUniversalTellerToken();
                  router.refresh();
                })
              }
              title="Nieuwe link genereren (oude werkt dan niet meer voor iedereen)"
              className="p-1.5 rounded-lg border border-[#ECECF3] text-[#8A8FA8] hover:text-[#171A2B] hover:bg-[#F7F7FB] disabled:opacity-50"
            >
              <RefreshCw size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
