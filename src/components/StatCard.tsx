import type { LucideIcon } from "lucide-react";

export type Stat = {
  label: string;
  value: number | string;
  sub?: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
};

export default function StatCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon;
  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 flex items-start justify-between">
      <div>
        <div className="text-sm text-[#8A8FA8]">{stat.label}</div>
        <div className="text-2xl font-bold text-[#171A2B] mt-2">{stat.value}</div>
        {stat.sub && <div className="text-xs text-[#8A8FA8] mt-1">{stat.sub}</div>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.iconBg}`}>
        <Icon size={18} className={stat.iconColor} />
      </div>
    </div>
  );
}
