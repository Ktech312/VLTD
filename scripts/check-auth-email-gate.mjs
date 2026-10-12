// Guard: any file that can make Supabase Auth send an email must go through the sender gate (src/lib/email/senderGate.ts),
// which refuses unless the project sends as VLTD. Run: npm run check:auth-email
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const TRIGGERS = /auth\.(resetPasswordForEmail|signInWithOtp|resend|signUp)\(|auth\.admin\.inviteUserByEmail\(|auth\.updateUser\(\s*\{\s*email/;
const OWN_WRAPPER = join("src", "lib", "auth.ts"); // calls the gated /api route, not Supabase

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "zz-fixtures") continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const bad = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, "utf8");
  if (!TRIGGERS.test(text) || rel === OWN_WRAPPER || rel.startsWith(join("src", "lib", "email"))) continue;
  if (!/senderGate/.test(text)) bad.push(rel);
}
if (bad.length) {
  console.error("These files can trigger a Supabase Auth email without the VLTD sender gate:\n  " + bad.join("\n  "));
  process.exit(1);
}
console.log("OK: every Supabase Auth email trigger sits behind the VLTD sender gate.");
