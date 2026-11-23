import { redirect } from "next/navigation";
import { signOut } from "@/app/auth-actions";
import NotConfigured from "@/components/ui/NotConfigured";
import SiteHeader from "@/components/ui/SiteHeader";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getViewer } from "@/lib/supabase/server";
import AccountForm from "./AccountForm";

export const metadata = { title: "Account — RumputBN" };

export default async function AccountPage() {
  if (!isSupabaseConfigured) return <NotConfigured />;
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");
  if (!viewer.profile) redirect("/onboarding?next=/account");

  return (
    <>
      <SiteHeader viewer={viewer} />
      <main className="mx-auto max-w-sm px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Your account</h1>
        <p className="mt-1 text-sm text-stone-600">
          Signed in as {viewer.email} · {viewer.profile.role === "cutter" ? "Cutter" : "Customer"}
        </p>
        <AccountForm fullName={viewer.profile.full_name} phone={viewer.profile.phone ?? ""} />
        <form action={signOut} className="mt-8 border-t border-stone-200 pt-6">
          <button className="w-full rounded-lg bg-white py-3 font-medium text-red-700 ring-1 ring-stone-200">
            Sign out
          </button>
        </form>
      </main>
    </>
  );
}
