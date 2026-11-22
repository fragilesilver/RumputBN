"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { LocationPickerMap } from "@/components/map/dynamic";
import type { CutterProfile } from "@/lib/types";
import { num } from "@/lib/types";
import { saveCutterProfile, type CutterSetupState } from "../actions";

export default function CutterSetupForm({ initial }: { initial: CutterProfile | null }) {
  const [state, action, pending] = useActionState<CutterSetupState, FormData>(saveCutterProfile, {
    error: null,
    saved: false,
  });
  const [point, setPoint] = useState(
    initial ? { lng: num(initial.base_lng), lat: num(initial.base_lat) } : null,
  );
  const [radius, setRadius] = useState(initial ? num(initial.service_radius_km) : 10);
  // Controlled so React's post-submit form reset doesn't clear them.
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [active, setActive] = useState(initial?.is_active ?? true);

  return (
    <form action={action} className="mt-5 space-y-5">
      <div className="h-80 overflow-hidden rounded-xl ring-1 ring-stone-200">
        <LocationPickerMap value={point} radiusKm={radius} onChange={setPoint} />
      </div>
      <p className="text-xs text-stone-500">
        {point ? "Drag the pin or tap elsewhere to move your base." : "Tap the map where you're based."}
      </p>
      <input type="hidden" name="lng" value={point?.lng ?? ""} />
      <input type="hidden" name="lat" value={point?.lat ?? ""} />

      <div>
        <label htmlFor="radius" className="flex justify-between text-sm font-medium">
          <span>How far will you travel?</span>
          <span className="tabular-nums">{radius} km</span>
        </label>
        <input
          id="radius"
          name="radius_km"
          type="range"
          min={1}
          max={50}
          step={1}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="mt-2 w-full accent-green-700"
        />
      </div>

      <div>
        <label htmlFor="bio" className="mb-1 block text-sm font-medium">
          About you <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <textarea
          id="bio"
          name="bio"
          maxLength={500}
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="e.g. 5 years' experience, own mower and trimmer, can take clippings away."
          className="w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-300 focus:outline-none focus:ring-2 focus:ring-green-700"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="size-4 accent-green-700"
        />
        I&apos;m available for new jobs
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.saved && (
        <p className="text-sm text-green-800">
          Saved. <Link href="/jobs" className="font-medium underline">See jobs near you →</Link>
        </p>
      )}
      <button
        disabled={pending || !point}
        className="w-full rounded-lg bg-green-700 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save service area"}
      </button>
    </form>
  );
}
