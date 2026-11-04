// QA helpers for the business-membership repair (2026-11-03). Synthetic accounts only.
// The manifest (it holds the QA passwords) lives outside the repo.
const fs = require("fs");
const path = require("path");
const REPO = path.resolve(__dirname, "../../..");
const env = {};
for (const line of fs.readFileSync(path.join(REPO, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { createClient } = require(path.join(REPO, "node_modules/@supabase/supabase-js"));
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const anonClient = () => createClient(URL, ANON, { auth: { persistSession: false } });
const MANIFEST =
  process.env.BIZ_MANIFEST ||
  "C:/Users/EK/AppData/Local/Temp/claude/2b44366d026371c3/7640caaf-e429-484b-9a61-9eabbaa10381/scratchpad/qa_biz1.json";
const man = () => JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function userClient(email, password) {
  const sb = anonClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { sb, session: data.session };
}
async function baseline() {
  const items = (await admin.from("vault_items").select("id", { count: "exact", head: true })).count;
  const users = (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users.length;
  const pub = (await admin.from("galleries").select("id", { count: "exact", head: true }).eq("visibility", "PUBLIC")).count;
  return { vault_items: items, auth_users: users, public_galleries: pub };
}
module.exports = { fs, path, REPO, URL, ANON, admin, anonClient, userClient, MANIFEST, man, sleep, env, baseline };
