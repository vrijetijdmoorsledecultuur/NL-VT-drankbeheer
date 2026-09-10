import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type BandRow = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
};

export type BandTone = "teal" | "amber" | "blue" | "purple" | "gray";

const TONES: Record<BandTone, { bandBg: string; bandFg: string; iconBg: string; iconFg: string }> = {
  teal: { bandBg: "bg-[#E1F5EE]", bandFg: "text-[#085041]", iconBg: "bg-[#5DCAA5]", iconFg: "text-[#04342C]" },
  amber: { bandBg: "bg-[#FAEEDA]", bandFg: "text-[#633806]", iconBg: "bg-[#EF9F27]", iconFg: "text-[#412402]" },
  blue: { bandBg: "bg-[#E6F1FB]", bandFg: "text-[#0C447C]", iconBg: "bg-[#378ADD]", iconFg: "text-white" },
  purple: { bandBg: "bg-[#EEEDFE]", bandFg: "text-[#3C3489]", iconBg: "bg-[#7F77DD]", iconFg: "text-white" },
  gray: { bandBg: "bg-[#F1EFE8]", bandFg: "text-[#444441]", iconBg: "bg-[#888780]", iconFg: "text-white" },
};

export default function SectionBand({
  tone,
  eyebrow,
  title,
  rows,
}: {
  tone: BandTone;
  eyebrow: string;
  title: string;
  rows: BandRow[];
}) {
  const t = TONES[tone];
  return (
    <div className="rounded-2xl overflow-hidden border border-[#ECECF3] mb-4">
      <div className={`${t.bandBg} px-5 py-3 flex items-center gap-2`}>
        <div>
          <div className={`text-[10px] font-semibold uppercase tracking-wide ${t.bandFg} opacity-80`}>{eyebrow}</div>
          <div className={`text-sm font-bold ${t.bandFg}`}>{title}</div>
        </div>
      </div>
      <div className="bg-white grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#ECECF3]">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <Link key={row.href + row.title} href={row.href} className="flex items-start gap-2.5 px-4 py-3.5 hover:bg-[#F7F7FB] transition-colors group">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${t.iconBg}`}>
                <Icon size={13} className={t.iconFg} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-[#171A2B]">{row.title}</span>
                  {row.badge && (
                    <span className="text-[10px] font-semibold bg-[#F1F1F6] text-[#6B7094] rounded-full px-1.5">{row.badge}</span>
                  )}
                </div>
                <div className="text-xs text-[#8A8FA8] mt-0.5 truncate">{row.description}</div>
              </div>
              <span className="text-[#C7CAE0] group-hover:text-[#6D5AE6] transition-colors text-xs shrink-0 mt-1">Open&rarr;</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
