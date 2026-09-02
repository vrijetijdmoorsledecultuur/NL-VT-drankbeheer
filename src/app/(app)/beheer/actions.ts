"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";
import { normalizeEmail, normalizePhone, phoneLoginEmail, validLoginPin } from "@/lib/login";

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
  return user.id;
}

export async function createManagedUser(formData: FormData) {
  await assertSysteembeheerder();

  const fullName = String(formData.get("full_name") || "").trim();
  const email = normalizeEmail(String(formData.get("email") || ""));
  const phone = normalizePhone(String(formData.get("phone") || ""));
  const pin = String(formData.get("pin") || "");
  const role = String(formData.get("role") || "administratie") as Role;
  const buildingIds = formData.getAll("building_ids").map(String);

  if (!fullName || (!email && !phone) || !validLoginPin(pin)) {
    return { ok: false as const, error: "Vul een naam, minstens één geldig contactgegeven en een pincode van zes cijfers in." };
  }

  const admin = createAdminClient();
  const loginEmail = email || phoneLoginEmail(phone!);
  const { data, error } = await admin.auth.admin.createUser({
    email: loginEmail,
    password: pin,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  });
  if (error || !data.user) {
    return { ok: false as const, error: error?.message.includes("already") ? "Dit e-mailadres is al gekoppeld aan een account." : "Het account kon niet worden aangemaakt." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName, phone, role, active: true })
    .eq("id", data.user.id);
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false as const, error: "Dit gsm-nummer of e-mailadres is al gekoppeld aan een account." };
  }

  if (role === "gebouwbeheerder" && buildingIds.length > 0) {
    await admin.from("profile_buildings").insert(buildingIds.map((building_id) => ({ profile_id: data.user.id, building_id })));
  }

  revalidatePath("/beheer");
  return { ok: true as const };
}

export async function setProfileActive(profileId: string, active: boolean) {
  const currentUserId = await assertSysteembeheerder();
  if (profileId === currentUserId) return { ok: false as const, error: "Je kunt je eigen beheeraccount niet deactiveren." };
  const admin = createAdminClient();
  await admin.from("profiles").update({ active }).eq("id", profileId);
  revalidatePath("/beheer");
  return { ok: true as const };
}

export async function resetLoginPin(profileId: string, pin: string) {
  await assertSysteembeheerder();
  if (!validLoginPin(pin)) return { ok: false as const, error: "De pincode moet uit zes cijfers bestaan." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(profileId, { password: pin });
  if (error) return { ok: false as const, error: "De pincode kon niet worden gewijzigd." };
  return { ok: true as const };
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
