import Link from "next/link";
import { redirect } from "next/navigation";
import NotConfigured from "@/components/ui/NotConfigured";
import SiteHeader from "@/components/ui/SiteHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { extrasList, formatDate } from "@/lib/format";
import { DEFAULT_COMMISSION_RATE, formatBND } from "@/lib/pricing";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient, getViewer } from "@/lib/supabase/server";
import { CONDITION_LABEL, num, type Job, type JobStatus, type NearbyJob } from "@/lib/types";
import { AutoRefresh, OfferForm, WithdrawOfferButton } from "./controls";

export const metadata = { title: "My jobs — RumputBN" };

type JobRow = Pick<Job, "id" | "status" | "area_m2" | "recommended_price" | "agreed_price" | "cutter_payout" | "preferred_date" | "created_at"> & {
  job_offers?: { count: number }[];
};

export default async function JobsPage() {
  if (!isSupabaseConfigured) return <NotConfigured />;
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/jobs");
  if (!viewer.profile) redirect("/onboarding?next=/jobs");

  return (
    <>
      <SiteHeader viewer={viewer} />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        {viewer.profile.role === "customer" ? (
          <CustomerJobs userId={viewer.userId} />
        ) : (
          <CutterJobs userId={viewer.userId} />
        )}
      </main>
    </>
  );
}

