"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BRUNEI_PREFIX, formatPhone, normaliseBruneiPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [input, setInput] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const normalised = normaliseBruneiPhone(input);
    if (!normalised) {
      setError("Enter your 7-digit Brunei mobile number.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({ phone: normalised });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPhone(normalised);
    setCode("");
    setStep("code");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the SMS.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ phone, token: code, type: "sms" });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    // The login page redirects to onboarding if this is a new account.
    router.replace(`/login?next=${encodeURIComponent(next)}`);
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg bg-white px-3 py-3 text-lg tracking-wide ring-1 ring-stone-300 focus:outline-none focus:ring-2 focus:ring-green-700";

  return (
    <div className="mt-6">
      {step === "phone" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="phone">
            Mobile number
          </label>
          <div className="flex gap-2">
            <span className="flex items-center rounded-lg bg-stone-100 px-3 text-lg text-stone-600 ring-1 ring-stone-300">
              {BRUNEI_PREFIX}
            </span>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="712 3456"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </div>
          <button
            disabled={busy}
            className="w-full rounded-lg bg-green-700 py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="code">
            Code sent to {formatPhone(phone)}
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`${inputClass} text-center tracking-[0.5em]`}
            autoFocus
          />
          <button
            disabled={busy}
            className="w-full rounded-lg bg-green-700 py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Checking…" : "Verify"}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={() => setStep("phone")} className="text-stone-500">
              Change number
            </button>
            <button type="button" disabled={busy} onClick={() => sendCode()} className="text-green-800">
              Resend code
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
