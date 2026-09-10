"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import type { Role } from "@/lib/types";

export default function AppShell({
  role,
  logboekOngelezen,
  controleOngelezen,
  displayName,
  children,
}: {
  role: Role;
  logboekOngelezen: number;
  controleOngelezen: number;
  displayName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen bg-[#F7F7FB]">
      {/* Desktop: sidebar staat gewoon altijd naast de inhoud. */}
      <div className="print:hidden hidden md:block">
        <Sidebar role={role} logboekOngelezen={logboekOngelezen} controleOngelezen={controleOngelezen} />
      </div>

      {/* Mobiel: sidebar ligt als uitklapbaar paneel over de inhoud, dicht tot je op het menu-icoon tikt. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[85vw] shadow-xl">
            <Sidebar role={role} logboekOngelezen={logboekOngelezen} controleOngelezen={controleOngelezen} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-[#ECECF3] px-4 md:px-8 py-3 flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-[#ECECF3] text-[#171A2B]"
              aria-label="Menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="text-[11px] font-semibold tracking-wide text-[#6D5AE6] uppercase truncate">Beheerportaal</div>
          </div>
          <div className="text-sm bg-[#F7F7FB] border border-[#ECECF3] rounded-full px-4 py-1.5 font-medium text-[#171A2B] shrink-0">
            {displayName}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 print:overflow-visible print:p-0">{children}</div>
      </div>
    </div>
  );
}
