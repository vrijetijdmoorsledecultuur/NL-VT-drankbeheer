"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

// Elke actie hier controleert eerst dat de ingelogde gebruiker systeembeheerder is,
// vóór de service-role (admin) client gebruikt wordt. Zo blijft rolbeheer voorbehouden
// aan de systeembeheerder, ook al omzeilt de admin-client de gewone RLS-regels.
async function assertSysteembeheerder() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Niet ingelogd.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "systeembeheerder") throw new Error("Enkel de systeembeheerder mag dit doen.");
}

// Een volledige, downloadbare kopie van alle operationele gegevens — een
// tussentijdse veiligheidsnet naast Supabase's eigen automatische back-ups
// (zie Instellingen bij Supabase zelf voor die continue laag). Bevat bewust
// geen pincode-hashes.
export async function exporteerVolledigeBackup() {
  await assertSysteembeheerder();
  const supabase = createAdminClient();

  const tabellen = [
    "buildings",
    "products",
    "product_buildings",
    "contacts",
    "reservations",
    "reservation_product_tellingen",
    "reservation_boetes",
    "reservation_extra_producten",
    "leveringen",
    "eigen_verbruik",
    "voorraadverplaatsingen",
    "telplekken",
    "telplek_producten",
    "telplek_vaste_voorraad",
    "leveranciers",
    "bestellingen",
    "bestelling_regels",
    "facturen",
    "factuur_regels",
    "logboek",
    "reservation_toegangscodes",
  ] as const;

  const resultaten = await Promise.all(tabellen.map((t) => supabase.from(t).select("*")));

  const { data: profielen } = await supabase.from("profiles").select("id, email, full_name, role");

  const backup: Record<string, unknown> = {
    gemaakt_op: new Date().toISOString(),
    profielen: profielen || [],
  };
  tabellen.forEach((t, i) => {
    backup[t] = resultaten[i].data || [];
  });

  return backup;
}

export async function inviteUser(formData: FormData) {
  await assertSysteembeheerder();

  const email = String(formData.get("email") || "").trim();
  const fullName = String(formData.get("full_name") || "").trim();
  if (!email) return;

  const admin = createAdminClient();
  await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName || email },
  });

  revalidatePath("/beheer");
}

// ----- Rollen vooraf klaarzetten, nog vóór er een uitnodiging verstuurd is -----

export async function addPendingRole(formData: FormData) {
  await assertSysteembeheerder();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") || "").trim();
  const role = String(formData.get("role") || "administratie") as Role;
  if (!email) return;

  const supabase = await createClient();
  await supabase.from("pending_roles").insert({ email, full_name: fullName || null, role });

  revalidatePath("/beheer");
}

export async function updatePendingRole(id: string, role: Role) {
  await assertSysteembeheerder();

  const supabase = await createClient();
  await supabase.from("pending_roles").update({ role }).eq("id", id);

  revalidatePath("/beheer");
}

export async function setPendingRoleBuildings(pendingId: string, buildingIds: string[]) {
  await assertSysteembeheerder();

  const supabase = await createClient();
  await supabase.from("pending_role_buildings").delete().eq("pending_id", pendingId);
  if (buildingIds.length > 0) {
    await supabase
      .from("pending_role_buildings")
      .insert(buildingIds.map((building_id) => ({ pending_id: pendingId, building_id })));
  }

  revalidatePath("/beheer");
}

export async function deletePendingRole(id: string) {
  await assertSysteembeheerder();

  const supabase = await createClient();
  await supabase.from("pending_roles").delete().eq("id", id);

  revalidatePath("/beheer");
}

export async function inviteFromPending(pendingId: string, email: string, fullName: string | null) {
  await assertSysteembeheerder();

  const admin = createAdminClient();
  await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName || email },
  });
  // De database-trigger neemt de klaargezette rol automatisch over zodra het
  // account aangemaakt wordt, en verwijdert dan deze pending_roles-rij zelf.

  revalidatePath("/beheer");
}

export async function updateRole(profileId: string, role: Role) {
  await assertSysteembeheerder();

  const admin = createAdminClient();
  await admin.from("profiles").update({ role }).eq("id", profileId);

  revalidatePath("/beheer");
}

export async function updateProfileGegevens(profileId: string, fields: { fullName?: string; email?: string }) {
  await assertSysteembeheerder();

  const admin = createAdminClient();

  if (fields.fullName !== undefined) {
    await admin.from("profiles").update({ full_name: fields.fullName.trim() || null }).eq("id", profileId);
  }

  if (fields.email !== undefined && fields.email.trim()) {
    const nieuweEmail = fields.email.trim();
    const { error } = await admin.auth.admin.updateUserById(profileId, { email: nieuweEmail });
    if (error) return { ok: false as const, error: error.message };
    await admin.from("profiles").update({ email: nieuweEmail }).eq("id", profileId);
  }

  revalidatePath("/beheer");
  return { ok: true as const };
}

export async function deleteProfile(profileId: string) {
  await assertSysteembeheerder();

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("email, full_name").eq("id", profileId).single();
  const { error } = await admin.auth.admin.deleteUser(profileId);
  if (error) return { ok: false as const, error: error.message };

  if (profile) {
    const supabase = await createClient();
    const { logboekRegel } = await import("@/lib/logboek");
    await logboekRegel(supabase, "gebruiker_verwijderd", `Gebruiker verwijderd: ${profile.full_name || profile.email}`);
  }

  revalidatePath("/beheer");
  return { ok: true as const };
}

export async function setGebouwbeheerderBuildings(profileId: string, buildingIds: string[]) {
  await assertSysteembeheerder();

  const admin = createAdminClient();
  await admin.from("profile_buildings").delete().eq("profile_id", profileId);
  if (buildingIds.length > 0) {
    await admin
      .from("profile_buildings")
      .insert(buildingIds.map((building_id) => ({ profile_id: profileId, building_id })));
  }

  revalidatePath("/beheer");
}
