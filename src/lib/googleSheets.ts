"use client";

/**
 * Real Google Sheets integration (OAuth + Sheets API v4 + Drive API v3).
 *
 * Architecture note: this stores only a short-lived access token in
 * localStorage (no refresh token persistence/server-side storage), matching
 * this app's existing local-first pattern (vault/wishlist/watchlist all
 * live in localStorage the same way). That means a connection needs
 * re-authorizing roughly every hour - acceptable for an export/sync tool
 * used in occasional sessions, not built for unattended background sync.
 */

export type StoredToken = string;

const TOKEN_KEY = "vltd_google_token_v1";
const TOKEN_EXPIRES_KEY = "vltd_google_token_expires_v1";
const SHEET_ID_KEY = "vltd_google_sheet_id_v1";

const SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

/* =========================
   Token storage
========================= */

export function getStoredToken(): StoredToken | null {
  if (typeof window === "undefined") return null;
  const t = window.localStorage.getItem(TOKEN_KEY);
  return t ? t : null;
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(TOKEN_EXPIRES_KEY);
}

export function setStoredToken(token: StoredToken, expiresInSeconds = 3600) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(TOKEN_EXPIRES_KEY, String(Date.now() + expiresInSeconds * 1000));
}

export function isTokenValid(token?: StoredToken | null): boolean {
  if (!token || !token.trim()) return false;
  if (typeof window === "undefined") return true;
  const expiresAt = Number(window.localStorage.getItem(TOKEN_EXPIRES_KEY) ?? 0);
  return !expiresAt || Date.now() < expiresAt;
}

/* =========================
   OAuth connect flow
========================= */

/**
 * Redirects to Google's OAuth consent screen. The server-side callback
 * route (/api/google/oauth-callback) does the actual code-for-token
 * exchange (needs the client secret, which never reaches the browser) and
 * hands the resulting access token back via a URL fragment, picked up by
 * finishGoogleConnectIfPresent() on the page that redirected here.
 */
export async function startGoogleConnect() {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/google/oauth-config");
    const config = await res.json();
    if (!config.configured || !config.clientId) {
      const { showToast } = await import("@/lib/toast");
      showToast("Google Sheets isn't connected yet — add Google OAuth credentials to enable it.");
      return;
    }
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: SHEETS_SCOPES,
      access_type: "online",
      prompt: "consent",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  } catch {
    const { showToast } = await import("@/lib/toast");
    showToast("Couldn't start Google sign-in — try again.");
  }
}

/**
 * Parses #google_token=...&expires_in=... left by the OAuth callback
 * redirect, stores it, and clears the hash so it doesn't linger in the URL.
 * Also surfaces ?google_error=... from a failed/declined connect attempt.
 */
export function finishGoogleConnectIfPresent(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const error = params.get("google_error");
  if (error) {
    window.history.replaceState({}, "", window.location.pathname);
    import("@/lib/toast").then(({ showToast }) => {
      showToast(
        error === "not_configured"
          ? "Google Sheets isn't connected yet — add Google OAuth credentials to enable it."
          : "Couldn't connect Google Sheets — try again."
      );
    });
    return false;
  }

  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash.includes("google_token=")) return false;

  const hashParams = new URLSearchParams(hash);
  const token = hashParams.get("google_token");
  const expiresIn = Number(hashParams.get("expires_in") ?? 3600);
  window.history.replaceState({}, "", window.location.pathname);

  if (!token) return false;

  setStoredToken(token, expiresIn);
  import("@/lib/toast").then(({ showToast }) => showToast("Google Sheets connected."));
  return true;
}

/* =========================
   Sheet id helpers
========================= */

export function getLastSheetId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(SHEET_ID_KEY) || "";
}

export function setLastSheetId(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SHEET_ID_KEY, id);
}

/* =========================
   Sheet operations (real Sheets/Drive API calls)
========================= */

export type SheetInfo = { id: string; name: string };

async function driveFetch(path: string, token: StoredToken, init?: RequestInit) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  return res.json();
}

async function sheetsFetch(path: string, token: StoredToken, init?: RequestInit) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
  return res.json();
}

/** Lists spreadsheets the app created (drive.file scope only sees app-created files). */
export async function listSheets(token: StoredToken): Promise<SheetInfo[]> {
  const data = await driveFetch(
    `files?q=${encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false")}&fields=files(id,name)`,
    token
  );
  return (data.files ?? []).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }));
}

export async function createSheet(token: StoredToken, name = "VLTD Vault"): Promise<SheetInfo> {
  const data = await sheetsFetch("", token, {
    method: "POST",
    body: JSON.stringify({ properties: { title: name } }),
  });
  setLastSheetId(data.spreadsheetId);
  return { id: data.spreadsheetId, name };
}

export async function deleteSheet(token: StoredToken, sheetId: string): Promise<void> {
  await driveFetch(`files/${sheetId}`, token, { method: "DELETE" });
}

export async function readSheet(token: StoredToken, sheetId: string): Promise<{ rows: string[][] }> {
  const data = await sheetsFetch(`${sheetId}/values/A1:Z10000`, token);
  return { rows: data.values ?? [] };
}

export async function updateSheet(token: StoredToken, sheetId: string, rows: string[][]): Promise<void> {
  await sheetsFetch(`${sheetId}/values/A1:Z10000?valueInputOption=RAW`, token, {
    method: "PUT",
    body: JSON.stringify({ range: "A1:Z10000", values: rows }),
  });
}

/* =========================
   Vault import/export
========================= */

const VAULT_COLUMNS = [
  "id", "title", "universe", "category", "subject", "condition",
  "purchasePrice", "currentValue", "status", "createdAt",
] as const;

export async function writeVaultToSheet(token: StoredToken, sheetId: string, vault: unknown[]): Promise<void> {
  const rows: string[][] = [Array.from(VAULT_COLUMNS)];
  for (const raw of vault) {
    const item = raw as Record<string, unknown>;
    rows.push(
      VAULT_COLUMNS.map((col) => {
        const value = item[col];
        return value === undefined || value === null ? "" : String(value);
      })
    );
  }
  await updateSheet(token, sheetId, rows);
}

export async function readVaultFromSheet(token: StoredToken, sheetId: string): Promise<Record<string, string>[]> {
  const { rows } = await readSheet(token, sheetId);
  if (rows.length < 2) return [];
  const [header, ...dataRows] = rows;
  return dataRows.map((row) => {
    const record: Record<string, string> = {};
    header.forEach((col, idx) => { record[col] = row[idx] ?? ""; });
    return record;
  });
}
