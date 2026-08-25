"use client";

import { useRef, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import type { Building, Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { addPendingRole } from "@/app/(app)/beheer/actions";

export default function AddPendingRoleForm({ buildings }: { buildings: Building[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<Role>("administratie");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      ref={formRef}
      action={(fd) =>
        startTransition(async () => {
          fd.set("role", role);
          await addPendingRole(fd);
          formRef.current?.reset();
          setRole("administratie");
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
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
      <div>
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase">Rol</label>
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm">
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="px-4 py-2 rounded-lg bg-[#171A2B] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
      >
        <UserPlus size={15} /> Klaarzetten (geen mail)
      </button>
      {saved && <span className="text-sm text-[#1B8E63] font-medium">Klaargezet ✓</span>}
      <p className="text-xs text-[#B0B4CC] w-full">
        Gebouw toewijzen (voor gebouwbeheerder) doe je hieronder in de lijst, na het klaarzetten.
      </p>
    </form>
  );
}
