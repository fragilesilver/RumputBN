export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Brunei" });
}

export function extrasList(extras: { removeClippings: boolean; edging: boolean; slope: boolean }): string[] {
  const out: string[] = [];
  if (extras.removeClippings) out.push("Take clippings away");
  if (extras.edging) out.push("Edge trimming");
  if (extras.slope) out.push("Slope / uneven");
  return out;
}