async function CustomerJobs({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, status, area_m2, recommended_price, agreed_price, cutter_payout, preferred_date, created_at, job_offers(count)")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .returns<JobRow[]>();
  const jobs = data ?? [];

  return (
    <section>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My jobs</h1>
        <Link href="/" className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white">
          New quote
        </Link>
      </div>
      {jobs.some((j) => j.status === "open") && <AutoRefresh />}
      {jobs.length === 0 ? (
        <p className="mt-6 text-sm text-stone-600">
          No jobs yet. <Link href="/" className="font-medium text-green-800 underline">Get a quote</Link> to
          request a cutter.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {jobs.map((j) => {
            const offers = j.job_offers?.[0]?.count ?? 0;
            return (
              <li key={j.id}>
                <Link
                  href={`/jobs/${j.id}`}
                  className="block rounded-xl bg-white p-4 ring-1 ring-stone-200 transition hover:ring-green-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <StatusBadge status={j.status} />
                      <p className="mt-2 font-semibold">
                        {j.area_m2.toLocaleString("en")} m² · {formatBND(num(j.agreed_price ?? j.recommended_price))}
                      </p>
                      <p className="text-sm text-stone-500">
                        Requested {formatDate(j.created_at)}
                        {j.preferred_date && ` · for ${formatDate(j.preferred_date)}`}
                      </p>
                    </div>
                    {j.status === "open" && (
                      <span className="whitespace-nowrap text-sm font-medium text-green-800">
                        {offers} {offers === 1 ? "offer" : "offers"} →
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

async function CutterJobs({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: cutter }, { data: settings }, { data: nearby }, { data: mine }] = await Promise.all([
    supabase.from("cutter_profiles").select("id, is_active, service_radius_km").eq("id", userId).maybeSingle(),
    supabase.from("platform_settings").select("commission_rate").maybeSingle(),
    supabase.rpc("open_jobs_nearby"),
    supabase
      .from("jobs")
      .select("id, status, area_m2, recommended_price, agreed_price, cutter_payout, preferred_date, created_at")
      .eq("cutter_id", userId)
      .order("created_at", { ascending: false })
      .returns<JobRow[]>(),
  ]);

  if (!cutter) {
    return (
      <section className="rounded-xl bg-white p-6 text-center ring-1 ring-stone-200">
        <h1 className="text-xl font-bold">Set your service area to see jobs</h1>
        <p className="mt-1 text-sm text-stone-600">Tell us where you&apos;re based and how far you&apos;ll travel.</p>
        <Link href="/cutter/setup" className="mt-4 inline-block rounded-lg bg-green-700 px-4 py-2 font-semibold text-white">
          Set service area
        </Link>
      </section>
    );
  }

  const nearbyJobs = (nearby ?? []) as NearbyJob[];
  const rate = settings ? num(settings.commission_rate) : DEFAULT_COMMISSION_RATE;
  const active = (mine ?? []).filter((j) => ["assigned", "in_progress"].includes(j.status));
  const past = (mine ?? []).filter((j) => !["assigned", "in_progress"].includes(j.status));
  const earned = past
    .filter((j) => j.status === "completed")
    .reduce((sum, j) => sum + num(j.cutter_payout ?? 0), 0);

  return (
    <>
      <AutoRefresh />
      {active.length > 0 && (
        <section>
          <h2 className="text-lg font-bold">Your booked jobs</h2>
          <ul className="mt-3 space-y-3">
            {active.map((j) => <CutterJobLink key={j.id} job={j} />)}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Jobs near you</h1>
          <span className="text-sm text-stone-500">within {num(cutter.service_radius_km)} km</span>
        </div>
        {!cutter.is_active ? (
          <p className="mt-4 text-sm text-stone-600">
            You&apos;re marked as unavailable. <Link href="/cutter/setup" className="text-green-800 underline">Change this</Link>{" "}
            to see new jobs.
          </p>
        ) : nearbyJobs.length === 0 ? (
          <p className="mt-4 text-sm text-stone-600">No open jobs in your area right now. This page refreshes automatically.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {nearbyJobs.map((j) => (
              <li key={j.id} className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {j.area_m2.toLocaleString("en")} m² · {CONDITION_LABEL[j.condition]} grass
                    </p>
                    <p className="text-sm text-stone-500">
                      {num(j.distance_km)} km away
                      {j.preferred_date && ` · wanted ${formatDate(j.preferred_date)}`}
                    </p>
                    {extrasList(j.extras).length > 0 && (
                      <p className="text-sm text-stone-500">{extrasList(j.extras).join(" · ")}</p>
                    )}
                    {j.notes && <p className="mt-1 text-sm italic text-stone-600">&ldquo;{j.notes}&rdquo;</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-500">Fair price</p>
                    <p className="text-xl font-bold text-green-800">{formatBND(num(j.recommended_price))}</p>
                  </div>
                </div>
                {j.my_offer_status === "pending" && (
                  <p className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-900">
                      You offered {formatBND(num(j.my_offer_amount))}
                    </span>
                    <WithdrawOfferButton offerId={j.my_offer_id!} />
                  </p>
                )}
                <OfferForm
                  jobId={j.id}
                  recommended={num(j.recommended_price)}
                  min={num(j.fair_min)}
                  max={num(j.fair_max)}
                  commissionRate={rate}
                  currentAmount={j.my_offer_status === "pending" ? num(j.my_offer_amount) : null}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Past jobs</h2>
            <span className="text-sm text-stone-600">Earned {formatBND(Math.round(earned * 100) / 100)}</span>
          </div>
          <ul className="mt-3 space-y-3">
            {past.map((j) => <CutterJobLink key={j.id} job={j} />)}
          </ul>
        </section>
      )}
    </>
  );
}

function CutterJobLink({ job }: { job: JobRow & { status: JobStatus } }) {
  return (
    <li>
      <Link
        href={`/jobs/${job.id}`}
        className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-stone-200 hover:ring-green-700"
      >
        <div>
          <StatusBadge status={job.status} />
          <p className="mt-2 font-semibold">{job.area_m2.toLocaleString("en")} m²</p>
          {job.preferred_date && <p className="text-sm text-stone-500">Wanted {formatDate(job.preferred_date)}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs text-stone-500">You receive</p>
          <p className="font-bold text-green-800">{formatBND(num(job.cutter_payout ?? 0))}</p>
        </div>
      </Link>
    </li>
  );
}
