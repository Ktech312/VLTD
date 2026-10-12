// Checks or applies the production Supabase Auth email configuration: sender (custom SMTP) + the VLTD templates and subjects.
// Needs a Supabase personal access token (supabase.com/dashboard/account/tokens) — NOT the service key.
//
//   node scripts/apply-supabase-auth-email-config.mjs --check
//       Shows what the project sends as right now (sender, SMTP host, subjects). No secrets printed, nothing changed.
//   node scripts/apply-supabase-auth-email-config.mjs --apply
//       Sets the sender and templates. Needs SMTP_* below. Prints the change list first and asks for the word APPLY.
//
// Environment (set in your shell, never committed):
//   SUPABASE_ACCESS_TOKEN   personal access token
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS   VLTD's existing email provider's SMTP login
//   SMTP_ADMIN_EMAIL        the verified VLTD sending address, e.g. hello@vltd.app (the From address)
//   SMTP_SENDER_NAME        defaults to "VLTD"
// The project ref is read from NEXT_PUBLIC_SUPABASE_URL in .env.local.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv.includes("--apply") ? "apply" : "check";

function envFromFile() {
  try {
    return Object.fromEntries(
      readFileSync(join(ROOT, ".env.local"), "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#") && l.includes("=")).map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      })
    );
  } catch {
    return {};
  }
}

const fileEnv = envFromFile();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL || "";
const ref = new URL(url).hostname.split(".")[0];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN is not set. Create a personal access token at supabase.com/dashboard/account/tokens.");
  process.exit(1);
}
const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const current = await (await fetch(api, { headers })).json();
if (!current || current.message) {
  console.error("Could not read the project's auth settings:", current?.message ?? "unknown error");
  process.exit(1);
}

console.log(`Project ${ref} — current Auth email settings`);
console.log("  Custom SMTP host:   ", current.smtp_host || "(none — Supabase's default sender is in use)");
console.log("  From address:       ", current.smtp_admin_email || "(default: noreply@mail.app.supabase.io)");
console.log("  Sender name:        ", current.smtp_sender_name || "(default: Supabase Auth)");
for (const key of ["confirmation", "invite", "magic_link", "recovery", "email_change", "reauthentication"]) {
  const body = current[`mailer_templates_${key}_content`] || "";
  console.log(`  ${key.padEnd(16)} subject: ${JSON.stringify(current[`mailer_subjects_${key}`] ?? "")}  ${/vltd/i.test(body) ? "[VLTD template]" : "[default template]"}`);
}
if (mode === "check") process.exit(0);

const need = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_ADMIN_EMAIL"].filter((k) => !process.env[k]);
if (need.length) {
  console.error("Missing:", need.join(", "));
  process.exit(1);
}

const subjects = JSON.parse(readFileSync(join(ROOT, "docs", "supabase-email-templates", "subjects.json"), "utf8"));
const patch = {
  smtp_host: process.env.SMTP_HOST,
  smtp_port: String(process.env.SMTP_PORT),
  smtp_user: process.env.SMTP_USER,
  smtp_pass: process.env.SMTP_PASS,
  smtp_admin_email: process.env.SMTP_ADMIN_EMAIL,
  smtp_sender_name: process.env.SMTP_SENDER_NAME || "VLTD",
};
for (const key of Object.keys(subjects)) {
  patch[`mailer_subjects_${key}`] = subjects[key];
  patch[`mailer_templates_${key}_content`] = readFileSync(join(ROOT, "docs", "supabase-email-templates", `${key}.html`), "utf8");
}

console.log("\nAbout to change:");
console.log(`  From:    ${patch.smtp_sender_name} <${patch.smtp_admin_email}> via ${patch.smtp_host}:${patch.smtp_port}`);
for (const key of Object.keys(subjects)) console.log(`  ${key.padEnd(16)} -> subject ${JSON.stringify(subjects[key])} + VLTD template`);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question('\nType APPLY to change the production project: ');
rl.close();
if (answer.trim() !== "APPLY") {
  console.log("Cancelled. Nothing changed.");
  process.exit(0);
}
const res = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(patch) });
console.log(res.ok ? "Applied. Now send a real test email to an authorized inbox and check sender, branding, phone layout and the link." : `Failed: ${res.status} ${await res.text()}`);
