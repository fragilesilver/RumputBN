import QuoteTool from "@/components/QuoteTool";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getViewer } from "@/lib/supabase/server";

export default async function Home() {
  const viewer = await getViewer();
  return (
    <QuoteTool
      bookingEnabled={isSupabaseConfigured}
      viewer={viewer ? { signedIn: true, role: viewer.profile?.role ?? null } : null}
    />
  );
}
