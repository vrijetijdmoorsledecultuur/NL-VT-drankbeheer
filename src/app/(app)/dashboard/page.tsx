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
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { voornaam } from "@/lib/naam";
import StatCard, { type Stat } from "@/components/StatCard";
import GroupCard, { type Group } from "@/components/GroupCard";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: profile },
    { count: gebouwenCount },
    { count: activeGebouwenCount },
    { count: productenCount },
    { count: activeProductenCount },
    { count: reservatiesCount },
    { count: contactenCount },
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("buildings").select("*", { count: "exact", head: true }),
    supabase.from("buildings").select("*", { count: "exact", head: true }).eq("actief", true),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("actief", true),
    supabase.from("reservations").select("*", { count: "exact", head: true }),
    supabase.from("contacts").select("*", { count: "exact", head: true }),
  ]);

  const role = profile?.role ?? "administratie";
  // full_name valt bij aanmaken automatisch terug op het e-mailadres als er
  // geen echte naam werd opgegeven — toon dan liever geen naam dan het volledige adres.
  const firstName = voornaam(profile?.full_name, profile?.email);
  const isAdmin = role === "systeembeheerder";
  const isBeperkt = role === "theatertechnieker";

  const stats: Stat[] = [
    {
      label: "Reservaties",
      value: reservatiesCount ?? 0,
      icon: Calendar,
      iconBg: "bg-[#E7F0FD]",
      iconColor: "text-[#3B6FC9]",
    },
    {
      label: "Gebouwen",
      value: gebouwenCount ?? 0,
      sub: `${activeGebouwenCount ?? 0} actief`,
      icon: Building2,
      iconBg: "bg-[#EFEBFF]",
      iconColor: "text-[#6D5AE6]",
    },
    {
      label: "Producten",
      value: productenCount ?? 0,
      sub: `${activeProductenCount ?? 0} actief`,
      icon: Package,
      iconBg: "bg-[#FCE9EE]",
      iconColor: "text-[#C9497B]",
    },
    {
      label: "Contacten",
      value: contactenCount ?? 0,
      icon: Users,
      iconBg: "bg-[#E4F6EE]",
      iconColor: "text-[#1FAE7A]",
    },
  ];

  const groups: Group[] = isBeperkt
    ? [
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
      ]
    : [
        {
          title: "Werking vandaag",
          description: "Reservaties opvolgen en verbruik registreren.",
          rows: [
            {
              href: "/reservaties",
              icon: Calendar,
              iconBg: "bg-[#E7F0FD]",
              iconColor: "text-[#3B6FC9]",
              title: "Reservaties",
              description: "Ingelezen huurdersaanvragen.",
            },
            {
              href: "/zaalbezetting",
              icon: MapPin,
              iconBg: "bg-[#E1F5F1]",
              iconColor: "text-[#1B9C82]",
              title: "Zaalbezetting",
              description: "Wie huurt welke zaal wanneer.",
            },
            {
              href: "/controle",
              icon: ClipboardList,
              iconBg: "bg-[#FDF0DA]",
              iconColor: "text-[#C9862A]",
              title: "Registraties · controle",
              description: "Tellingen nakijken en goedkeuren.",
            },
            {
              href: "/tellen",
              icon: ListChecks,
              iconBg: "bg-[#E1F5F1]",
              iconColor: "text-[#1B9C82]",
              title: "Zelf tellen",
              description: "Zelf een telling invoeren voor een gebouw.",
            },
            {
              href: "/verwerking",
              icon: Zap,
              iconBg: "bg-[#E7F0FD]",
              iconColor: "text-[#3B6FC9]",
              title: "Snelle verwerking",
              description: "Verbruik snel registreren, ook los van een reservatie.",
            },
          ],
        },
        {
          title: "Beheer",
          description: "Basisgegevens en toegang instellen.",
          rows: [
            {
              href: "/contacten",
              icon: Users,
              iconBg: "bg-[#E4F6EE]",
              iconColor: "text-[#1FAE7A]",
              title: "Contactenbeheer",
              description: "Verenigingen en contactpersonen.",
            },
            {
              href: "/producten",
              icon: Package,
              iconBg: "bg-[#FCE9EE]",
              iconColor: "text-[#C9497B]",
              title: "Producten & prijzen",
              description: "Prijzen en assortiment per gebouw beheren.",
            },
            {
              href: "/gebouwen",
              icon: Building2,
              iconBg: "bg-[#EFEBFF]",
              iconColor: "text-[#6D5AE6]",
              title: "Gebouwen & locaties",
              description: "Alle actieve locaties.",
            },
            {
              href: "/voorraad",
              icon: Boxes,
              iconBg: "bg-[#E1F5F1]",
              iconColor: "text-[#1B9C82]",
              title: "Voorraad",
              description: "Actuele voorraad per gebouw, live berekend.",
            },
            {
              href: "/bestellingen",
              icon: ShoppingCart,
              iconBg: "bg-[#E7F0FD]",
              iconColor: "text-[#3B6FC9]",
              title: "Bestellingen",
              description: "Van concept tot bevestigde levering.",
            },
            ...(isAdmin
              ? [
                  {
                    href: "/beheer",
                    icon: Settings,
                    iconBg: "bg-[#F1F1F6]",
                    iconColor: "text-[#6B7094]",
                    title: "Beheer & rollen",
                    description: "Gebruikers en rollen instellen.",
                  },
                ]
              : []),
          ],
        },
      ];

  return (
    <div>
      <div className="text-[#8A8FA8] text-sm font-medium mb-1">Vandaag</div>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-6">
        Goedemorgen{firstName ? `, ${firstName}` : ""}
      </h1>

      {!isBeperkt && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <StatCard key={stat.label} stat={stat} />
          ))}
        </div>
      )}

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
