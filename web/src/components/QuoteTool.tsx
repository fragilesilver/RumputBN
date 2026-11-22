"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition, type FormEvent } from "react";
import type { GeocodeResult } from "@/app/api/geocode/route";
import { requestJob } from "@/app/jobs/actions";
import { billableAreaM2, type DrawnShape } from "@/lib/geo";
import { calculateQuote, formatBND, type Extras, type GrassCondition } from "@/lib/pricing";
import type { Role } from "@/lib/types";
import type { QuoteMapApi, Tool } from "./QuoteMap";

/** Survives the round trip through /login so the customer doesn't redraw. */
const DRAFT_KEY = "rumputbn:quote-draft";

type Draft = {
  shapes: DrawnShape[];
  condition: GrassCondition;
  extras: Extras;
  preferredDate: string;
  notes: string;
};

export type QuoteViewer = { signedIn: boolean; role: Role | null };

const QuoteMap = dynamic(() => import("./QuoteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#1f2a1f] text-sm text-white/70">
      Loading map…
    </div>
  ),
});

const CONDITIONS: { value: GrassCondition; label: string; hint: string }[] = [
  { value: "normal", label: "Normal", hint: "Cut in the last month" },
  { value: "long", label: "Long", hint: "Ankle to shin height" },
  { value: "overgrown", label: "Overgrown", hint: "Knee height or bushy" },
];

const EXTRAS: { key: keyof Extras; label: string }[] = [
  { key: "removeClippings", label: "Rake & take away clippings" },
  { key: "edging", label: "Trim edges along paths & fences" },
  { key: "slope", label: "Steep or uneven ground" },
];

const TOOLS: { value: Tool; label: string; hint: string }[] = [
  { value: "grass", label: "Draw grass", hint: "Tap around the edge of your grass. Tap the first point to finish." },
  { value: "exclude", label: "Cut out", hint: "Outline the house, driveway or pool to remove it from the grass area." },
  { value: "edit", label: "Edit", hint: "Tap a shape to select it, then drag its points. Right-click a point to remove it." },
];

