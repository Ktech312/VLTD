"use client";

/**
 * Demo/local Google Sheets shim.
 *
 * Goal: keep the app compiling + running locally without crashing SSR/build.
 * You can later replace internals with real OAuth + Sheets API calls.
 */

export type StoredToken = string;

const TOKEN_KEY = "vltd_google_token_v1";
const SHEET_ID_KEY = "vltd_google_sheet_id_v1";

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
}

export function setStoredToken(token: StoredToken) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function isTokenValid(token?: StoredToken | null): boolean {
  // Demo: treat any non-empty string as valid
  return Boolean(token && token.trim().length > 0);
}

/* =========================
   OAuth connect flow (demo)
========================= */

/**
 * Demo: in a real build, redirect to Google OAuth.
 * Here we just alert so the UI doesn't explode.
 */
export function startGoogleConnect() {
  if (typeof window === "undefined") return;
  alert("Demo build: Google connect not wired. Provide a token in localStorage if needed.");
}

/**
 * Demo: in a real build, parse code/state from URL.
 * Here it is a no-op that returns false (no changes).
 */
export function finishGoogleConnectIfPresent(): boolean {
  return false;
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
   Sheet operations (demo)
========================= */

export type SheetInfo = { id: string; name: string };

export async function listSheets(_token: StoredToken): Promise<SheetInfo[]> {
  // Demo: return last used sheet id if present
  const last = getLastSheetId();
  return last ? [{ id: last, name: "Last used sheet" }] : [];
}

export async function createSheet(_token: StoredToken, name = "VLTD Vault"): Promise<SheetInfo> {
  // Demo: "create" a fake id
  const fakeId = `demo_${Math.random().toString(36).slice(2)}`;
  setLastSheetId(fakeId);
  return { id: fakeId, name };
}

export async function deleteSheet(_token: StoredToken, _sheetId: string): Promise<void> {
  // Demo: nothing to delete
  return;
}

export async function readSheet(_token: StoredToken, _sheetId: string): Promise<any> {
  // Demo: return empty sheet
  return { rows: [] };
}

export async function updateSheet(_token: StoredToken, _sheetId: string, _payload: any): Promise<void> {
  // Demo: no-op
  return;
}

/* =========================
   Vault import/export helpers (demo)
========================= */

/**
 * In your app, "vault" appears to live in localStorage key: vltd_items_v2
 * We'll read/write that key to simulate sheet import/export.
 */
const VAULT_KEY = "vltd_items_v2";

export async function readVaultFromSheet(_token: StoredToken, _sheetId: string): Promise<any[]> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VAULT_KEY) || "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeVaultToSheet(_token: StoredToken, sheetId: string, vault: any[]): Promise<void> {
  // Demo: “write” just means persist locally and remember sheetId
  if (typeof window === "undefined") return;
  setLastSheetId(sheetId);
  window.localStorage.setItem(VAULT_KEY, JSON.stringify(Array.isArray(vault) ? vault : []));
}