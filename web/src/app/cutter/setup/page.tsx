import { redirect } from "next/navigation";
import NotConfigured from "@/components/ui/NotConfigured";
import SiteHeader from "@/components/ui/SiteHeader";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient, getViewer } from "@/lib/supabase/server";
import type { CutterProfile } from "@/lib/types";
import CutterSetupForm from "./CutterSetupForm";

export const metadata = { title: "Service area — RumputBN" };

export default async function CutterSetupPage() {
  if (!isSupabaseConfigured) return <NotConfigured />;
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/cutter/setup");
  if (!viewer.profile) redirect("/onboarding?next=/cutter/setup");
  if (viewer.profile.role !== "cutter") redirect("/jobs");

  const supabase = await createClient();
  const { data } = await supabase
    .from("cutter_profiles")
    .select("id, base_lng, base_lat, service_radius_km, bio, is_active")
    .eq("id", viewer.userId)
    .maybeSingle<CutterProfile>();

  return (
    <>
      <SiteHeader viewer={viewer} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">Your service area</h1>
        <p className="mt-1 text-sm text-stone-600">
          You&apos;ll see jobs within this distance of your base. Customers only see your name, phone and
          description when you make them an offer.
        </p>
        <CutterSetupForm initial={data ?? null} />
      </main>
    </>
  );
}
