"use client";

import { useTransition } from "react";
import type { Profile, Building, Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { updateRole, setGebouwbeheerderBuildings } from "@/app/(app)/beheer/actions";

type Link = { profile_id: string; building_id: string };

export default function BeheerTable({
  profiles,
  buildings,
  profileBuildings,
  currentUserId,
}: {
  profiles: Profile[];
  buildings: Building[];
  profileBuildings: Link[];
  currentUserId: string;
}) {
  const [, startTransition] = useTransition();

  function buildingsFor(profileId: string) {
    return profileBuildings.filter((l) => l.profile_id === profileId).map((l) => l.building_id);
  }

  function toggleBuilding(profileId: string, buildingId: string, checked: boolean) {
    const current = buildingsFor(profileId);
    const next = checked ? [...current, buildingId] : current.filter((id) => id !== buildingId);
    startTransition(() => setGebouwbeheerderBuildings(profileId, next));
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase">
          <tr>
            <th className="text-left px-5 py-3 font-semibold">Naam</th>
            <th className="text-left px-5 py-3 font-semibold">E-mail</th>
            <th className="text-left px-5 py-3 font-semibold">Rol</th>
            <th className="text-left px-5 py-3 font-semibold">Gebouw(en) (indien gebouwbeheerder)</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-t border-[#ECECF3] align-top">
              <td className="px-5 py-3 font-medium text-[#171A2B]">
                {p.full_name || "—"} {p.id === currentUserId && <span className="text-xs text-[#8A8FA8]">(jij)</span>}
              </td>
              <td className="px-5 py-3 text-[#5B5F82]">{p.email}</td>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
