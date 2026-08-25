"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  ClipboardList,
  Zap,
  Package,
  Users,
  Building2,
  MapPin,
  LogOut,
  ListChecks,
  BarChart3,
  Settings,
  Boxes,
  ShoppingCart,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { logout } from "@/app/(app)/actions";

const NAV = [
  { href: "/dashboard", label: "Vandaag", icon: Home, live: true },
  { href: "/reservaties", label: "Reservaties", icon: Calendar, live: true },
  { href: "/zaalbezetting", label: "Zaalbezetting", icon: MapPin, live: true },
  { href: "/contacten", label: "Contactenbeheer", icon: Users, live: true },
  { href: "/controle", label: "Registraties · controle", icon: ClipboardList, live: true },
  { href: "/tellen", label: "Zelf tellen", icon: ListChecks, live: true },
  { href: "/verwerking", label: "Snelle verwerking", icon: Zap, live: true },
  { href: "/voorraad", label: "Voorraad", icon: Boxes, live: true },
  { href: "/bestellingen", label: "Bestellingen", icon: ShoppingCart, live: true },
  { href: "/rapporten", label: "Rapportagecentrum", icon: BarChart3, live: true },
  { href: "/gebouwen", label: "Gebouwen & locaties", icon: Building2, live: true },
  { href: "/producten", label: "Producten & prijzen", icon: Package, live: true },
  { href: "/beheer", label: "Beheer & rollen", icon: Users, live: true, adminOnly: true },
];

// Theatertechniekers registreren enkel hun eigen verbruik en tellen af en toe
// mee — geen zicht op reservaties, contacten of beheer.
const BEPERKTE_NAV_HREFS = ["/dashboard", "/tellen", "/verwerking"];

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const isBeperkt = role === "theatertechnieker";
  const items = NAV.filter((item) => (isBeperkt ? BEPERKTE_NAV_HREFS.includes(item.href) : true));

  return (
    <div className="flex flex-col h-full w-64 bg-[#12172B] text-[#B9BEDA]">
      <div className="px-5 py-5">
        <div className="text-white font-semibold text-lg leading-none">Beheerportaal</div>
        <div className="text-xs text-[#7B81A6] mt-1">Zalen & verbruik</div>
      </div>
      <nav className="flex-1 px-3 space-y-1 mt-2">
        {items.filter((item) => !item.adminOnly || role === "systeembeheerder").map((item) => {
          const Icon = item.icon;
          const isActive = pathname?.startsWith(item.href);

          if (!item.live) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#5C6288] cursor-default"
                title="Nog niet gebouwd"
              >
                <Icon size={17} />
                <span className="flex-1">{item.label}</span>
                <span className="text-[10px] uppercase tracking-wide bg-white/5 rounded-full px-2 py-0.5">binnenkort</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? "bg-[#6D5AE6] text-white" : "hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-1">
        <Link
          href="/instellingen"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            pathname === "/instellingen" ? "bg-[#6D5AE6] text-white" : "hover:bg-white/5 hover:text-white"
          }`}
        >
          <Settings size={17} />
          Mijn instellingen
        </Link>
      </div>
      <form action={logout} className="px-3 pb-4">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 hover:text-white">
          <LogOut size={17} />
          Afmelden
        </button>
      </form>
    </div>
  );
}
