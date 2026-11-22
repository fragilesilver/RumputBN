"use server";

import { revalidatePath } from "next/cache";
import { isInBrunei } from "@/lib/geo";
import { createClient } from "@/lib/supabase/server";

export type CutterSetupState = { error: string | null; saved: boolean };

export async function saveCutterProfile(
  _prev: CutterSetupState,
  form: FormData,
): Promise<CutterSetupState> {
  const lng = Number(form.get("lng"));
  const lat = Number(form.get("lat"));
  const radius = Number(form.get("radius_km"));
  const bio = String(form.get("bio") ?? "").trim();
  const isActive = form.get("is_active") === "on";

  if (!isInBrunei(lng, lat)) return { error: "Tap the map to set where you're based.", saved: false };
  if (!(radius >= 1 && radius <= 100)) return { error: "Service radius must be 1–100 km.", saved: false };
  if (bio.length > 500) return { error: "Keep your description under 500 characters.", saved: false };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in again.", saved: false };

  const fields = {
    base_location: `SRID=4326;POINT(${lng} ${lat})`,
    service_radius_km: Math.round(radius * 10) / 10,
    bio: bio || null,
    is_active: isActive,
  };
  // Not upsert: PostgREST's upsert also updates `id`, which clients may not change.
  const { data: existing } = await supabase
    .from("cutter_profiles")
    .select("id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("cutter_profiles").update(fields).eq("id", auth.user.id)
    : await supabase.from("cutter_profiles").insert({ id: auth.user.id, ...fields });
  if (error) return { error: "Couldn't save. Are you signed in as a cutter?", saved: false };

  revalidatePath("/jobs");
  return { error: null, saved: true };
}
