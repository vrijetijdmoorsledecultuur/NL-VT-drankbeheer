"use client";

import { useRef, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import type { Building, Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { createManagedUser } from "@/app/(app)/beheer/actions";

export default function ManagedUserForm({ buildings }: { buildings: Building[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState<Role>("administratie");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  return (
    <form
      ref={formRef}
      action={(fd) => startTransition(async () => {
        fd.set("role", role);
        const result = await createManagedUser(fd);
        if (!result.ok) return setMessage({ tone: "error", text: result.error });
        formRef.current?.reset();
        setRole("administratie");
        setMessage({ tone: "ok", text: "Account aangemaakt. De persoon kan meteen aanmelden." });
      })}
      className="bg-white rounded-2xl border border-[#ECECF3] p-5"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase">Naam
          <input name="full_name" required className="w-full mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm normal-case" placeholder="Voornaam Achternaam" />
        </label>
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase">E-mailadres
          <input name="email" type="email" className="w-full mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm normal-case" placeholder="Optioneel" />
        </label>
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase">Gsm-nummer
          <input name="phone" type="tel" className="w-full mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm normal-case" placeholder="Optioneel" />
        </label>
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase">Rol
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="w-full mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm normal-case">
            {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase">Tijdelijke pincode
          <input name="pin" type="password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required className="w-full mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm tracking-[.25em]" placeholder="••••••" />
        </label>
      </div>
      {role === "gebouwbeheerder" && <fieldset className="mt-4"><legend className="text-xs font-semibold text-[#8A8FA8] uppercase mb-2">Gebouwtoegang</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{buildings.map((building) => <label key={building.id} className="flex items-center gap-2 text-sm text-[#5B5F82]"><input type="checkbox" name="building_ids" value={building.id} />{building.name}</label>)}</div></fieldset>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><UserPlus size={15} />{pending ? "Bezig…" : "Persoon toevoegen"}</button>
        <p className="text-xs text-[#8A8FA8]">Vul minstens een e-mailadres of gsm-nummer in.</p>
        {message && <p className={`text-sm font-medium ${message.tone === "ok" ? "text-[#1B8E63]" : "text-[#B4231C]"}`}>{message.text}</p>}
      </div>
    </form>
  );
}
