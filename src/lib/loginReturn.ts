/** A login link may return only to a page on this app, never an external or executable URL. */
export function safeLoginReturn(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/dashboard";
  try {
    const url = new URL(value, "https://vltd.invalid");
    return url.origin === "https://vltd.invalid" ? url.pathname + url.search + url.hash : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
