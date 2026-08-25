import {
  Building2,
  Package,
  Users,
  UserCog,
  Clock,
  ShieldCheck,
} from "lucide-react";
import StatCard, { type Stat } from "@/components/StatCard";
import GroupCard, { type Group } from "@/components/GroupCard";

export default function BeheerOverview({
  buildingCount,
  activeBuildingCount,
  productCount,
  activeProductCount,
  contactCount,
  userCount,
  pendingRoleCount,
}: {
  buildingCount: number;
  activeBuildingCount: number;
  productCount: number;
  activeProductCount: number;
  contactCount: number;
  userCount: number;
  pendingRoleCount: number;
}) {
  const stats: Stat[] = [
    {
      label: "Gebouwen",
      value: buildingCount,
      sub: `${activeBuildingCount} actief`,
      icon: Building2,
      iconBg: "bg-[#EFEBFF]",
      iconColor: "text-[#6D5AE6]",
    },
    {
      label: "Producten",
      value: productCount,
      sub: `${activeProductCount} actief`,
      icon: Package,
      iconBg: "bg-[#E7F2FF]",
      iconColor: "text-[#2F80D6]",
    },
    {
      label: "Contacten",
      value: contactCount,
      icon: Users,
      iconBg: "bg-[#FDF1DE]",
      iconColor: "text-[#B4790C]",
    },
    {
      label: "Actieve gebruikers",
      value: userCount,
      sub: pendingRoleCount > 0 ? `${pendingRoleCount} klaargezet` : undefined,
      icon: UserCog,
      iconBg: "bg-[#E7F7EE]",
      iconColor: "text-[#1F9254]",
    },
  ];

  const groups: Group[] = [
    {
      title: "Locaties en assortiment",
      description: "Basisgegevens die over meerdere modules gebruikt worden.",
      rows: [
        {
          href: "/gebouwen",
          icon: Building2,
          iconBg: "bg-[#EFEBFF]",
          iconColor: "text-[#6D5AE6]",
          title: "Gebouwen & locaties",
          badge: `${activeBuildingCount} actief`,
          badgeTone: "green",
          description: "Alle actieve en inactieve locaties.",
        },
        {
          href: "/producten",
          icon: Package,
          iconBg: "bg-[#E7F2FF]",
          iconColor: "text-[#2F80D6]",
          title: "Producten & prijzen",
          badge: `${activeProductCount} actief`,
          badgeTone: "green",
          description: "Assortiment, prijzen en afrekenmodus per gebouw.",
        },
      ],
    },
    {
      title: "Relatiebeheer",
      description: "Gegevens van huurders en verenigingen.",
      rows: [
        {
          href: "/contacten",
          icon: Users,
          iconBg: "bg-[#FDF1DE]",
          iconColor: "text-[#B4790C]",
          title: "Contactenbeheer",
          badge: `${contactCount}`,
          badgeTone: "gray",
          description: "Namen uit PDF-uploads koppelen aan vereniging en contactpersoon.",
        },
      ],
    },
    {
      title: "Toegang en rollen",
      description: "Rechten, uitnodigingen en kwaliteitscontrole.",
      rows: [
        {
          href: "/beheer#rollen-klaarzetten",
          icon: Clock,
          iconBg: "bg-[#FDECEC]",
          iconColor: "text-[#D6493C]",
          title: "Rollen klaarzetten",
          badge: pendingRoleCount > 0 ? `${pendingRoleCount} wachtend` : "Up-to-date",
          badgeTone: pendingRoleCount > 0 ? "amber" : "green",
          description: "Naam, rol en gebouw vastleggen vóór de uitnodiging.",
        },
        {
          href: "/beheer#actieve-gebruikers",
          icon: ShieldCheck,
          iconBg: "bg-[#E7F7EE]",
          iconColor: "text-[#1F9254]",
          title: "Actieve gebruikers",
          badge: `${userCount} actief`,
          badgeTone: "green",
          description: "Rollen en gebouwtoegang per bestaand account.",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 mb-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.map((group) => (
          <GroupCard key={group.title} group={group} />
        ))}
      </div>
    </div>
  );
}
