"use client";

import { useRef, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { inviteUser } from "@/app/(app)/beheer/actions";

export default function InviteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  return (
    <form
      ref={formRef}
      action={(fd) =>
        startTransition(async () => {
          await inviteUser(fd);
          formRef.current?.reset();
          setSent(true);
          setTimeout(() => setSent(false), 3000);
        })
      }
      className="bg-white rounded-2xl border border-[#ECECF3] p-5 flex flex-wrap items-end gap-3"
    >
      <div>
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase">Naam</label>
        <input name="full_name" className="w-full mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm" placeholder="Voornaam Achternaam" />
      </div>
      <div>
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase">E-mailadres</label>
        <input name="email" type="email" required className="w-full mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm" placeholder="naam@voorbeeld.be" />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
      >
        <UserPlus size={15} /> Uitnodigen
      </button>
      {sent && <span className="text-sm text-[#1B8E63] font-medium">Uitnodiging verstuurd ✓</span>}
    </form>
  );
}
