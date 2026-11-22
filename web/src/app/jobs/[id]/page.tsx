import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { JobMap } from "@/components/map/dynamic";
import NotConfigured from "@/components/ui/NotConfigured";
import SiteHeader from "@/components/ui/SiteHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { extrasList, formatDate } from "@/lib/format";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { formatBND } from "@/lib/pricing";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient, getViewer } from "@/lib/supabase/server";
import { CONDITION_LABEL, num, type Job, type Offer, type Profile } from "@/lib/types";
import { AcceptOfferButton, AutoRefresh, StatusButton } from "../controls";

export const metadata = { title: "Job — RumputBN" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured) return <NotConfigured />;
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/jobs/${id}`);
  if (!viewer.profile) redirect(`/onboarding?next=/jobs/${id}`);
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  // RLS only returns the job to its customer or its assigned cutter.
  const { data: job } = await supabase.from("jobs").select("*").eq("id", id).maybeSingle<Job>();
  if (!job) notFound();

  const isCustomer = job.customer_id === viewer.userId;
  const counterpartyId = isCustomer ? job.cutter_id : job.customer_id;
  const { data: counterparty } = counterpartyId
    ? await supabase.from("profiles").select("id, role, full_name, phone").eq("id", counterpartyId).maybeSingle<Profile>()
    : { data: null };

  return (
    <>
      <SiteHeader viewer={viewer} />
      {["open", "assigned", "in_progress"].includes(job.status) && <AutoRefresh />}
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <Link href="/jobs" className="text-sm text-stone-500 hover:text-stone-800">← My jobs</Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {job.area_m2.toLocaleString("en")} m² grass cutting
            </h1>
            <StatusBadge status={job.status} />
          </div>
          <p className="text-sm text-stone-500">
            Requested {formatDate(job.created_at)}
            {job.preferred_date && ` · wanted ${formatDate(job.preferred_date)}`}
          </p>
        </div>

        <div className="h-72 overflow-hidden rounded-xl ring-1 ring-stone-200">
          <JobMap shapes={job.shapes} lng={num(job.lng)} lat={num(job.lat)} />
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
            <h2 className="text-sm font-semibold text-stone-500">Job details</h2>
            <dl className="mt-2 space-y-1 text-sm">
              <Row label="Grass">{CONDITION_LABEL[job.condition]}</Row>
              <Row label="Extras">{extrasList(job.extras).join(", ") || "None"}</Row>
              {job.notes && <Row label="Notes">{job.notes}</Row>}
            </dl>
          </div>
          <Money job={job} isCustomer={isCustomer} />
        </section>

        {counterparty && <Contact person={counterparty} job={job} isCustomer={isCustomer} />}

        {isCustomer && job.status === "open" && <Offers jobId={job.id} />}

        <section className="flex flex-wrap gap-3">
          {!isCustomer && job.status === "assigned" && (
            <StatusButton jobId={job.id} status="in_progress" label="Start job" />
          )}
          {!isCustomer && job.status === "in_progress" && (
            <StatusButton jobId={job.id} status="completed" label="Mark as done" confirmText="Mark this job as done?" />
          )}
          {isCustomer && ["open", "assigned"].includes(job.status) && (
            <StatusButton
              jobId={job.id}
              status="cancelled"
              label="Cancel request"
              variant="danger"
              confirmText="Cancel this job?"
            />
          )}
        </section>
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function Money({ job, isCustomer }: { job: Job; isCustomer: boolean }) {
  const agreed = job.agreed_price !== null;
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-stone-200">
      <h2 className="text-sm font-semibold text-stone-500">{agreed ? "Agreed price" : "Fair price"}</h2>
      <p className="text-3xl font-bold text-green-800">
        {formatBND(num(agreed ? job.agreed_price : job.recommended_price))}
      </p>
      {!agreed && (
        <p className="text-xs text-stone-500">
          Cutters can offer {formatBND(num(job.fair_min))}–{formatBND(num(job.fair_max))}
        </p>
      )}
      {agreed && !isCustomer && (
        <dl className="mt-2 space-y-1 border-t border-stone-100 pt-2 text-sm">
          <Row label={`Platform fee (${Math.round(num(job.commission_rate) * 100)}%)`}>
            −{formatBND(num(job.platform_fee))}
          </Row>
          <Row label="You receive">
            <strong>{formatBND(num(job.cutter_payout))}</strong>
          </Row>
        </dl>
      )}
      {isCustomer && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-stone-500">How the price was worked out</summary>
          <dl className="mt-2 space-y-1">
            {job.quote.lines.map((l) => (
              <Row key={l.label} label={l.label}>{formatBND(l.amount)}</Row>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}

function Contact({ person, job, isCustomer }: { person: Profile; job: Job; isCustomer: boolean }) {
  const wa = whatsappLink(
    person.phone,
    isCustomer
      ? `Hi ${person.full_name}, this is about my RumputBN grass cutting job.`
      : `Hi ${person.full_name}, I'm your RumputBN grass cutter.`,
  );
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${num(job.lat)},${num(job.lng)}`;
  return (
    <section className="rounded-xl bg-green-50 p-4 ring-1 ring-green-200">
      <h2 className="text-sm font-semibold text-green-900">{isCustomer ? "Your cutter" : "Customer"}</h2>
      <p className="mt-1 text-lg font-semibold">{person.full_name}</p>
      <p className="text-sm text-stone-700">{formatPhone(person.phone)}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-sm font-medium">
        {person.phone && (
          <a href={`tel:${person.phone.startsWith("+") ? person.phone : `+${person.phone}`}`} className="rounded-lg bg-white px-3 py-2 ring-1 ring-green-200">
            Call
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white px-3 py-2 ring-1 ring-green-200">
            WhatsApp
          </a>
        )}
        {!isCustomer && (
          <a href={directions} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white px-3 py-2 ring-1 ring-green-200">
            Directions
          </a>
        )}
      </div>
    </section>
  );
}

async function Offers({ jobId }: { jobId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_offers")
    .select("id, job_id, cutter_id, amount, message, status, created_at")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .order("amount", { ascending: true })
    .returns<Offer[]>();
  const offers = data ?? [];
  const ids = offers.map((o) => o.cutter_id);
  const [{ data: people }, { data: cutters }] = ids.length
    ? await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ids).returns<{ id: string; full_name: string }[]>(),
        supabase.from("cutter_profiles").select("id, bio").in("id", ids).returns<{ id: string; bio: string | null }[]>(),
      ])
    : [{ data: [] }, { data: [] }];
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const bio = new Map((cutters ?? []).map((c) => [c.id, c.bio]));

  return (
    <section>
      <h2 className="text-lg font-bold">Offers</h2>
      {offers.length === 0 ? (
        <p className="mt-2 text-sm text-stone-600">
          Cutters near you can see your request now. Their offers will appear here, and this page refreshes automatically.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-stone-200">
              <div className="min-w-0">
                <p className="font-semibold">{name.get(o.cutter_id) ?? "Cutter"}</p>
                {bio.get(o.cutter_id) && <p className="text-sm text-stone-600">{bio.get(o.cutter_id)}</p>}
                {o.message && <p className="mt-1 text-sm italic text-stone-600">&ldquo;{o.message}&rdquo;</p>}
              </div>
              <AcceptOfferButton offerId={o.id} jobId={jobId} label={formatBND(num(o.amount))} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
