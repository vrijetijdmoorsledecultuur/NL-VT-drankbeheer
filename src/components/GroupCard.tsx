import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type Row = {
  href: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  badge?: string;
  badgeTone?: "green" | "amber" | "gray";
  description: string;
  live?: boolean;
};

export type Group = {
  title: string;
  description: string;
  rows: Row[];
};

const badgeStyles: Record<NonNullable<Row["badgeTone"]>, string> = {
  green: "bg-[#E7F7EE] text-[#1F9254]",
  amber: "bg-[#FDF1DE] text-[#B4790C]",
  gray: "bg-[#F1F1F6] text-[#6B7094]",
};

export default function GroupCard({ group }: { group: Group }) {
  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <div className="font-bold text-[#171A2B]">{group.title}</div>
        <div className="text-xs text-[#8A8FA8] mt-0.5">{group.description}</div>
      </div>
      <div className="divide-y divide-[#ECECF3]">
        {group.rows.map((row) => {
          const Icon = row.icon;
          const isLive = row.live !== false;

          const inner = (
            <>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${row.iconBg}`}>
                <Icon size={16} className={row.iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#171A2B]">{row.title}</span>
                  {row.badge && (
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                        badgeStyles[row.badgeTone ?? "gray"]
                      }`}
                    >
                      {row.badge}
                    </span>
                  )}
                  {!isLive && (
                    <span className="text-[10px] uppercase tracking-wide bg-[#F7F7FB] text-[#8A8FA8] rounded-full px-2 py-0.5">
                      binnenkort
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#8A8FA8] mt-0.5 truncate">{row.description}</div>
              </div>
            </>
          );

          if (!isLive) {
            return (
              <div key={row.href + row.title} className="flex items-center gap-3 px-5 py-3.5 opacity-60 cursor-default">
                {inner}
              </div>
            );
          }

          return (
            <Link
              key={row.href + row.title}
              href={row.href}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F7F7FB] transition-colors group"
            >
              {inner}
              <span className="text-[#C7CAE0] group-hover:text-[#6D5AE6] transition-colors text-lg leading-none">
                &rarr;
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
