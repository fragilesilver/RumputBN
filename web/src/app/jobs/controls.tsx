"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatBND, splitEarnings } from "@/lib/pricing";
import type { JobStatus } from "@/lib/types";
import { acceptOffer, makeOffer, setJobStatus, withdrawOffer, type ActionResult } from "./actions";

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else setError(res.error);
    });
  return { pending, error, run };
}

const btn =
  "rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 transition";

export function OfferForm({
  jobId,
  recommended,
  min,
  max,
  commissionRate,
  currentAmount,
}: {
  jobId: string;
  recommended: number;
  min: number;
  max: number;
  commissionRate: number;
  currentAmount: number | null;
}) {
  const { pending, error, run } = useAction();
  const [amount, setAmount] = useState(currentAmount ?? recommended);
  const [message, setMessage] = useState("");
  const valid = amount >= min && amount <= max;
  const payout = splitEarnings(valid ? amount : recommended, commissionRate);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => makeOffer(jobId, amount, message));
      }}
      className="mt-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center rounded-lg bg-white ring-1 ring-stone-300 focus-within:ring-2 focus-within:ring-green-700">
          <span className="pl-3 text-sm text-stone-500">B$</span>
          <input
            type="number"
            inputMode="decimal"
            step="1"
            min={min}
            max={max}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-transparent px-2 py-2 text-sm focus:outline-none"
            aria-label="Your price"
          />
        </label>
        <button disabled={pending || !valid} className={`${btn} bg-green-700 text-white`}>
          {currentAmount === null ? "Offer" : "Update offer"}
        </button>
      </div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={300}
        placeholder="Message (optional), e.g. Can come Saturday morning"
        className="w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-stone-300 focus:outline-none focus:ring-2 focus:ring-green-700"
      />
      <p className="text-xs text-stone-500">
        Allowed: {formatBND(min)}–{formatBND(max)}. You receive{" "}
        <strong className="text-stone-800">{formatBND(payout.cutterPayout)}</strong> after the{" "}
        {Math.round(commissionRate * 100)}% platform fee.
      </p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </form>
  );
}

export function WithdrawOfferButton({ offerId }: { offerId: string }) {
  const { pending, error, run } = useAction();
  return (
    <span>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => withdrawOffer(offerId))}
        className="text-sm text-stone-500 hover:text-red-700"
      >
        Withdraw offer
      </button>
      {error && <span role="alert" className="ml-2 text-sm text-red-700">{error}</span>}
    </span>
  );
}

export function AcceptOfferButton({ offerId, jobId, label }: { offerId: string; jobId: string; label: string }) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Book this cutter for ${label}?`)) run(() => acceptOffer(offerId, jobId));
        }}
        className={`${btn} bg-green-700 text-white`}
      >
        {pending ? "Booking…" : `Accept ${label}`}
      </button>
      {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

export function StatusButton({
  jobId,
  status,
  label,
  confirmText,
  variant = "primary",
}: {
  jobId: string;
  status: JobStatus;
  label: string;
  confirmText?: string;
  variant?: "primary" | "danger";
}) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirmText || confirm(confirmText)) run(() => setJobStatus(jobId, status));
        }}
        className={`${btn} ${
          variant === "danger" ? "bg-white text-red-700 ring-1 ring-red-200" : "bg-green-700 text-white"
        }`}
      >
        {pending ? "Saving…" : label}
      </button>
      {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}

/** Re-fetches server data periodically (offers and status changes). */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
