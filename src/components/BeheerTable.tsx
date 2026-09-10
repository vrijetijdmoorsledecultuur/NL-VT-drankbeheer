"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Profile, Building, Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { updateRole, setGebouwbeheerderBuildings, updateProfileGegevens, deleteProfile } from "@/app/(app)/beheer/actions";
import PincodeConfirmModal from "@/components/PincodeConfirmModal";

type Link = { profile_id: string; building_id: string };

export default function BeheerTable({
  profiles,
  buildings,
  profileBuildings,
  currentUserId,
  heeftPincode = false,
}: {
  profiles: Profile[];
  buildings: Building[];
  profileBuildings: Link[];
  currentUserId: string;
  heeftPincode?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);
  const [teVerwijderen, setTeVerwijderen] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildingsFor(profileId: string) {
    return profileBuildings.filter((l) => l.profile_id === profileId).map((l) => l.building_id);
  }

  function toggleBuilding(profileId: string, buildingId: string, checked: boolean) {
    const current = buildingsFor(profileId);
    const next = checked ? [...current, buildingId] : current.filter((id) => id !== buildingId);
    startTransition(() => setGebouwbeheerderBuildings(profileId, next));
  }

  function saveNaam(profileId: string, huidig: string, nieuw: string) {
    if (nieuw.trim() === huidig || !nieuw.trim()) return;
    startTransition(() => {
      updateProfileGegevens(profileId, { fullName: nieuw });
    });
  }

  function saveEmail(profileId: string, huidig: string, nieuw: string) {
    if (nieuw.trim() === huidig || !nieuw.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await updateProfileGegevens(profileId, { email: nieuw });
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  function vraagVerwijderBevestiging(p: Profile) {
    setError(null);
    setTeVerwijderen(p);
  }

  function bevestigVerwijderen() {
    if (!teVerwijderen) return;
    const id = teVerwijderen.id;
    setPending(true);
    setTeVerwijderen(null);
    startTransition(async () => {
      const res = await deleteProfile(id);
      setPending(false);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden overflow-x-auto">
      {error && <div className="px-5 py-2 text-xs text-[#D6493C] bg-[#FDECEC]">{error}</div>}
      <table className="w-full text-sm">
        <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase">
          <tr>
            <th className="text-left px-5 py-3 font-semibold">Naam</th>
            <th className="text-left px-5 py-3 font-semibold">E-mail</th>
            <th className="text-left px-5 py-3 font-semibold">Rol</th>
            <th className="text-left px-5 py-3 font-semibold">Gebouw(en) (indien gebouwbeheerder)</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-t border-[#ECECF3] align-top">
              <td className="px-5 py-3">
                <input
                  defaultValue={p.full_name || ""}
                  placeholder="Naam"
                  onBlur={(e) => saveNaam(p.id, p.full_name || "", e.target.value)}
                  className="font-medium text-[#171A2B] border border-transparent hover:border-[#ECECF3] focus:border-[#ECECF3] rounded-lg px-2 py-1 -mx-2 w-full"
                />
                {p.id === currentUserId && <span className="text-xs text-[#8A8FA8] ml-1">(jij)</span>}
              </td>
              <td className="px-5 py-3">
                <input
                  defaultValue={p.email}
                  onBlur={(e) => saveEmail(p.id, p.email, e.target.value)}
                  disabled={p.id === currentUserId}
                  className="text-[#5B5F82] border border-transparent hover:border-[#ECECF3] focus:border-[#ECECF3] rounded-lg px-2 py-1 -mx-2 w-full disabled:bg-transparent disabled:text-[#B0B4CC]"
                />
              </td>
              <td className="px-5 py-3">
                <select
                  defaultValue={p.role}
                  disabled={p.id === currentUserId}
                  onChange={(e) => startTransition(() => updateRole(p.id, e.target.value as Role))}
                  className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm disabled:bg-[#F7F7FB]"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-5 py-3">
                {p.role === "gebouwbeheerder" ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {buildings.map((b) => (
                      <label key={b.id} className="flex items-center gap-1.5 text-xs text-[#5B5F82]">
                        <input
                          type="checkbox"
                          defaultChecked={buildingsFor(p.id).includes(b.id)}
                          onChange={(e) => toggleBuilding(p.id, b.id, e.target.checked)}
                        />
                        {b.name}
                      </label>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-[#B0B4CC]">n.v.t.</span>
                )}
              </td>
              <td className="px-5 py-3 text-right">
                {p.id !== currentUserId && (
                  <button
                    onClick={() => vraagVerwijderBevestiging(p)}
                    disabled={pending}
                    className="text-[#B0B4CC] hover:text-[#D6493C] disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {heeftPincode ? (
        <PincodeConfirmModal
          open={!!teVerwijderen}
          title={`Gebruiker "${teVerwijderen?.full_name || teVerwijderen?.email}" verwijderen?`}
          description="Dit verwijdert het volledige account, inclusief inlogtoegang. Dit kan niet ongedaan gemaakt worden."
          onCancel={() => setTeVerwijderen(null)}
          onConfirmed={bevestigVerwijderen}
        />
      ) : (
        teVerwijderen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setTeVerwijderen(null)}>
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <div className="font-bold text-[#171A2B] mb-1">
                Gebruiker &quot;{teVerwijderen.full_name || teVerwijderen.email}&quot; verwijderen?
              </div>
              <p className="text-sm text-[#8A8FA8] mb-5">
                Dit verwijdert het volledige account, inclusief inlogtoegang. Dit kan niet ongedaan gemaakt worden.
              </p>
              <div className="flex gap-2">
                <button onClick={bevestigVerwijderen} className="flex-1 py-2.5 rounded-lg bg-[#D6493C] text-white text-sm font-semibold">
                  Ja, verwijderen
                </button>
                <button
                  onClick={() => setTeVerwijderen(null)}
                  className="px-4 py-2.5 rounded-lg border border-[#ECECF3] text-sm font-semibold text-[#8A8FA8]"
                >
                  Annuleer
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
