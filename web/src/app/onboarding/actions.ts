"use server";

import { redirect } from "next/navigation";
import { normaliseBruneiPhone } from "@/lib/phone";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error: string | null };

export async function completeOnboarding(
  _prev: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const role = form.get("role");
  const fullName = String(form.get("full_name") ?? "").trim();
  if (role !== "customer" && role !== "cutter") return { error: "Choose how you'll use RumputBN." };
  if (fullName.length < 1 || fullName.length > 80) return { error: "Enter your name (up to 80 characters)." };
  const phone = normaliseBruneiPhone(String(form.get("phone") ?? ""));
  if (!phone) return { error: "Enter your 7-digit Brunei mobile number." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .insert({ id: auth.user.id, role, full_name: fullName, phone });
  if (error && error.code !== "23505") return { error: "Couldn't save your profile. Please try again." };

  redirect(role === "cutter" ? "/cutter/setup" : safeNext(String(form.get("next") ?? ""), "/jobs"));
}
