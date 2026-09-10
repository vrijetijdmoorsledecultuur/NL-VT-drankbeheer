"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Home,
  Calendar,
  ClipboardList,
  Zap,
  Package,
  Users,
  Building2,
  LogOut,
  ListChecks,
  BarChart3,
  Settings,
  Boxes,
  ShoppingCart,
  ScrollText,
  ChevronDown,
  ChevronRight,
  Receipt,
  History,
  Mail,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { logout } from "@/app/(app)/actions";

type SubItem = { href: string; label: string };
type NavItem = { href: string; label: string; icon: typeof Home; adminOnly?: boolean; children?: SubItem[] };

// Groepnamen en indeling volgen bewust de BOTTEL-referentie: Overzicht,
// Registreren, Voorraad, Reservaties, Beheer.
const GROUPS: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: Home }],
  },
  {
    title: "Registreren",
    items: [
      { href: "/tellen", label: "Nieuwe telling", icon: ListChecks, children: [
        { href: "/tellen?type=vooraf", label: "Vooraf" },
        { href: "/tellen?type=nadien", label: "Achteraf" },
        { href: "/tellen?type=controle", label: "Controletelling" },
      ] },
      { href: "/reservaties/nieuw", label: "Historische telling", icon: History },
      { href: "/controle", label: "Inkomende tellingen", icon: ClipboardList },
      { href: "/verwerking", label: "Intern gebruik", icon: Zap },
      { href: "/verwerking?type=factuur", label: "Factuur / creditnota", icon: Receipt },
      { href: "/toegangscodes", label: "Externe toegangscode", icon: Mail },
    ],
  },
  {
    title: "Voorraad",
    items: [
      { href: "/voorraad", label: "Actuele voorraad", icon: Boxes },
      { href: "/bestellingen", label: "Bestellen & leveren", icon: ShoppingCart },
    ],
  },
  {
    title: "Reservaties",
    items: [
      { href: "/reservaties", label: "Reservatiedossiers", icon: Calendar, children: [
        { href: "/reservaties?tab=komende", label: "Komende" },
        { href: "/reservaties?tab=afgelopen", label: "Afgelopen" },
        { href: "/reservaties?tab=kalender", label: "Kalender" },
      ] },
      { href: "/contacten", label: "Verenigingen & klanten", icon: Users },
      { href: "/rapporten", label: "Recreatex · rapporten", icon: BarChart3 },
    ],
  },
  {
    title: "Beheer",
    items: [
      { href: "/gebouwen", label: "Gebouwen & locaties", icon: Building2 },
      { href: "/producten", label: "Producten & prijzen", icon: Package },
      { href: "/logboek", label: "Logboek", icon: ScrollText },
      { href: "/beheer", label: "Beheer & rollen", icon: Users, adminOnly: true },
    ],
  },
];

// Theatertechniekers registreren enkel hun eigen verbruik en tellen af en toe
// mee — geen zicht op reservaties, contacten of beheer.
const BEPERKTE_NAV_HREFS = ["/dashboard", "/tellen", "/verwerking"];

export default function Sidebar({
  role,
  logboekOngelezen = 0,
  controleOngelezen = 0,
}: {
  role: Role;
  logboekOngelezen?: number;
  controleOngelezen?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isBeperkt = role === "theatertechnieker";
  const [dichtgeklapt, setDichtgeklapt] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col h-full w-64 bg-white border-r border-[#ECECF3] text-[#3D3D3A]">
      <div className="px-5 py-5">
        <div className="text-[#171A2B] font-semibold text-lg leading-none">Beheerportaal</div>
        <div className="text-xs text-[#8A8FA8] mt-1">Zalen & verbruik</div>
      </div>
      <nav className="flex-1 px-3 space-y-3 mt-1 overflow-y-auto">
        {GROUPS.map((group) => {
          const items = group.items
            .filter((item) => (isBeperkt ? BEPERKTE_NAV_HREFS.includes(item.href) : true))
            .filter((item) => !item.adminOnly || role === "systeembeheerder");
          if (items.length === 0) return null;
          const isDicht = group.title ? dichtgeklapt[group.title] : false;

          return (
            <div key={group.title || "top"}>
              {group.title && (
                <button
                  onClick={() => setDichtgeklapt((d) => ({ ...d, [group.title!]: !d[group.title!] }))}
                  className="w-full flex items-center justify-between px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#8A8780]"
                >
                  {group.title}
                  {isDicht ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
              {!isDicht && (
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const [itemPath, itemQuery] = item.href.split("?");
                    const isActive = itemQuery
                      ? pathname === itemPath && searchParams.toString() === itemQuery
                      : pathname?.startsWith(itemPath) && searchParams.toString() === "";
                    return (
                      <div key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive ? "bg-[#0F5F59] text-white" : "text-[#3D3D3A] hover:bg-[#F1EFE8]"
                          }`}
                        >
                          <Icon size={15} strokeWidth={2} className="shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {item.href === "/logboek" && logboekOngelezen > 0 && (
                            <span className="text-[10px] font-semibold bg-[#D6493C] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                              {logboekOngelezen > 99 ? "99+" : logboekOngelezen}
                            </span>
                          )}
                          {item.href === "/controle" && controleOngelezen > 0 && (
                            <span
                              className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
                                isActive ? "bg-white text-[#0F5F59]" : "bg-[#B4790C] text-white"
                              }`}
                            >
                              {controleOngelezen > 99 ? "99+" : controleOngelezen}
                            </span>
                          )}
                        </Link>
                        {item.children && (
                          <div className="space-y-0.5 mt-0.5">
                            {item.children.map((sub) => {
                              const [subPath, subQuery] = sub.href.split("?");
                              const subActive = pathname === subPath && searchParams.toString() === subQuery;
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  className={`flex items-center gap-2.5 pl-9 pr-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    subActive ? "text-[#0F5F59] bg-[#F1EFE8] font-semibold" : "text-[#6B6A63] hover:bg-[#F1EFE8]"
                                  }`}
                                >
                                  {sub.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="px-3 pb-1 border-t border-[#ECECF3] pt-2">
        <Link
          href="/instellingen"
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/instellingen" ? "bg-[#0F5F59] text-white" : "text-[#3D3D3A] hover:bg-[#F1EFE8]"
          }`}
        >
          <Settings size={15} strokeWidth={2} />
          Mijn instellingen
        </Link>
      </div>
      <form action={logout} className="px-3 pb-4">
        <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-[#3D3D3A] hover:bg-[#F1EFE8]">
          <LogOut size={15} strokeWidth={2} />
          Afmelden
        </button>
      </form>
    </div>
  );
}
