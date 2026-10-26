// Regression test: an account without AI access is never shown an AI button or an AI allowance, and the owner's account still is.
//   npm run test:ai-ui
// The server refuses every account except the owner's (lib/server/scanGuard.ts, tested in test-ai-scan-guard.ts). These checks cover the SCREENS: the one rule they use
// (aiAccessFor: the owner's confirmed address, the same rule as the server) and that every screen that shows an AI control or an allowance is behind it.
import assert from "node:assert/strict";
import fs from "node:fs";

import { aiAccessFor } from "../src/lib/ai/useAiAccess";

const results: Array<{ name: string; ok: boolean; err?: string }> = [];
function test(name: string, fn: () => void) {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, err: String((e as Error)?.message ?? e).split("\n")[0] }); }
}

const OWNER = "eck1679@gmail.com";
test("the owner's confirmed account has AI access (preserved)", () => {
  assert.equal(aiAccessFor({ email: OWNER, email_confirmed_at: "2026-01-01T00:00:00Z" }), true);
  assert.equal(aiAccessFor({ email: OWNER.toUpperCase(), confirmed_at: "2026-01-01T00:00:00Z" }), true);
});
test("any other account, an unconfirmed owner address, a look-alike and nobody have no AI access", () => {
  assert.equal(aiAccessFor({ email: "someone@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" }), false);
  assert.equal(aiAccessFor({ email: OWNER }), false, "unconfirmed");
  assert.equal(aiAccessFor({ email: `${OWNER}.example.net`, email_confirmed_at: "2026-01-01T00:00:00Z" }), false);
  assert.equal(aiAccessFor(null), false);
  assert.equal(aiAccessFor(undefined), false);
  assert.equal(aiAccessFor({ email: null, email_confirmed_at: "2026-01-01T00:00:00Z" }), false);
});

const read = (f: string) => fs.readFileSync(f, "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// Every screen that can show an AI button or an allowance, and the guard each must have.
const SCREENS: Array<{ file: string; guards: RegExp[]; why: string }> = [
  { file: "src/components/ScanVerifySheet.tsx", why: "Quick Add verify sheet", guards: [/useAiAccess\(\)/, /aiAccess && metered && remaining !== null/, /aiAccess \? \(\s*<PillButton size="compact" className="ml-auto shrink-0" onClick=\{\(\) => onRescan/, /aiAccess && drafts\.some\(\(d\) => !d\.scanned\)/] },
  { file: "src/app/capture/page.tsx", why: "Add Item form", guards: [/useAiAccess\(\)/, /aiAccess \? \(\s*<ActionButton\s+label=\{analyzing \? "Identifying…" : "Identify with AI"\}/, /aiAccess && metered && scanRemaining !== null && capturedImageFile/] },
  { file: "src/components/ScanCapturePanel.tsx", why: "Quick Add identifying screen", guards: [/useAiAccess()/, /aiAccess && metered && scanRemaining !== null/] },
  { file: "src/components/CoaScanButton.tsx", why: "certificate scan on the item page", guards: [/useAiAccess\(\)/, /if \(!aiAccess\) return null;/] },
  { file: "src/components/ScanPanel.tsx", why: "Add manually photo panel", guards: [/useAiAccess\(\)/, /aiAccess \? \(\s*<PillButton\s+onClick=\{onScanAutofill\}/] },
  { file: "src/app/vault/bulk/page.tsx", why: "Bulk Upload", guards: [/useAiAccess\(\)/, /aiAccess && profileId && remaining !== null && scanLimit !== null/, /aiAccess \? \(\s*<button\s+type="button"\s+disabled=\{!universe \|\| !category \|\|/, /aiAccess && profileId && remaining === 0/] },
];
for (const s of SCREENS) {
  test(`${s.why} (${s.file}): every AI control and allowance is behind the AI-access check`, () => {
    const src = strip(read(s.file));
    for (const g of s.guards) assert.match(src, g, `missing guard ${g}`);
  });
}
test("no screen shows an AI button or allowance outside the screens above (a new one must be added here on purpose)", () => {
  const files: string[] = [];
  const walk = (d: string) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.(tsx)$/.test(e.name)) files.push(p); } };
  walk("src");
  const known = new Set(SCREENS.map((s) => s.file));
  const offenders = files.filter((f) => !known.has(f) && /(>|["'`])\s*(Identify( again)? with AI|Scan certificate with AI|Scan with AI to fill details)\b|AI scans? left this cycle|\{remaining\}\s*<\/span>\s*<span[^>]*>left/.test(strip(read(f))));
  assert.deepEqual(offenders, [], "unguarded: " + offenders.join(", "));
});
test("the owner rule on the screens is the same one the server uses", () => {
  const hook = read("src/lib/ai/useAiAccess.ts");
  const server = read("src/lib/server/scanGuard.ts");
  assert.match(hook, /isOwnerEmail/);
  assert.match(server, /isOwnerEmail\(data\.user\?\.email\)/);
  assert.match(hook, /email_confirmed_at/);
});

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.err ? `\n      ${r.err}` : ""}`);
console.log(`\n${results.length - failed.length} of ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
