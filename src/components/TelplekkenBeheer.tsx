"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, MapPin, Plus, Trash2 } from "lucide-react";
import type { Building, Product, Telplek, TelplekProduct, TelplekVasteVoorraadRegel } from "@/lib/types";
import {
  addTelplek,
  updateTelplek,
  deleteTelplek,
  setTelplekProduct,
  setVasteVoorraadRegel,
} from "@/app/(app)/gebouwen/actions";

export default function TelplekkenBeheer({
  buildings,
  telplekken,
  telplekProducten,
  vasteVoorraadRegels,
  products,
  productBuildingLinks,
  canEdit,
}: {
  buildings: Building[];
  telplekken: Telplek[];
  telplekProducten: TelplekProduct[];
  vasteVoorraadRegels: TelplekVasteVoorraadRegel[];
  products: Product[];
  productBuildingLinks: { product_id: string; building_id: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [openBuildingId, setOpenBuildingId] = useState<string | null>(null);
  const [openTelplekId, setOpenTelplekId] = useState<string | null>(null);
  const [newNaam, setNewNaam] = useState("");
  const [pending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function productsFor(buildingId: string) {
    const ids = new Set(productBuildingLinks.filter((l) => l.building_id === buildingId).map((l) => l.product_id));
    return products.filter((p) => ids.has(p.id));
  }

  function handleAdd(buildingId: string) {
    if (!newNaam.trim()) return;
    startTransition(async () => {
      await addTelplek(buildingId, newNaam.trim());
      setNewNaam("");
      refresh();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mt-6">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#EFEBFF] text-[#6D5AE6] flex items-center justify-center shrink-0">
          <MapPin size={15} />
        </div>
        <div>
          <div className="font-bold text-[#171A2B]">Telplekken</div>
          <div className="text-xs text-[#8A8FA8]">
            Waar in elk gebouw geteld wordt (frigo, koelcel, berging, ...), met eigen producten en optioneel een
            vaste voorraad.
          </div>
        </div>
      </div>

      <div className="divide-y divide-[#ECECF3]">
        {buildings.map((b) => {
          const buildingTelplekken = telplekken.filter((t) => t.building_id === b.id);
          const isOpen = openBuildingId === b.id;
          return (
            <div key={b.id}>
              <button
                onClick={() => setOpenBuildingId(isOpen ? null : b.id)}
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[#F7F7FB]"
              >
                <span className="text-sm font-semibold text-[#171A2B]">{b.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8A8FA8]">{buildingTelplekken.length} telplek(ken)</span>
                  {isOpen ? <ChevronDown size={15} className="text-[#8A8FA8]" /> : <ChevronRight size={15} className="text-[#8A8FA8]" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-4 space-y-2">
                  {buildingTelplekken.map((t) => (
                    <TelplekRow
                      key={t.id}
                      telplek={t}
                      alleTelplekken={buildingTelplekken}
                      products={productsFor(b.id)}
                      telplekProducten={telplekProducten.filter((tp) => tp.telplek_id === t.id)}
                      vasteVoorraad={vasteVoorraadRegels.filter((v) => v.telplek_id === t.id)}
                      open={openTelplekId === t.id}
                      onToggle={() => setOpenTelplekId(openTelplekId === t.id ? null : t.id)}
                      canEdit={canEdit}
                      refresh={refresh}
                    />
                  ))}

                  {canEdit && (
                    <div className="flex gap-2 pt-2">
                      <input
                        value={newNaam}
                        onChange={(e) => setNewNaam(e.target.value)}
                        placeholder="Naam nieuwe telplek, bv. Frigo"
                        className="flex-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
                      />
                      <button
                        disabled={pending}
                        onClick={() => handleAdd(b.id)}
                        className="px-3 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Plus size={14} /> Toevoegen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TelplekRow({
  telplek,
  alleTelplekken,
  products,
  telplekProducten,
  vasteVoorraad,
  open,
  onToggle,
  canEdit,
  refresh,
}: {
  telplek: Telplek;
  alleTelplekken: Telplek[];
  products: Product[];
  telplekProducten: TelplekProduct[];
  vasteVoorraad: TelplekVasteVoorraadRegel[];
  open: boolean;
  onToggle: () => void;
  canEdit: boolean;
  refresh: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function modeFor(productId: string): "standaard" | "optioneel" | "geen" {
    const link = telplekProducten.find((tp) => tp.product_id === productId);
    if (!link) return "geen";
    return link.standaard ? "standaard" : "optioneel";
  }

  return (
    <div className="rounded-xl border border-[#ECECF3]">
      <div className="flex items-center justify-between px-4 py-2.5">
        <button onClick={onToggle} className="flex-1 text-left flex items-center gap-2">
          {open ? <ChevronDown size={14} className="text-[#8A8FA8]" /> : <ChevronRight size={14} className="text-[#8A8FA8]" />}
          <span className="text-sm font-semibold text-[#171A2B]">{telplek.naam}</span>
          {telplek.heeft_vaste_voorraad && (
            <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#E7F7EE] text-[#1F9254] rounded-full px-2 py-0.5">
              vaste voorraad
            </span>
          )}
        </button>
        {canEdit && (
          <button
            onClick={() => {
              if (confirm(`"${telplek.naam}" verwijderen?`)) startTransition(() => deleteTelplek(telplek.id).then(refresh));
            }}
            className="text-[#C7CAE0] hover:text-[#D6493C]"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-[#ECECF3] pt-3 space-y-4">
          {canEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">
                  Heeft vaste voorraad?
                </label>
                <select
                  defaultValue={telplek.heeft_vaste_voorraad ? "ja" : "nee"}
                  onChange={(e) =>
                    startTransition(() => updateTelplek(telplek.id, { heeft_vaste_voorraad: e.target.value === "ja" }).then(refresh))
                  }
                  className="w-full mt-1 rounded-lg border border-[#ECECF3] px-2 py-1.5 text-sm"
                >
                  <option value="nee">Nee</option>
                  <option value="ja">Ja</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">
                  Tel bij voorkeur eerst
                </label>
                <select
                  defaultValue={telplek.vereist_telplek_id || ""}
                  onChange={(e) =>
                    startTransition(() =>
                      updateTelplek(telplek.id, { vereist_telplek_id: e.target.value || null }).then(refresh)
                    )
                  }
                  className="w-full mt-1 rounded-lg border border-[#ECECF3] px-2 py-1.5 text-sm"
                >
                  <option value="">Geen volgorde</option>
                  {alleTelplekken
                    .filter((t) => t.id !== telplek.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.naam}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {telplek.heeft_vaste_voorraad && (
            <div>
              <div className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide mb-2">
                Vaste voorraad (wat er hoort te staan)
              </div>
              <div className="space-y-1.5">
                {products.map((p) => {
                  const regel = vasteVoorraad.find((v) => v.product_id === p.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-[#171A2B] flex-1">{p.name}</span>
                      <input
                        type="number"
                        min={0}
                        defaultValue={regel?.aantal ?? 0}
                        disabled={!canEdit}
                        onBlur={(e) => {
                          const v = Number(e.target.value) || 0;
                          if (v !== (regel?.aantal ?? 0)) startTransition(() => setVasteVoorraadRegel(telplek.id, p.id, v).then(refresh));
                        }}
                        className="w-20 text-center text-sm border border-[#ECECF3] rounded-lg py-1"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide mb-2">
              Producten bij deze telplek
            </div>
            <div className="space-y-1.5">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-[#171A2B] flex-1">{p.name}</span>
                  <select
                    defaultValue={modeFor(p.id)}
                    disabled={!canEdit}
                    onChange={(e) =>
                      startTransition(() =>
                        setTelplekProduct(telplek.id, p.id, e.target.value as "standaard" | "optioneel" | "geen").then(refresh)
                      )
                    }
                    className="rounded-lg border border-[#ECECF3] px-2 py-1 text-xs"
                  >
                    <option value="standaard">Standaard zichtbaar</option>
                    <option value="optioneel">Optioneel (extra)</option>
                    <option value="geen">Niet bij deze telplek</option>
                  </select>
                </div>
              ))}
              {products.length === 0 && (
                <div className="text-xs text-[#B0B4CC]">Dit gebouw heeft nog geen producten gekoppeld.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
