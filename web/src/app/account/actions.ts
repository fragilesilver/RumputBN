"use server";

import { revalidatePath } from "next/cache";
import { normaliseBruneiPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type AccountState = { error: string | null; saved: boolean };

export async function updateAccount(_prev: AccountState, form: FormData): Promise<AccountState> {
  const fullName = String(form.get("full_name") ?? "").trim();
  if (fullName.length < 1 || fullName.length > 80) {
    return { error: "Enter your name (up to 80 characters).", saved: false };
  }
  const phone = normaliseBruneiPhone(String(form.get("phone") ?? ""));
  if (!phone) return { error: "Enter your 7-digit Brunei mobile number.", saved: false };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in again.", saved: false };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone })
    .eq("id", auth.user.id);
  if (error) return { error: "Couldn't save. Please try again.", saved: false };

  revalidatePath("/", "layout");
  return { error: null, saved: true };
}
