import { redirect } from "next/navigation";
import NotConfigured from "@/components/ui/NotConfigured";
import SiteHeader from "@/components/ui/SiteHeader";
import { safeNext } from "@/lib/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getViewer } from "@/lib/supabase/server";
import OnboardingForm from "./OnboardingForm";

export const metadata = { title: "Welcome — RumputBN" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  if (!isSupabaseConfigured) return <NotConfigured />;
  const next = safeNext((await searchParams).next);
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (viewer.profile) redirect(next);

  return (
    <>
      <SiteHeader viewer={viewer} />
      <main className="mx-auto max-w-sm px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Welcome to RumputBN</h1>
        <p className="mt-1 text-sm text-stone-600">Signed in as {viewer.email}.</p>
        <OnboardingForm next={next} />
      </main>
    </>
  );
}
