export default function NotConfigured() {
  return (
    <div className="mx-auto max-w-md p-6 text-sm text-stone-600">
      <h1 className="mb-2 text-lg font-semibold text-stone-900">Accounts aren&apos;t set up yet</h1>
      <p>
        Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> to{" "}
        <code>web/.env.local</code> (see <code>web/.env.example</code>) and restart the server.
      </p>
    </div>
  );
}
