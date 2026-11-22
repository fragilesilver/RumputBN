"use server";

import { revalidatePath } from "next/cache";
import { validateJobRequest } from "@/lib/job-request";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type RequestJobResult =
  | { ok: true; jobId: string }
  | { ok: false; error: string; needs?: "login" | "onboarding" };

/** Customer requests a cutter. Area and price are recomputed here. */
export async function requestJob(payload: unknown): Promise<RequestJobResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in to continue.", needs: "login" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle<{ role: string }>();
  if (!profile) return { ok: false, error: "Finish setting up your account.", needs: "onboarding" };
  if (profile.role !== "customer") {
    return { ok: false, error: "You're signed in as a cutter. Use a customer account to book." };
  }

  const parsed = validateJobRequest(payload);
  if (!parsed.ok) return parsed;
  const v = parsed.value;

  const { data, error } = await createAdminClient()
    .from("jobs")
    .insert({
      customer_id: auth.user.id,
      location: `SRID=4326;POINT(${v.location.lng} ${v.location.lat})`,
      shapes: v.shapes,
      area_m2: v.areaM2,
      condition: v.condition,
      extras: v.extras,
      quote: v.quote,
      recommended_price: v.quote.total,
      fair_min: v.quote.fairRange.min,
      fair_max: v.quote.fairRange.max,
      preferred_date: v.preferredDate,
      notes: v.notes,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return { ok: false, error: "Couldn't create your request. Please try again." };

  revalidatePath("/jobs");
  return { ok: true, jobId: data.id };
}

/** Errors raised deliberately by our SQL functions are safe to show. */
function rpcError(error: { code?: string; message: string } | null): ActionResult {
  if (!error) return { ok: true };
  if (error.code === "P0001" || error.code === "42501") return { ok: false, error: error.message };
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function makeOffer(jobId: string, amount: number, message: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("make_offer", {
    p_job_id: jobId,
    p_amount: amount,
    p_message: message,
  });
  revalidatePath("/jobs");
  return rpcError(error);
}

export async function withdrawOffer(offerId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_offer", { p_offer_id: offerId });
  revalidatePath("/jobs");
  return rpcError(error);
}

export async function acceptOffer(offerId: string, jobId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_offer", { p_offer_id: offerId });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return rpcError(error);
}

export async function setJobStatus(jobId: string, status: JobStatus): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_job_status", { p_job_id: jobId, p_status: status });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return rpcError(error);
}
