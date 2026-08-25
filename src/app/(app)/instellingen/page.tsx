import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";
import { hasPincode } from "@/app/(app)/instellingen/actions";
import PincodeSettingsForm from "@/components/PincodeSettingsForm";
import NaamSettingsForm from "@/components/NaamSettingsForm";

export default async function InstellingenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user!.id)
    .single<Profile>();

  const pincodeIngesteld = await hasPincode();
  const naamIsEmail = !!profile?.full_name && profile.full_name.includes("@");

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-[#171A2B] mb-1">Mijn instellingen</h1>
      <p className="text-[#8A8FA8] text-sm mb-6">Je account en je persoonlijke pincode.</p>

      <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-6">
        <div className="text-sm font-semibold text-[#171A2B]">
          {naamIsEmail ? <span className="text-[#B0B4CC] font-normal">Nog geen naam ingesteld</span> : profile?.full_name}
        </div>
        <div className="text-xs text-[#8A8FA8] mt-0.5">{profile?.email}</div>
        <div className="text-xs text-[#8A8FA8] mt-1">Rol: {profile?.role ? ROLE_LABELS[profile.role] : "—"}</div>
      </div>

      <NaamSettingsForm huidigeNaam={naamIsEmail ? "" : profile?.full_name || ""} />

      <div className="mt-6">
        <PincodeSettingsForm heeftAlPincode={pincodeIngesteld} />
      </div>
    </div>
  );
}
