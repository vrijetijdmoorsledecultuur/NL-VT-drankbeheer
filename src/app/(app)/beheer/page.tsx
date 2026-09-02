import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Building } from "@/lib/types";
import BeheerTable from "@/components/BeheerTable";
import ManagedUserForm from "@/components/ManagedUserForm";
import BeheerOverview from "@/components/BeheerOverview";

export default async function BeheerPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: myProfile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (myProfile?.role !== "systeembeheerder") {
    redirect("/dashboard");
  }

  const [
    { data: profiles },
    { data: allBuildings },
    { data: buildings },
    { data: profileBuildings },
    { count: productCount },
    { count: activeProductCount },
    { count: contactCount },
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, phone, full_name, role, active").order("full_name"),
    supabase.from("buildings").select("id, name, actief").order("name"),
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase.from("profile_buildings").select("profile_id, building_id"),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("actief", true),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
  ]);

  const buildingList = (buildings as Building[]) || [];
  const allBuildingsList = (allBuildings as Building[]) || [];
  const profileList = (profiles as Profile[]) || [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-1">Beheer</h1>
      <p className="text-[#8A8FA8] text-sm mb-6">
        Instellingen zijn per onderwerp gebundeld. Elke rij vermeldt kort wat je er kan beheren.
      </p>

      <BeheerOverview
        buildingCount={allBuildingsList.length}
        activeBuildingCount={buildingList.length}
        productCount={productCount ?? 0}
        activeProductCount={activeProductCount ?? 0}
        contactCount={contactCount ?? 0}
        userCount={profileList.length}
        pendingRoleCount={0}
      />

      <div id="actieve-gebruikers" className="scroll-mt-6">
        <h2 className="text-lg font-bold text-[#171A2B] mb-1">Gebruikers &amp; toegang</h2>
        <p className="text-[#8A8FA8] text-sm mb-4">Bepaal wie via een e-mailadres of gsm-nummer mag aanmelden en welke rol die persoon krijgt.</p>
        <ManagedUserForm buildings={buildingList} />
        <div className="mt-4">
          <BeheerTable
            profiles={profileList}
            buildings={buildingList}
            profileBuildings={(profileBuildings as { profile_id: string; building_id: string }[]) || []}
            currentUserId={user!.id}
          />
        </div>
      </div>
    </div>
  );
}
