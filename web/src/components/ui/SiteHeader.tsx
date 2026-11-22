import Link from "next/link";
import { signOut } from "@/app/auth-actions";
import type { Viewer } from "@/lib/supabase/server";

export default function SiteHeader({ viewer }: { viewer: Viewer | null }) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Rumput<span className="text-green-700">BN</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {viewer?.profile ? (
            <>
              {viewer.profile.role === "customer" && (
                <Link href="/" className="text-stone-700 hover:text-green-800">
                  New quote
                </Link>
              )}
              {viewer.profile.role === "cutter" && (
                <Link href="/cutter/setup" className="text-stone-700 hover:text-green-800">
                  Service area
                </Link>
              )}
              <Link href="/jobs" className="font-medium text-stone-900 hover:text-green-800">
                My jobs
              </Link>
              <form action={signOut}>
                <button className="text-stone-500 hover:text-red-700">Sign out</button>
              </form>
            </>
          ) : viewer ? (
            <form action={signOut}>
              <button className="text-stone-500 hover:text-red-700">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="font-medium text-green-800">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
