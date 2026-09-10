"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, HelpCircle, ShoppingCart } from "lucide-react";
import type { Building, Product, Reservation, Telling, VerbruikRegel, Voorraadverplaatsing, VoorraadControletelling } from "@/lib/types";
import { computeVoorraad } from "@/lib/verbruik";
import { formatDate } from "@/lib/format";
import { setVoorraadDrempel, createBestelling } from "@/app/(app)/bestellingen/actions";

type ProductBuildingLink = {
  product_id: string;
  building_id: string;
  volgorde: number;
  minimum_voorraad: number | null;
  streef_voorraad: number | null;
};

export default function VoorraadView({
  buildings,
  products,
  productBuildings,
  reservations,
  tellingen,
  leveringen,
  eigenVerbruik,
  verplaatsingen,
  controletellingen,
  canEdit,
  defaultNaam,
}: {
  buildings: Building[];
  products: Product[];
  productBuildings: ProductBuildingLink[];
  reservations: Reservation[];
  tellingen: Telling[];
  leveringen: VerbruikRegel[];
  eigenVerbruik: VerbruikRegel[];
  verplaatsingen: Voorraadverplaatsing[];
  controletellingen: VoorraadControletelling[];
  canEdit: boolean;
  defaultNaam: string;
}) {
  const router = useRouter();
  const [buildingId, setBuildingId] = useState(buildings[0]?.id || "");
  const [pending, startTransition] = useTransition();
  const [bestelBezig, setBestelBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);

  const links = useMemo(
    () =>
      productBuildings
        .filter((l) => l.building_id === buildingId)
        .sort((a, b) => a.volgorde - b.volgorde || a.product_id.localeCompare(b.product_id)),
    [productBuildings, buildingId]
  );
  const gebouwProducten = useMemo(
    () => links.map((l) => products.find((p) => p.id === l.product_id)).filter((p): p is Product => !!p),
    [links, products]
  );

  const voorraad = useMemo(
    () =>
      buildingId
        ? computeVoorraad(buildingId, gebouwProducten, reservations, tellingen, leveringen, eigenVerbruik, verplaatsingen, controletellingen)
        : {},
    [buildingId, gebouwProducten, reservations, tellingen, leveringen, eigenVerbruik, verplaatsingen, controletellingen]
  );

  const onbekendCount = gebouwProducten.filter((p) => voorraad[p.id]?.stuks == null).length;

  const onderMinimum = useMemo(() => {
    return gebouwProducten
      .map((p) => {
        const link = links.find((l) => l.product_id === p.id);
        const stuks = voorraad[p.id]?.stuks;
        if (!link?.minimum_voorraad || stuks == null || stuks >= link.minimum_voorraad) return null;
        const streef = link.streef_voorraad ?? link.minimum_voorraad;
        const voorstel = Math.max(streef - stuks, 1);
        return { product: p, stuks, minimum: link.minimum_voorraad, voorstel };
      })
      .filter((x): x is { product: Product; stuks: number; minimum: number; voorstel: number } => !!x);
  }, [gebouwProducten, links, voorraad]);

  function saveDrempel(productId: string, minimum: string, streef: string) {
    const min = minimum === "" ? null : Number(minimum);
    const str = streef === "" ? null : Number(streef);
    startTransition(() => setVoorraadDrempel(productId, buildingId, min, str).then(() => router.refresh()));
  }

  function maakBestelvoorstel() {
    setBestelBezig(true);
    startTransition(async () => {
      const regels = onderMinimum.map((x) => ({ productId: x.product.id, aantal: x.voorstel }));
      const id = await createBestelling(buildingId, null, regels, defaultNaam);
      setBestelBezig(false);
      if (id) {
        setMelding("Bestelvoorstel aangemaakt als concept.");
        router.push("/bestellingen");
      }
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-1">Voorraad</h1>
      <p className="text-[#8A8FA8] text-sm mb-6">
        Berekend vanaf de laatste bevestigde telling per product, plus alle leveringen, eigen verbruik en
        verplaatsingen sindsdien. Geen apart bijgehouden getal &mdash; dus nooit uit sync met de werkelijkheid.
      </p>

      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <select
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
          className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm bg-white"
        >
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {canEdit && onderMinimum.length > 0 && (
          <button
            onClick={maakBestelvoorstel}
            disabled={bestelBezig}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
          >
            <ShoppingCart size={15} />
            {bestelBezig ? "Bezig\u2026" : `Bestelvoorstel aanmaken (${onderMinimum.length})`}
          </button>
        )}
      </div>

      {melding && <div className="text-sm text-[#1FAE7A] mb-4">{melding}</div>}

      {onderMinimum.length > 0 && (
        <div className="bg-[#FDECEC] text-[#B03A30] text-sm rounded-xl px-4 py-3 mb-5 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <span>
            {onderMinimum.length} product(en) staan onder de ingestelde minimumvoorraad voor dit gebouw:{" "}
            {onderMinimum.map((x) => x.product.name).join(", ")}.
          </span>
        </div>
      )}

      {onbekendCount > 0 && (
        <div className="bg-[#FDF1DE] text-[#8A6A2C] text-sm rounded-xl px-4 py-3 mb-5 flex items-start gap-2">
          <HelpCircle size={16} className="shrink-0 mt-0.5" />
          <span>
            Voor {onbekendCount} product(en) is nog geen telling bekend in dit gebouw &mdash; daarvoor is geen
            betrouwbaar ijkpunt om de voorraad vanaf te berekenen.
          </span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase sticky top-0 z-10">
            <tr>
              <th className="text-left px-5 py-2.5 font-semibold rounded-tl-2xl">Product</th>
              <th className="text-right px-3 py-2.5 font-semibold">Voorraad</th>
              <th className="text-left px-3 py-2.5 font-semibold">Sinds</th>
              <th className="text-right px-3 py-2.5 font-semibold">Minimum</th>
              <th className="text-right px-5 py-2.5 font-semibold rounded-tr-2xl">Streef</th>
            </tr>
          </thead>
          <tbody>
            {gebouwProducten.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-sm text-[#B0B4CC]">
                  Dit gebouw heeft nog geen producten gekoppeld.
                </td>
              </tr>
            )}
            {gebouwProducten.map((p) => {
              const v = voorraad[p.id];
              const link = links.find((l) => l.product_id === p.id);
              const onbekend = v?.stuks == null;
              const negatief = v?.stuks != null && v.stuks < 0;
              const alarm = link?.minimum_voorraad != null && v?.stuks != null && v.stuks < link.minimum_voorraad;
              return (
                <tr key={p.id} className={`border-t border-[#ECECF3] ${alarm ? "bg-[#FDECEC]" : ""}`}>
                  <td className="px-5 py-2.5 font-medium text-[#171A2B]">
                    {p.name}
                    {alarm && <AlertTriangle size={12} className="inline ml-1.5 -mt-0.5 text-[#D6493C]" />}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {onbekend ? (
                      <span className="text-[#B0B4CC]">onbekend</span>
                    ) : (
                      <span className={`font-semibold ${negatief ? "text-[#D6493C]" : "text-[#171A2B]"}`}>{v!.stuks}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[#8A8FA8]">{v?.ijkpuntDatum ? formatDate(v.ijkpuntDatum) : "—"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <input
                      type="number"
                      disabled={!canEdit}
                      defaultValue={link?.minimum_voorraad ?? ""}
                      onBlur={(e) => saveDrempel(p.id, e.target.value, String(link?.streef_voorraad ?? ""))}
                      className="w-16 text-right rounded-lg border border-[#ECECF3] px-2 py-1 disabled:bg-[#F7F7FB]"
                    />
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <input
                      type="number"
                      disabled={!canEdit}
                      defaultValue={link?.streef_voorraad ?? ""}
                      onBlur={(e) => saveDrempel(p.id, String(link?.minimum_voorraad ?? ""), e.target.value)}
                      className="w-16 text-right rounded-lg border border-[#ECECF3] px-2 py-1 disabled:bg-[#F7F7FB]"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
