import { BRUNEI_PREFIX } from "@/lib/phone";

/** Brunei mobile number input with a fixed +673 prefix. Submits as `phone`. */
export default function PhoneField({
  value,
  onChange,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor="phone" className="mb-1 block text-sm font-medium">
        Mobile / WhatsApp number
      </label>
      <div className="flex gap-2">
        <span className="flex items-center rounded-lg bg-stone-100 px-3 text-stone-600 ring-1 ring-stone-300">
          {BRUNEI_PREFIX}
        </span>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="712 3456"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg bg-white px-3 py-3 ring-1 ring-stone-300 focus:outline-none focus:ring-2 focus:ring-green-700"
        />
      </div>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
