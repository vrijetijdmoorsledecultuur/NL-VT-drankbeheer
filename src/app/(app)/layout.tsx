import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import type { Profile } from "@/lib/types";
import { weergavenaam } from "@/lib/naam";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single<Profile>();

  const role = profile?.role ?? "administratie";
  const displayName = weergavenaam(profile?.full_name, profile?.email || user.email);

  return (
    <div className="flex h-screen bg-[#F7F7FB]">
      <div className="print:hidden">
        <Sidebar role={role} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-white border-b border-[#ECECF3] px-4 md:px-8 py-3 flex items-center justify-between gap-3 print:hidden">
          <div className="text-[11px] font-semibold tracking-wide text-[#6D5AE6] uppercase">Beheerportaal</div>
          <div className="text-sm bg-[#F7F7FB] border border-[#ECECF3] rounded-full px-4 py-1.5 font-medium text-[#171A2B]">
            {displayName}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 print:overflow-visible print:p-0">{children}</div>
      </div>
    </div>
  );
}