export default function QuoteTool({
  viewer,
  bookingEnabled,
}: {
  viewer: QuoteViewer | null;
  bookingEnabled: boolean;
}) {
  const router = useRouter();
  const [api, setApi] = useState<QuoteMapApi | null>(null);
  const [tool, setTool] = useState<Tool>("grass");
  const [shapes, setShapes] = useState<DrawnShape[]>([]);
  const [hasSelection, setHasSelection] = useState(false);
  const [condition, setCondition] = useState<GrassCondition>("normal");
  const [extras, setExtras] = useState<Extras>({ removeClippings: false, edging: false, slope: false });
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const areaM2 = useMemo(() => billableAreaM2(shapes), [shapes]);
  const quote = useMemo(
    () => (areaM2 > 0 ? calculateQuote({ areaM2, condition, extras }) : null),
    [areaM2, condition, extras],
  );

  const chooseTool = (next: Tool) => {
    setTool(next);
    api?.setTool(next);
  };

  // When the map is ready, restore a draft saved before the customer was sent to sign in.
  const handleReady = useCallback((mapApi: QuoteMapApi) => {
    setApi(mapApi);
    let draft: Draft | null = null;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) draft = JSON.parse(raw) as Draft;
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      return;
    }
    if (!draft || !Array.isArray(draft.shapes) || draft.shapes.length === 0) return;
    mapApi.loadShapes(draft.shapes);
    setCondition(draft.condition);
    setExtras(draft.extras);
    setPreferredDate(draft.preferredDate ?? "");
    setNotes(draft.notes ?? "");
    setTool("edit");
    mapApi.setTool("edit");
  }, []);

  const requestCutter = () => {
    const draft: Draft = { shapes, condition, extras, preferredDate, notes };
    const goSignIn = (path: "/login" | "/onboarding") => {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Private mode: they'll just need to redraw.
      }
      router.push(`${path}?next=${encodeURIComponent("/")}`);
    };
    if (!viewer?.signedIn) return goSignIn("/login");

    setSubmitError(null);
    startSubmit(async () => {
      const res = await requestJob({ ...draft, preferredDate: preferredDate || null, notes: notes || null });
      if (res.ok) router.push(`/jobs/${res.jobId}`);
      else if (res.needs) goSignIn(res.needs === "login" ? "/login" : "/onboarding");
      else setSubmitError(res.error);
    });
  };

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Brunei" });

  return (
    <div className="flex h-dvh flex-col bg-stone-50 text-stone-900 lg:flex-row">
      <section className="relative h-[55dvh] shrink-0 lg:h-full lg:flex-1" aria-label="Map">
        <QuoteMap
          onReady={handleReady}
          onShapesChange={setShapes}
          onSelectionChange={setHasSelection}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
          <div className="pointer-events-auto mr-12 flex flex-wrap gap-2">
            {TOOLS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => chooseTool(t.value)}
                aria-pressed={tool === t.value}
                className={`rounded-full px-4 py-2 text-sm font-medium shadow-md transition ${
                  tool === t.value
                    ? t.value === "exclude"
                      ? "bg-red-600 text-white"
                      : "bg-green-700 text-white"
                    : "bg-white/95 text-stone-800 hover:bg-white"
                }`}
              >
                {t.label}
              </button>
            ))}
            {tool === "edit" && hasSelection && (
              <button
                type="button"
                onClick={() => api?.deleteSelected()}
                className="rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-red-700 shadow-md hover:bg-white"
              >
                Delete shape
              </button>
            )}
          </div>
          <p className="mt-2 max-w-md rounded-lg bg-black/60 px-3 py-2 text-xs text-white">
            {TOOLS.find((t) => t.value === tool)?.hint}
          </p>
        </div>
      </section>

      <aside className="flex-1 overflow-y-auto border-stone-200 lg:w-[400px] lg:flex-none lg:border-l">
        <div className="space-y-6 p-4 sm:p-6">
          <header>
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold tracking-tight">
                Rumput<span className="text-green-700">BN</span>
              </h1>
              {bookingEnabled &&
                (viewer?.signedIn ? (
                  <Link href="/jobs" className="text-sm font-medium text-green-800">
                    My jobs →
                  </Link>
                ) : (
                  <Link href="/login" className="text-sm font-medium text-green-800">
                    Sign in
                  </Link>
                ))}
            </div>
            <p className="mt-1 text-sm text-stone-600">
              Draw your grass on the map and get a fair, upfront price for cutting it.
            </p>
          </header>

          <Step n={1} title="Find your home">
            <AddressSearch onPick={(r) => api?.flyTo(r.lng, r.lat)} disabled={!api} />
            <button
              type="button"
              disabled={!api}
              onClick={() =>
                navigator.geolocation?.getCurrentPosition(
                  (pos) => api?.flyTo(pos.coords.longitude, pos.coords.latitude),
                  () => alert("Couldn't get your location. Try searching instead."),
                  { enableHighAccuracy: true, timeout: 10_000 },
                )
              }
              className="mt-2 text-sm font-medium text-green-800 underline-offset-2 hover:underline disabled:opacity-50"
            >
              Use my current location
            </button>
          </Step>

          <Step n={2} title="Outline your grass">
            <div className="flex items-baseline justify-between rounded-lg bg-white p-3 ring-1 ring-stone-200">
              <span className="text-sm text-stone-600">Grass area</span>
              <span className="text-xl font-semibold tabular-nums" data-testid="area">
                {Math.round(areaM2).toLocaleString("en")} m²
              </span>
            </div>
            {shapes.length > 0 && (
              <button
                type="button"
                onClick={() => api?.clear()}
                className="mt-2 text-sm text-stone-500 hover:text-red-700"
              >
                Clear all shapes
              </button>
            )}
          </Step>

          <Step n={3} title="How long is the grass?">
            <div className="grid grid-cols-3 gap-2">
              {CONDITIONS.map((c) => (
                <label
                  key={c.value}
                  className={`cursor-pointer rounded-lg p-2 text-center ring-1 transition ${
                    condition === c.value ? "bg-green-50 ring-2 ring-green-700" : "bg-white ring-stone-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="condition"
                    value={c.value}
                    checked={condition === c.value}
                    onChange={() => setCondition(c.value)}
                    className="sr-only"
                  />
                  <span className="block text-sm font-medium">{c.label}</span>
                  <span className="block text-[11px] leading-tight text-stone-500">{c.hint}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {EXTRAS.map((e) => (
                <label key={e.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={extras[e.key]}
                    onChange={(ev) => setExtras((x) => ({ ...x, [e.key]: ev.target.checked }))}
                    className="size-4 accent-green-700"
                  />
                  {e.label}
                </label>
              ))}
            </div>
          </Step>

          <section aria-live="polite" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
            {quote ? (
              quote.needsSiteVisit ? (
                <p className="text-sm">
                  That&apos;s a big area ({quote.areaM2.toLocaleString("en")} m²). Large jobs need a site
                  visit for an accurate price.
                </p>
              ) : (
                <>
                  <p className="text-sm text-stone-600">Fair price</p>
                  <p className="text-4xl font-bold tabular-nums text-green-800" data-testid="total">
                    {formatBND(quote.total)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Cutters can offer between {formatBND(quote.fairRange.min)} and{" "}
                    {formatBND(quote.fairRange.max)}.
                  </p>
                  <dl className="mt-4 space-y-1 border-t border-stone-100 pt-3 text-sm">
                    {quote.lines.map((l) => (
                      <div key={l.label} className="flex justify-between gap-4">
                        <dt className="text-stone-600">{l.label}</dt>
                        <dd className="tabular-nums">{formatBND(l.amount)}</dd>
                      </div>
                    ))}
                    {quote.minimumApplied && (
                      <div className="flex justify-between gap-4 text-stone-500">
                        <dt>Minimum job price applies</dt>
                        <dd className="tabular-nums">{formatBND(quote.total)}</dd>
                      </div>
                    )}
                  </dl>
                  {!bookingEnabled ? (
                    <button
                      type="button"
                      disabled
                      className="mt-4 w-full rounded-lg bg-green-700 py-3 font-semibold text-white disabled:opacity-60"
                    >
                      Find a grass cutter (coming soon)
                    </button>
                  ) : viewer?.role === "cutter" ? (
                    <p className="mt-4 rounded-lg bg-stone-100 p-3 text-sm text-stone-600">
                      You&apos;re signed in as a cutter. <Link href="/jobs" className="font-medium text-green-800">See jobs near you →</Link>
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3 border-t border-stone-100 pt-4">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-sm">
                          <span className="mb-1 block text-stone-600">Preferred date</span>
                          <input
                            type="date"
                            min={today}
                            value={preferredDate}
                            onChange={(e) => setPreferredDate(e.target.value)}
                            className="w-full rounded-lg bg-white px-2 py-2 ring-1 ring-stone-300"
                          />
                        </label>
                        <label className="text-sm">
                          <span className="mb-1 block text-stone-600">Notes</span>
                          <input
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            maxLength={500}
                            placeholder="Gate, dogs, parking…"
                            className="w-full rounded-lg bg-white px-2 py-2 ring-1 ring-stone-300"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={requestCutter}
                        disabled={submitting}
                        className="w-full rounded-lg bg-green-700 py-3 font-semibold text-white disabled:opacity-60"
                      >
                        {submitting
                          ? "Sending request…"
                          : viewer?.signedIn
                            ? "Request a grass cutter"
                            : "Sign in to request a cutter"}
                      </button>
                      {submitError && (
                        <p role="alert" className="text-sm text-red-700">
                          {submitError}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )
            ) : (
              <p className="text-sm text-stone-500">
                Your price appears here as soon as you outline your grass.
              </p>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-full bg-green-700 text-xs text-white">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function AddressSearch({
  onPick,
  disabled,
}: {
  onPick: (r: GeocodeResult) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");

  async function search(e: FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) return;
    setStatus("loading");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = (await res.json()) as { results: GeocodeResult[] };
      setResults(data.results);
      setStatus(!res.ok ? "error" : data.results.length ? "idle" : "empty");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kampong, street or area, e.g. Kiulap"
          className="min-w-0 flex-1 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-300 focus:outline-none focus:ring-2 focus:ring-green-700"
        />
        <button
          type="submit"
          disabled={disabled || status === "loading"}
          className="rounded-lg bg-stone-900 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {status === "loading" ? "…" : "Search"}
        </button>
      </form>
      {status === "empty" && <p className="mt-2 text-xs text-stone-500">No places found in Brunei.</p>}
      {status === "error" && <p className="mt-2 text-xs text-red-700">Search is unavailable right now.</p>}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-stone-100 overflow-hidden rounded-lg bg-white text-sm ring-1 ring-stone-200">
          {results.map((r) => (
            <li key={`${r.lng},${r.lat}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(r);
                  setResults([]);
                }}
                className="block w-full px-3 py-2 text-left hover:bg-green-50"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
