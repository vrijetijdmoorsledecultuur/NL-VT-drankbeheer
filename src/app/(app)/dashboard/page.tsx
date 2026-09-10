import Link from "next/link";
import {
  Calendar,
  ClipboardList,
  Zap,
  Package,
  Building2,
  Users,
  MapPin,
  Settings,
  ListChecks,
  Boxes,
  ShoppingCart,
  ScrollText,
  AlertTriangle,
  FileCheck2,
  ClipboardCheck,
  BarChart3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Building, Reservation, Telling, VerbruikRegel, Voorraadverplaatsing, VoorraadControletelling, Product, LogboekRegel, Contact } from "@/lib/types";
import { voornaam } from "@/lib/naam";
import { computeVoorraad } from "@/lib/verbruik";
import { formatDateTime } from "@/lib/format";
import GroupCard, { type Group } from "@/components/GroupCard";
import SectionBand, { type BandTone } from "@/components/SectionBand";
import ActiefGebouwPaneel from "@/components/ActiefGebouwPaneel";
import ZaalbezettingPaneel from "@/components/ZaalbezettingPaneel";
import Greeting from "@/components/Greeting";

const ACTIE_LABELS: Record<string, string> = {
  levering: "Levering",
  eigen_verbruik: "Eigen verbruik",
  levering_verwijderd: "Levering verwijderd",
  eigen_verbruik_verwijderd: "Eigen verbruik verwijderd",
  boete_aangevinkt: "Boete aangevinkt",
  boete_afgevinkt: "Boete afgevinkt",
  toegangscode_gepland: "Toegangscode gepland",
  toegangscode_verstuurd: "Toegangscode verstuurd",
  toegangscode_verwijderd: "Toegangscode verwijderd",
  telling_goedgekeurd: "Telling goedgekeurd",
  telling_genegeerd: "Telling genegeerd",
  controletelling_goedgekeurd: "Controletelling goedgekeurd",
  reservatie_afgerond: "Reservatie afgerond",
  reservatie_verwijderd: "Reservatie verwijderd",
  reservatie_manueel_aangemaakt: "Snelle verhuring geboekt",
  contact_verwijderd: "Contact verwijderd",
  verplaatsing: "Verplaatsing",
  bestelling_aangemaakt: "Bestelling aangemaakt",
  bestelling_verstuurd: "Bestelling verstuurd",
  bestelling_geannuleerd: "Bestelling geannuleerd",
  levering_bevestigd: "Levering bevestigd",
  factuur_aangemaakt: "Factuur/creditnota",
  recreatex_verwerkt: "Recreatex verwerkt",
  gebruiker_verwijderd: "Gebruiker verwijderd",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ zaaldatum?: string }> }) {
  const { zaaldatum } = await searchParams;
  const zaalDatum = zaaldatum || new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>();

  const role = profile?.role ?? "administratie";
  const firstName = voornaam(profile?.full_name, profile?.email);
  const isAdmin = role === "systeembeheerder";
  const isBeperkt = role === "theatertechnieker";

  if (isBeperkt) {
    return <BeperktDashboard firstName={firstName} />;
  }

  const vandaag = new Date().toISOString().slice(0, 10);

  const [
    { data: buildings },
    { data: reservatiesVandaag },
    { data: openTellingen },
    { count: openFacturenCount },
    { count: klaarVoorRecreatexCount },
    { data: products },
    { data: productBuildings },
    { data: allReservations },
    { data: tellingen },
    { data: leveringen },
    { data: eigenVerbruik },
    { data: verplaatsingen },
    { data: controletellingen },
    { data: logboekRegels },
    { data: contacts },
  ] = await Promise.all([
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase.from("reservations").select("id, building_id").eq("begin_datum", vandaag),
    supabase.from("ruwe_tellingen").select("id, building_id").eq("status", "open"),
    supabase.from("facturen").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("reservations").select("*", { count: "exact", head: true }).eq("status", "gecontroleerd").eq("recreatex_verwerkt", false),
    supabase.from("products").select("id, name, prijs, categorie, verpakking, actief, afrekenmodus").eq("actief", true).eq("afrekenmodus", "standaard"),
    supabase.from("product_buildings").select("product_id, building_id, volgorde, minimum_voorraad, streef_voorraad"),
    supabase
      .from("reservations")
      .select("id, building_id, contact_id, huurder, adres, telefoon, activiteit, ruimte, begin_datum, eind_datum, toegang_start, activiteit_start, activiteit_eind, toegang_eind, status, bron, recreatex_verwerkt, recreatex_verwerkt_door, recreatex_verwerkt_op"),
    supabase.from("reservation_product_tellingen").select("reservation_id, product_id, vooraf, nadien"),
    supabase.from("leveringen").select("id, reservation_id, building_id, datum, product_id, aantal, wie"),
    supabase.from("eigen_verbruik").select("id, reservation_id, building_id, datum, product_id, aantal, wie"),
    supabase.from("voorraadverplaatsingen").select("id, product_id, van_building_id, naar_building_id, aantal, datum, reden, wie"),
    supabase.from("voorraad_controletellingen").select("id, building_id, product_id, aantal, datum, created_at"),
    supabase.from("logboek").select("id, created_at, gebruiker_naam, actie, omschrijving, building_id, reservation_id").order("created_at", { ascending: false }).limit(40),
    supabase.from("contacts").select("id, ruwe_naam, vereniging, contactpersoon, telefoon, adres"),
  ]);

  const buildingList = (buildings as Building[]) || [];
  const productList = (products as Product[]) || [];
  const pbList = (productBuildings as { product_id: string; building_id: string; volgorde: number; minimum_voorraad: number | null; streef_voorraad: number | null }[]) || [];
  const reservationList = (allReservations as Reservation[]) || [];
  const contactList = (contacts as Contact[]) || [];
  const zaalReservaties = reservationList.filter((r) => r.begin_datum <= zaalDatum && r.eind_datum >= zaalDatum);
  const tellingList = (tellingen as Telling[]) || [];
  const leveringList = (leveringen as VerbruikRegel[]) || [];
  const eigenList = (eigenVerbruik as VerbruikRegel[]) || [];
  const verplaatsingList = (verplaatsingen as Voorraadverplaatsing[]) || [];
  const controleList = (controletellingen as VoorraadControletelling[]) || [];

  // Onder minimumvoorraad tellen — over alle gebouwen heen, enkel producten
  // waar effectief een minimum is ingesteld.
  let onderMinimumCount = 0;
  for (const b of buildingList) {
    const gebouwProducten = pbList
      .filter((l) => l.building_id === b.id)
      .map((l) => productList.find((p) => p.id === l.product_id))
      .filter((p): p is Product => !!p);
    if (gebouwProducten.length === 0) continue;
    const voorraad = computeVoorraad(b.id, gebouwProducten, reservationList, tellingList, leveringList, eigenList, verplaatsingList, controleList);
    for (const p of gebouwProducten) {
      const link = pbList.find((l) => l.building_id === b.id && l.product_id === p.id);
      const stuks = voorraad[p.id]?.stuks;
      if (link?.minimum_voorraad != null && stuks != null && stuks < link.minimum_voorraad) onderMinimumCount++;
    }
  }

  const reservatiesVandaagList = (reservatiesVandaag as { id: string; building_id: string }[]) || [];
  const openTellingenList = (openTellingen as { id: string; building_id: string }[]) || [];

  const bands = sectionBands(isAdmin);

  return (
    <div>
      <div className="text-[#8A8FA8] text-sm font-medium mb-1">Vandaag</div>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-6"><Greeting firstName={firstName} /></h1>

      <div className="text-sm font-semibold text-[#8A8FA8] mb-2">Aandacht vandaag</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Link href="/controle" className="bg-white rounded-xl border border-[#ECECF3] px-3 py-2.5 hover:border-[#D8D3F7] transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#FAECE7] text-[#B4502F] flex items-center justify-center shrink-0">
              <ClipboardCheck size={12} />
            </div>
            <div className="text-lg font-bold text-[#171A2B]">{openTellingenList.length + (openFacturenCount ?? 0)}</div>
          </div>
          <div className="text-[11px] text-[#8A8FA8] mt-1 leading-tight">Te controleren (tellingen & facturen)</div>
        </Link>
        <Link href="/reservaties" className="bg-white rounded-xl border border-[#ECECF3] px-3 py-2.5 hover:border-[#D8D3F7] transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#E7F0FD] text-[#2F6FCB] flex items-center justify-center shrink-0">
              <FileCheck2 size={12} />
            </div>
            <div className="text-lg font-bold text-[#171A2B]">{klaarVoorRecreatexCount ?? 0}</div>
          </div>
          <div className="text-[11px] text-[#8A8FA8] mt-1 leading-tight">Klaar voor Recreatex</div>
        </Link>
        <Link href="/voorraad" className="bg-white rounded-xl border border-[#ECECF3] px-3 py-2.5 hover:border-[#D8D3F7] transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#FDF1DE] text-[#B4790C] flex items-center justify-center shrink-0">
              <AlertTriangle size={12} />
            </div>
            <div className="text-lg font-bold text-[#171A2B]">{onderMinimumCount}</div>
          </div>
          <div className="text-[11px] text-[#8A8FA8] mt-1 leading-tight">Onder minimumvoorraad</div>
        </Link>
        <Link href="/reservaties" className="bg-white rounded-xl border border-[#ECECF3] px-3 py-2.5 hover:border-[#D8D3F7] transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#EEEDFE] text-[#3C3489] flex items-center justify-center shrink-0">
              <Calendar size={12} />
            </div>
            <div className="text-lg font-bold text-[#171A2B]">{reservatiesVandaagList.length}</div>
          </div>
          <div className="text-[11px] text-[#8A8FA8] mt-1 leading-tight">Reservaties vandaag</div>
        </Link>
      </div>

      <div className="lg:flex lg:gap-6 lg:items-start mb-6">
        <div className="lg:w-3/5 min-w-0">
          <h2 className="text-lg font-bold text-[#171A2B] mb-1">Snel naar</h2>
          <p className="text-[#8A8FA8] text-sm mb-4">Open meteen de module waarin je wilt werken.</p>
          {bands.map((band) => (
            <SectionBand key={band.title} tone={band.tone} eyebrow={band.eyebrow} title={band.title} rows={band.rows} />
          ))}
        </div>

        <div className="lg:flex-1 min-w-0 mt-6 lg:mt-0">
          <div className="text-sm font-semibold text-[#8A8FA8] mb-2">Live overzicht</div>
          <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
            <div className="bg-[#F1EFE8] px-3 py-2 grid grid-cols-[1fr_90px_90px] gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#444441]">
              <div>Gebouw</div>
              <div className="text-right" title="Aantal reservaties vandaag in dit gebouw">
                Reservaties
              </div>
              <div className="text-right" title="Aantal dranktellingen die nog gecontroleerd moeten worden">
                Te controleren
              </div>
            </div>
            <div className="divide-y divide-[#ECECF3]">
              {buildingList.map((b) => {
                const resCount = reservatiesVandaagList.filter((r) => r.building_id === b.id).length;
                const tellingCount = openTellingenList.filter((t) => t.building_id === b.id).length;
                const actieNodig = tellingCount > 0;
                return (
                  <Link
                    key={b.id}
                    href="/controle"
                    className={`grid grid-cols-[1fr_90px_90px] gap-1 items-center px-3 py-2 hover:bg-[#F7F7FB] transition-colors ${
                      actieNodig ? "bg-[#FDF1DE]/40" : ""
                    }`}
                  >
                    <span className="text-xs font-semibold text-[#171A2B] truncate">{b.name}</span>
                    <span className="text-xs text-right text-[#5B5F82]">{resCount || "—"}</span>
                    <span className="text-xs text-right">
                      {actieNodig ? <span className="font-semibold text-[#B4790C]">{tellingCount}</span> : <span className="text-[#B0B4CC]">—</span>}
                    </span>
                  </Link>
                );
              })}
              {buildingList.length === 0 && <div className="px-3 py-2 text-sm text-[#B0B4CC]">Nog geen actieve gebouwen.</div>}
            </div>
          </div>
        </div>
      </div>

      <ZaalbezettingPaneel
        selectedDate={zaalDatum}
        buildings={buildingList}
        reservations={zaalReservaties}
        contacts={contactList}
      />

      <ActiefGebouwPaneel
        buildings={buildingList}
        logboekRegels={(logboekRegels as LogboekRegel[]) || []}
        reservatiesVandaag={reservatiesVandaagList}
        openTellingen={openTellingenList}
      />

      <div className="text-sm font-semibold text-[#8A8FA8] mb-2">Sinds je laatste bezoek</div>
      <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
        {(!logboekRegels || logboekRegels.length === 0) && (
          <div className="px-5 py-4 text-sm text-[#B0B4CC]">Nog geen recente activiteit.</div>
        )}
        {(logboekRegels as LogboekRegel[] | null)?.slice(0, 6).map((r, i) => (
          <div key={r.id} className={`flex items-center justify-between px-5 py-2.5 ${i > 0 ? "border-t border-[#ECECF3]" : ""}`}>
            <div className="min-w-0">
              <div className="text-sm text-[#171A2B] truncate">
                {ACTIE_LABELS[r.actie] || r.actie} &mdash; {r.omschrijving}
              </div>
              <div className="text-xs text-[#8A8FA8]">{r.gebruiker_naam || "Onbekend"}</div>
            </div>
            <div className="text-xs text-[#B0B4CC] whitespace-nowrap shrink-0 ml-2">{formatDateTime(r.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BeperktDashboard({ firstName }: { firstName: string | undefined }) {
  const groups: Group[] = [
    {
      title: "Jouw verbruik",
      description: "Registreer wat je zelf meeneemt of gebruikt.",
      rows: [
        {
          href: "/verwerking",
          icon: Zap,
          iconBg: "bg-[#E7F0FD]",
          iconColor: "text-[#3B6FC9]",
          title: "Snelle verwerking",
          description: "Eigen verbruik registreren (bv. voor artiesten).",
        },
        {
          href: "/tellen",
          icon: ListChecks,
          iconBg: "bg-[#E1F5F1]",
          iconColor: "text-[#1B9C82]",
          title: "Zelf tellen",
          description: "Zelf een telling invoeren voor een gebouw.",
        },
      ],
    },
  ];

  return (
    <div>
      <div className="text-[#8A8FA8] text-sm font-medium mb-1">Vandaag</div>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-6"><Greeting firstName={firstName} /></h1>
      <h2 className="text-lg font-bold text-[#171A2B] mb-1">Snel naar</h2>
      <p className="text-[#8A8FA8] text-sm mb-4">Open meteen de module waarin je wilt werken.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map((group) => (
          <GroupCard key={group.title} group={group} />
        ))}
      </div>
    </div>
  );
}

function sectionBands(isAdmin: boolean): { tone: BandTone; eyebrow: string; title: string; rows: { href: string; icon: typeof ClipboardList; title: string; description: string }[] }[] {
  return [
    {
      tone: "teal",
      eyebrow: "Dagelijkse invoer",
      title: "Tellingen",
      rows: [
        { href: "/controle", icon: ClipboardList, title: "Inkomend · ter controle", description: "Tellingen en facturen nakijken en goedkeuren." },
        { href: "/tellen", icon: ListChecks, title: "Zelf tellen", description: "Zelf een telling invoeren voor een gebouw." },
        { href: "/verwerking", icon: Zap, title: "Snelle verwerking · losse factuur", description: "Verbruik of een factuur snel registreren." },
      ],
    },
    {
      tone: "amber",
      eyebrow: "Opvolging",
      title: "Facturatie & voorraad",
      rows: [
        { href: "/bestellingen", icon: ShoppingCart, title: "Bestellingen", description: "Van concept tot bevestigde levering." },
        { href: "/rapporten", icon: BarChart3, title: "Rapportagecentrum · Recreatex", description: "Verbruik, facturen en Recreatex-status." },
        { href: "/voorraad", icon: Boxes, title: "Voorraad", description: "Actuele voorraad per gebouw, live berekend." },
      ],
    },
    {
      tone: "blue",
      eyebrow: "Planning",
      title: "Reservaties",
      rows: [
        { href: "/reservaties", icon: Calendar, title: "Reservaties", description: "Ingelezen huurdersaanvragen." },
        { href: "/zaalbezetting", icon: MapPin, title: "Zaalbezetting", description: "Wie huurt welke zaal wanneer." },
        { href: "/contacten", icon: Users, title: "Contactenbeheer", description: "Verenigingen en contactpersonen." },
      ],
    },
    {
      tone: "purple",
      eyebrow: "Beheer",
      title: "Basisgegevens & toegang",
      rows: [
        { href: "/gebouwen", icon: Building2, title: "Gebouwen & locaties", description: "Alle actieve locaties." },
        { href: "/producten", icon: Package, title: "Producten & prijzen", description: "Prijzen en assortiment per gebouw beheren." },
        { href: "/logboek", icon: ScrollText, title: "Logboek", description: "Wie deed wat, wanneer." },
        ...(isAdmin ? [{ href: "/beheer", icon: Settings, title: "Beheer & rollen", description: "Gebruikers en rollen instellen." }] : []),
      ],
    },
  ];
}
