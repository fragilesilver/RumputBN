"use client";

import { useActionState, useState } from "react";
import PhoneField from "@/components/ui/PhoneField";
import { updateAccount, type AccountState } from "./actions";

export default function AccountForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(updateAccount, {
    error: null,
    saved: false,
  });
  const [name, setName] = useState(fullName);
  const [number, setNumber] = useState(phone.replace(/^\+673/, ""));

  return (
    <form action={action} className="mt-6 space-y-5">
      <div>
        <label htmlFor="full_name" className="mb-1 block text-sm font-medium">
          Name
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
      <PhoneField value={number} onChange={setNumber} />
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.saved && <p className="text-sm text-green-800">Saved.</p>}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-green-700 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
