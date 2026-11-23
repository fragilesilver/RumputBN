import { redirect } from "next/navigation";
import NotConfigured from "@/components/ui/NotConfigured";
import SiteHeader from "@/components/ui/SiteHeader";
import { safeNext } from "@/lib/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getViewer } from "@/lib/supabase/server";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in — RumputBN" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = safeNext((await searchParams).next);
  if (!isSupabaseConfigured) return <NotConfigured />;
  const viewer = await getViewer();
  if (viewer) redirect(viewer.profile ? next : `/onboarding?next=${encodeURIComponent(next)}`);

  return (
    <>
      <SiteHeader viewer={null} />
      <main className="mx-auto max-w-sm px-4 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Sign in or register</h1>
        <p className="mt-1 text-sm text-stone-600">We&apos;ll email you a 6-digit code. No password needed.</p>
        <LoginForm next={next} />
      </main>
    </>
  );
}
