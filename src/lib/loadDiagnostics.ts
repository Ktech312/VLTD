// A short record of how a page load went, so a failed load can say WHICH step failed (page code, account check, profile choice, cloud download,
// drawing the page) instead of looking like an empty Vault.
//
// Privacy: only step names, timings and short codes are written. Never item titles, notes, prices, photo links, e-mail addresses, profile or
// account ids, tokens or request bodies. It lives in this browser's sessionStorage (cleared when the tab closes), is capped at the last 60 entries,
// and is never sent anywhere by itself.

const KEY = "vltd_load_diag_v1";
const MAX_ENTRIES = 60;
const MAX_NOTE = 90;

export type LoadMark = {
  /** Wall-clock time (ms since 1970). */
  at: number;
  /** Milliseconds since this page started loading. */
  ms: number;
  /** Step, e.g. "guard:account-check", "vault:cloud-pull". */
  stage: string;
  /** false = this step failed or did not answer. */
  ok: boolean;
  /** A short code or count ("ok", "no answer after 10 s", "12 items"). Never content. */
  note: string;
};

/** Keeps a note short and free of anything that looks like a link, e-mail address or id. */
export function cleanNote(note: string): string {
  return String(note ?? "")
    .replace(/https?:\/\/[^\s]+/gi, (u) => {
      try {
        return new URL(u).pathname;
      } catch {
        return "";
      }
    })
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "[id]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NOTE);
}

export function readLoadDiagnostics(): LoadMark[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as LoadMark[]) : [];
  } catch {
    return [];
  }
}

export function markLoadStage(stage: string, ok: boolean, note = ""): void {
  if (typeof window === "undefined") return;
  try {
    const list = readLoadDiagnostics();
    list.push({
      at: Date.now(),
      ms: Math.round(typeof performance !== "undefined" ? performance.now() : 0),
      stage: String(stage).slice(0, 40),
      ok: ok === true,
      note: cleanNote(note),
    });
    window.sessionStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_ENTRIES)));
  } catch {
    // Storage full or blocked: the record is best-effort and must never get in the way of the page.
  }
}

/** One line naming the steps that failed most recently, for a message people can read out or paste. "" when nothing failed. */
export function describeLoadFailure(): string {
  const failed = readLoadDiagnostics().filter((m) => !m.ok).slice(-4);
  return failed.map((m) => (m.note ? `${m.stage} (${m.note})` : m.stage)).join("; ");
}
