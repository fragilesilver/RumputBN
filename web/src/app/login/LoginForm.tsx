"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const address = email.trim().toLowerCase();
    if (!EMAIL.test(address)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many codes requested. Please wait a few minutes and try again."
          : error.message,
      );
      return;
    }
    setEmail(address);
    setCode("");
    setNotice(step === "code" ? "We've sent a new code." : null);
    setStep("code");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email, token: code, type: "email" });
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
    "w-full rounded-lg bg-white px-3 py-3 text-lg ring-1 ring-stone-300 focus:outline-none focus:ring-2 focus:ring-green-700";

  return (
    <div className="mt-6">
      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            autoFocus
          />
          <button
            disabled={busy}
            className="w-full rounded-lg bg-green-700 py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="code">
            Code sent to {email}
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
          <p className="text-xs text-stone-500">Can&apos;t find it? Check your spam or promotions folder.</p>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={() => setStep("email")} className="text-stone-500">
              Use a different email
            </button>
            <button type="button" disabled={busy} onClick={() => sendCode()} className="text-green-800">
              Resend code
            </button>
          </div>
        </form>
      )}
      {notice && !error && <p className="mt-3 text-sm text-green-800">{notice}</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
