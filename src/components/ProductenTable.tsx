"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Product, Building, Afrekenmodus } from "@/lib/types";
import { CATEGORIES, AFREKENMODUS_LABELS } from "@/lib/types";
import { addProduct, updateProductField, deleteProduct, toggleStandaard } from "@/app/(app)/producten/actions";

type Link = { product_id: string; building_id: string };

export default function ProductenTable({
  products,
  buildings,
  links,
  canEdit,
}: {
  products: Product[];
  buildings: Building[];
  links: Link[];
  canEdit: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [newPrijs, setNewPrijs] = useState("");
  const [newCategorie, setNewCategorie] = useState(CATEGORIES[0]);
  const [newVerpakking, setNewVerpakking] = useState("1");
  const [newAfrekenmodus, setNewAfrekenmodus] = useState<Afrekenmodus>("standaard");
  const [pending, startTransition] = useTransition();

  function isStandaard(productId: string, buildingId: string) {
    return links.some((l) => l.product_id === productId && l.building_id === buildingId);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const fd = new FormData();
    fd.set("name", newName.trim());
    fd.set("prijs", newPrijs || "0");
    fd.set("categorie", newCategorie);
    fd.set("verpakking", newVerpakking || "1");
    fd.set("afrekenmodus", newAfrekenmodus);
    startTransition(() => addProduct(fd));
    setNewName("");
    setNewPrijs("");
    setNewVerpakking("1");
    setNewAfrekenmodus("standaard");
  }

  const grouped = CATEGORIES.map((cat) => ({
    categorie: cat,
    items: products.filter((p) => p.categorie === cat),
  })).filter((g) => g.items.length > 0);
  const overige = products.filter((p) => !CATEGORIES.includes(p.categorie));
  if (overige.length > 0) grouped.push({ categorie: "Overige", items: overige });

  return (
    <div>
      {canEdit && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-6">
          <div className="grid md:grid-cols-5 gap-3 mb-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Productnaam"
              className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm md:col-span-2"
            />
            <select value={newCategorie} onChange={(e) => setNewCategorie(e.target.value)} className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              value={newVerpakking}
              onChange={(e) => setNewVerpakking(e.target.value)}
              type="number" min="1"
              placeholder="Verpakking"
              className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
              title="Aantal stuks per verpakking (bv. 24 voor een krat)"
            />
            <input
              value={newPrijs}
              onChange={(e) => setNewPrijs(e.target.value)}
              type="number" step="0.01" min="0"
              placeholder="Prijs (€)"
              className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={newAfrekenmodus} onChange={(e) => setNewAfrekenmodus(e.target.value as Afrekenmodus)} className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm flex-1 min-w-[280px]">
              {Object.entries(AFREKENMODUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            >
              <Plus size={15} /> Toevoegen
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase sticky top-0 z-20">
            <tr>
              <th className="text-left px-5 py-3 font-semibold sticky left-0 z-30 bg-[#F7F7FB] rounded-tl-2xl">Product</th>
              <th className="text-left px-3 py-3 font-semibold">Verpakking</th>
              <th className="text-left px-3 py-3 font-semibold">Prijs</th>
              <th className="text-center px-3 py-3 font-semibold">Actief</th>
              {buildings.map((b) => (
                <th key={b.id} className="text-center px-3 py-3 font-semibold whitespace-nowrap">{b.name}</th>
              ))}
              {canEdit && <th className="px-5 py-3 rounded-tr-2xl"></th>}
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={4 + buildings.length} className="px-5 py-6 text-sm text-[#B0B4CC]">
                  Nog geen producten toegevoegd.
                </td>
              </tr>
            )}
            {grouped.map((group) => (
              <>
                <tr key={group.categorie} className="bg-[#F7F7FB] border-t border-[#ECECF3]">
                  <td colSpan={4 + buildings.length + (canEdit ? 1 : 0)} className="px-5 py-2 text-xs font-semibold text-[#8A8FA8] uppercase sticky left-0">
                    {group.categorie} <span className="text-[#B0B4CC]">({group.items.length})</span>
                  </td>
                </tr>
                {group.items.map((p) => (
                  <tr key={p.id} className={`border-t border-[#ECECF3] ${!p.actief ? "opacity-50" : ""}`}>
                    <td className="px-5 py-3 sticky left-0 z-10 bg-white">
                      {canEdit ? (
                        <input
                          defaultValue={p.name}
                          onBlur={(e) => {
                            if (e.target.value.trim() && e.target.value !== p.name) {
                              startTransition(() => updateProductField(p.id, "name", e.target.value.trim()));
                            }
                          }}
                          className="font-medium text-[#171A2B] border border-transparent hover:border-[#ECECF3] focus:border-[#ECECF3] rounded-lg px-2 py-1 -mx-2 w-full"
                        />
                      ) : (
                        <span className="font-medium text-[#171A2B]">{p.name}</span>
                      )}
                      {p.afrekenmodus === "toeslag" && (
                        <div className="text-[11px] text-[#8A8FA8] mt-0.5">Boete / toeslag</div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {canEdit ? (
                        <input
                          type="number" min="1" defaultValue={p.verpakking}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!Number.isNaN(v) && v !== p.verpakking) startTransition(() => updateProductField(p.id, "verpakking", v));
                          }}
                          className="w-16 border border-transparent hover:border-[#ECECF3] focus:border-[#ECECF3] rounded-lg px-2 py-1 -mx-2"
                        />
                      ) : (
                        <span className="text-[#5B5F82]">{p.verpakking}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {canEdit ? (
                        <div className="relative w-24">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#8A8FA8] text-sm pointer-events-none">
                            &euro;
                          </span>
                          <input
                            type="number" step="0.01" defaultValue={p.prijs}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (!Number.isNaN(v) && v !== p.prijs) startTransition(() => updateProductField(p.id, "prijs", v));
                            }}
                            className="w-full border border-transparent hover:border-[#ECECF3] focus:border-[#ECECF3] rounded-lg pl-5 pr-2 py-1"
                          />
                        </div>
                      ) : (
                        <span>&euro;{p.prijs.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        defaultChecked={p.actief}
                        onChange={(e) => startTransition(() => updateProductField(p.id, "actief", e.target.checked))}
                      />
                    </td>
                    {p.afrekenmodus === "standaard" ? (
                      buildings.map((b) => (
                        <td key={b.id} className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            disabled={!canEdit}
                            defaultChecked={isStandaard(p.id, b.id)}
                            onChange={(e) => startTransition(() => toggleStandaard(p.id, b.id, e.target.checked))}
                          />
                        </td>
                      ))
                    ) : (
                      <td colSpan={buildings.length} className="px-3 py-3 text-center text-xs text-[#8A8FA8] italic">
                        Als toeslag
                      </td>
                    )}
                    {canEdit && (
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm(`"${p.name}" verwijderen?`)) startTransition(() => deleteProduct(p.id));
                          }}
                          className="text-[#B0B4CC] hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
