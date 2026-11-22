/** Brunei numbers: +673 followed by 7 digits. */
export const BRUNEI_PREFIX = "+673";

export function normaliseBruneiPhone(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+673")) digits = digits.slice(4);
  else if (digits.startsWith("673") && digits.length === 10) digits = digits.slice(3);
  return /^\d{7}$/.test(digits) ? `${BRUNEI_PREFIX}${digits}` : null;
}

/** "+6737123456" → "+673 712 3456" */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const p = phone.startsWith("+") ? phone : `+${phone}`;
  const m = /^\+673(\d{3})(\d{4})$/.exec(p);
  return m ? `+673 ${m[1]} ${m[2]}` : p;
}

/** WhatsApp chat link for a phone number. */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
