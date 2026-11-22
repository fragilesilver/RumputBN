"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";

const ROLES = [
  { value: "customer", title: "I need my grass cut", hint: "Get fair quotes and book a cutter" },
  { value: "cutter", title: "I cut grass", hint: "Find jobs near you and get paid" },
] as const;

export default function OnboardingForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {
    error: null,
  });
  const [role, setRole] = useState<string>("customer");
  const [name, setName] = useState("");

  return (
    <form action={action} className="mt-6 space-y-5">
      <input type="hidden" name="next" value={next} />
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">How will you use RumputBN?</legend>
        {ROLES.map((r) => (
          <label
            key={r.value}
            className={`block cursor-pointer rounded-xl p-4 ring-1 transition ${
              role === r.value ? "bg-green-50 ring-2 ring-green-700" : "bg-white ring-stone-200"
            }`}
          >
            <input
              type="radio"
              name="role"
              value={r.value}
              checked={role === r.value}
              onChange={() => setRole(r.value)}
              className="sr-only"
            />
            <span className="block font-semibold">{r.title}</span>
            <span className="block text-sm text-stone-600">{r.hint}</span>
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="full_name" className="mb-1 block text-sm font-medium">
          {role === "cutter" ? "Your name or business name" : "Your name"}
        </label>
        <input
          id="full_name"
          name="full_name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg bg-white px-3 py-3 ring-1 ring-stone-300 focus:outline-none focus:ring-2 focus:ring-green-700"
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-green-700 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
