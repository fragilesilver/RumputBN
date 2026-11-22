/** Only allow same-site relative paths as post-login destinations. */
export function safeNext(next: string | string[] | undefined | null, fallback = "/jobs"): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
