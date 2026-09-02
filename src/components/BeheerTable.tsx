"use client";

import { useState, useTransition } from "react";
import type { Profile, Building, Role } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { updateRole, setGebouwbeheerderBuildings, setProfileActive, resetLoginPin } from "@/app/(app)/beheer/actions";
import { isPhoneLoginEmail } from "@/lib/login";

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
  const [pinByUser, setPinByUser] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

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
            <th className="text-left px-5 py-3 font-semibold">Aanmelden met</th>
            <th className="text-left px-5 py-3 font-semibold">Rol</th>
            <th className="text-left px-5 py-3 font-semibold">Status &amp; pincode</th>
            <th className="text-left px-5 py-3 font-semibold">Gebouw(en)</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-t border-[#ECECF3] align-top">
              <td className="px-5 py-3 font-medium text-[#171A2B]">
                {p.full_name || "—"} {p.id === currentUserId && <span className="text-xs text-[#8A8FA8]">(jij)</span>}
              </td>
              <td className="px-5 py-3 text-[#5B5F82]"><div>{isPhoneLoginEmail(p.email) ? "—" : p.email}</div><div>{p.phone || "—"}</div></td>
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
              <td className="px-5 py-3 min-w-56">
                <div className="flex items-center gap-2 mb-2"><span className={`text-xs font-semibold rounded-full px-2 py-1 ${p.active === false ? "bg-[#FCEDEC] text-[#B4231C]" : "bg-[#EAF7F1] text-[#1B8E63]"}`}>{p.active === false ? "Non-actief" : "Actief"}</span><button disabled={p.id === currentUserId} onClick={() => startTransition(async () => { const res = await setProfileActive(p.id, p.active === false); setMessage(res.ok ? "Status aangepast." : res.error); })} className="text-xs font-semibold text-[#6D5AE6] disabled:text-[#B0B4CC]">{p.active === false ? "Activeren" : "Deactiveren"}</button></div>
                <div className="flex gap-2"><input aria-label={`Nieuwe pincode voor ${p.full_name || p.email}`} type="password" inputMode="numeric" value={pinByUser[p.id] || ""} onChange={(e) => setPinByUser({ ...pinByUser, [p.id]: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="Nieuwe pincode" className="w-32 rounded-lg border border-[#ECECF3] px-2 py-1 text-xs" /><button onClick={() => startTransition(async () => { const res = await resetLoginPin(p.id, pinByUser[p.id] || ""); setMessage(res.ok ? "Pincode aangepast." : res.error); if (res.ok) setPinByUser({ ...pinByUser, [p.id]: "" }); })} className="text-xs font-semibold text-[#6D5AE6]">Bewaren</button></div>
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
      {message && <div className="border-t border-[#ECECF3] px-5 py-3 text-sm text-[#5B5F82]">{message}</div>}
    </div>
  );
}
