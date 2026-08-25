import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Building, PendingRole } from "@/lib/types";
import BeheerTable from "@/components/BeheerTable";
import PendingRolesTable from "@/components/PendingRolesTable";
import InviteForm from "@/components/InviteForm";
import AddPendingRoleForm from "@/components/AddPendingRoleForm";
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
    { data: pendingRoles },
    { data: pendingRoleBuildings },
    { count: productCount },
    { count: activeProductCount },
    { count: contactCount },
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").order("full_name"),
    supabase.from("buildings").select("id, name, actief").order("name"),
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase.from("profile_buildings").select("profile_id, building_id"),
    supabase.from("pending_roles").select("id, email, full_name, role").order("created_at"),
    supabase.from("pending_role_buildings").select("pending_id, building_id"),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("actief", true),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
  ]);

  const buildingList = (buildings as Building[]) || [];
  const allBuildingsList = (allBuildings as Building[]) || [];
  const pendingRoleList = (pendingRoles as PendingRole[]) || [];
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
        pendingRoleCount={pendingRoleList.length}
      />

      <div id="rollen-klaarzetten" className="scroll-mt-6">
        <h2 className="text-lg font-bold text-[#171A2B] mb-1">Rollen klaarzetten</h2>
        <p className="text-[#8A8FA8] text-sm mb-4">
          Stel alvast naam, rol en gebouw in, nog vóór er een uitnodiging verstuurd wordt. Zodra je op &quot;Nodig
          uit&quot; klikt, krijgt die persoon meteen de juiste rol.
        </p>
        <AddPendingRoleForm buildings={buildingList} />
        <div className="mt-4">
          <PendingRolesTable
            pendingRoles={pendingRoleList}
            buildings={buildingList}
            pendingRoleBuildings={(pendingRoleBuildings as { pending_id: string; building_id: string }[]) || []}
          />
        </div>
      </div>

      <div id="actieve-gebruikers" className="scroll-mt-6">
        <h2 className="text-lg font-bold text-[#171A2B] mb-1 mt-10">Actieve gebruikers</h2>
        <p className="text-[#8A8FA8] text-sm mb-4">Mensen die al een account hebben.</p>
        <InviteForm />
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
