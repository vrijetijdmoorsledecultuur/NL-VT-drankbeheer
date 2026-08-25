"use client";

import { useTransition } from "react";
import { Mail, Trash2 } from "lucide-react";
import type { PendingRole, Building, Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { updatePendingRole, setPendingRoleBuildings, deletePendingRole, inviteFromPending } from "@/app/(app)/beheer/actions";

type Link = { pending_id: string; building_id: string };

export default function PendingRolesTable({
  pendingRoles,
  buildings,
  pendingRoleBuildings,
}: {
  pendingRoles: PendingRole[];
  buildings: Building[];
  pendingRoleBuildings: Link[];
}) {
  const [, startTransition] = useTransition();

  function buildingsFor(pendingId: string) {
    return pendingRoleBuildings.filter((l) => l.pending_id === pendingId).map((l) => l.building_id);
  }

  function toggleBuilding(pendingId: string, buildingId: string, checked: boolean) {
    const current = buildingsFor(pendingId);
    const next = checked ? [...current, buildingId] : current.filter((id) => id !== buildingId);
    startTransition(() => setPendingRoleBuildings(pendingId, next));
  }

  if (pendingRoles.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#ECECF3] px-5 py-6 text-sm text-[#B0B4CC]">
        Nog niemand klaargezet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase">
          <tr>
            <th className="text-left px-5 py-3 font-semibold">Naam</th>
            <th className="text-left px-5 py-3 font-semibold">E-mail</th>
            <th className="text-left px-5 py-3 font-semibold">Rol</th>
            <th className="text-left px-5 py-3 font-semibold">Gebouw(en)</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {pendingRoles.map((p) => (
            <tr key={p.id} className="border-t border-[#ECECF3] align-top">
              <td className="px-5 py-3 font-medium text-[#171A2B]">{p.full_name || "—"}</td>
              <td className="px-5 py-3 text-[#5B5F82]">{p.email}</td>
              <td className="px-5 py-3">
                <select
                  defaultValue={p.role}
                  onChange={(e) => startTransition(() => updatePendingRole(p.id, e.target.value as Role))}
                  className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
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
              <td className="px-5 py-3 text-right whitespace-nowrap">
                <button
                  onClick={() => startTransition(() => inviteFromPending(p.id, p.email, p.full_name))}
                  className="text-[#6D5AE6] font-semibold text-xs mr-3 inline-flex items-center gap-1"
                >
                  <Mail size={13} /> Nodig uit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Klaarzetting voor ${p.email} verwijderen?`)) startTransition(() => deletePendingRole(p.id));
                  }}
                  className="text-[#B0B4CC] hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
