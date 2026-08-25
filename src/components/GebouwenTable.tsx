"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Building2 } from "lucide-react";
import type { Building } from "@/lib/types";
import { addBuilding, renameBuilding, toggleBuildingActief, deleteBuilding } from "@/app/(app)/gebouwen/actions";

export default function GebouwenTable({ buildings, canEdit }: { buildings: Building[]; canEdit: boolean }) {
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const fd = new FormData();
    fd.set("name", newName.trim());
    startTransition(() => addBuilding(fd));
    setNewName("");
  }

  return (
    <div>
      {canEdit && (
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Naam nieuw gebouw"
            className="flex-1 max-w-sm rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <Plus size={15} /> Toevoegen
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
        {buildings.length === 0 && (
          <div className="px-5 py-6 text-sm text-[#B0B4CC]">Nog geen gebouwen toegevoegd.</div>
        )}
        <div className="divide-y divide-[#ECECF3]">
          {buildings.map((b) => (
            <div key={b.id} className="flex items-center gap-3 px-5 py-3">
              <Building2 size={16} className="text-[#6D5AE6] shrink-0" />
              {canEdit ? (
                <input
                  defaultValue={b.name}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== b.name) {
                      startTransition(() => renameBuilding(b.id, e.target.value.trim()));
                    }
                  }}
                  className="flex-1 text-sm font-medium text-[#171A2B] border border-transparent hover:border-[#ECECF3] focus:border-[#ECECF3] rounded-lg px-2 py-1 -mx-2"
                />
              ) : (
                <span className="flex-1 text-sm font-medium text-[#171A2B]">{b.name}</span>
              )}

              {canEdit ? (
                <label className="flex items-center gap-2 text-xs text-[#5B5F82]">
                  <input
                    type="checkbox"
                    checked={b.actief}
                    onChange={(e) => startTransition(() => toggleBuildingActief(b.id, e.target.checked))}
                  />
                  Actief
                </label>
              ) : (
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${b.actief ? "bg-[#E4F6EE] text-[#1B8E63]" : "bg-[#F7F7FB] text-[#8A8FA8]"}`}>
                  {b.actief ? "Actief" : "Inactief"}
                </span>
              )}

              {canEdit && (
                <button
                  onClick={() => {
                    if (confirm(`"${b.name}" verwijderen?`)) startTransition(() => deleteBuilding(b.id));
                  }}
                  className="text-[#B0B4CC] hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
