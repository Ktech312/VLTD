// Shared helpers for the GIN audit suites (Goals + Insurance). Fixture tag: gin.
process.env.AUDIT_MANIFEST = process.env.AUDIT_MANIFEST || __dirname + "/qa_audit_gin.json";
const X = require("./audit-s-vlt-lib.cjs");
const { admin, sleep, man, mouseClick, clickEl } = X;
const R = X.R("GIN");

const INTERCEPT = ["*/api/ai/*", "*/api/billing/*", "*/api/auth/*", "*/api/newsletter*", "*/api/waitlist*", "*/api/push/*", "*/api/clubs/notify*", "*/api/launch-access*", "*/api/admin/*", "*/api/card-lookup*", "*/api/psa-lookup*", "*/api/upc-lookup*", "*/api/comic-lookup*", "*/api/vinyl-lookup*", "*supabase.co/auth/v1/*", "*supabase.co/functions/v1/*"];
// refuse(S, [patterns]) answers those requests with the audit's 503 (via the library handler); refuse(S, []) restores the normal list.
async function refuse(S, extra) { await S.send("Fetch.enable", { patterns: [...INTERCEPT, ...(extra || [])].map((urlPattern) => ({ urlPattern })) }); }

const SHOT = (S, n) => S.jshot("gin-" + n);

function squash(s) { return String(s || "").replace(/\s+/g, " ").trim(); }

async function typeInto(S, selJs, text) {
  const ok = await clickEl(S, selJs, { js: true });
  if (!ok) return false;
  await S.evaluate(`(() => { const e = document.activeElement; if (e && e.select) e.select(); return true; })()`);
  if (text === "") await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 }), await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Delete", code: "Delete", windowsVirtualKeyCode: 46 });
  else await S.send("Input.insertText", { text });
  await sleep(120);
  return true;
}
async function pressKey(S, key, code, vk) { const txt = key === "Enter" ? { text: String.fromCharCode(13), unmodifiedText: String.fromCharCode(13) } : key === " " ? { text: " ", unmodifiedText: " " } : {}; await S.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk, ...txt }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk }); }
async function tap(S, x, y) { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await sleep(60); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
async function tapEl(S, selJs) {
  const pt = await S.evaluate(`(() => { const el = ${selJs}; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`);
  if (!pt) return null; await sleep(250); await tap(S, pt.x, pt.y); return pt;
}

// ---- goal page helpers
const BTN = (label) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().replace(/\\s+/g,' ') === ${JSON.stringify(label)} && b.getBoundingClientRect().width > 1)`;
const clickBtn = (S, label) => clickEl(S, BTN(label), { js: true });
const FILTER = (label) => `[...document.querySelectorAll('[role=group][aria-label="Goal types"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`;
const GOAL_ROWS_JS = `(() => [...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')).map((b) => { const t = b.innerText.replace(/\\s+/g, ' ').trim(); const m = t.match(/(-?[\\d,]+) of ([\\d,]+) (items|value)/); return { name: b.querySelector('h2').textContent.trim(), pct: Number((t.match(/^(\\d+)%/) || [])[1]), owned: m ? Number(m[1].replace(/,/g, '')) : null, target: m ? Number(m[2].replace(/,/g, '')) : null, unit: m ? m[3] : null, vis: /Private|Public/.exec(t)?.[0], preview: (t.match(/(VALUE PROGRESS|RECENTLY ADDED|DUPLICATES READY TO LIST|EXHIBITION PREVIEW|TOP ITEMS IN GOAL|Value Progress|Recently Added|Duplicates Ready To List|Exhibition Preview|Top Items In Goal)/i) || [])[1], next: (t.match(/Next Action (.*?)( \\d+ items missing| Ready)/i) || [])[1], action: [...b.querySelectorAll('button')].map((x) => x.textContent.trim())[0], t }; }))()`;
const goalRows = (S) => S.evaluate(GOAL_ROWS_JS);
const names = async (S) => (await goalRows(S)).map((g) => g.name);
const mainText = async (S) => squash(await S.evaluate("document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText"));
const ASIDE = `document.querySelector('main aside')`;
const asideText = async (S) => squash((await S.evaluate(`(${ASIDE} || {}).innerText || ''`)));

// app rules (src/lib/collectionGoals.ts) re-derived from database rows
const isActive = (r) => r.status !== "SOLD" && r.status !== "WISHLIST";
function expectProgress(goal, rows) {
  const active = rows.filter(isActive);
  let owned;
  if (goal.subject && goal.subject.trim()) owned = active.filter((r) => String(r.subject || "").toLowerCase() === goal.subject.trim().toLowerCase()).length;
  else if (goal.universe) owned = active.filter((r) => r.universe === goal.universe).length;
  else owned = active.length;
  const target = Math.max(1, goal.target_count);
  return { owned, target, pct: Math.min(100, Math.round((owned / target) * 100)), missing: Math.max(0, target - owned) };
}
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

async function goalsDb(pid) { const r = await admin.from("collection_goals").select("*").eq("profile_id", pid).order("created_at", { ascending: false }); if (r.error) throw new Error(r.error.message); return r.data; }
async function wishDb(pid) { const r = await admin.from("wishlist").select("*").eq("profile_id", pid); return r.error ? { error: r.error.message, data: [] } : { data: r.data }; }
async function waitDb(fn, ms = 15000) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await sleep(500); } }

module.exports = { ...X, X, R, refuse, SHOT, squash, typeInto, pressKey, tap, tapEl, BTN, clickBtn, FILTER, goalRows, names, mainText, ASIDE, asideText, expectProgress, isActive, num, goalsDb, wishDb, waitDb, GOAL_ROWS_JS };

// Open Goals the way a person does after a normal visit: Vault first (loads the items), then the Goals tab.
async function gotoGoals(S, { vault = true } = {}) {
  if (vault) {
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0 || /No items yet|Add your first/i.test(document.body.innerText)", 90000, "vault items"); await sleep(1500);
    await clickEl(S, `[...document.querySelectorAll('nav[aria-label="Vault"] a')].find((a) => a.textContent.trim() === 'Goals')`, { js: true });
    await S.waitFor("location.pathname === '/goals'", 30000, "goals tab");
  } else await S.visit("/goals");
  await S.waitFor("document.querySelector('main') && !/Loading your goals/.test(document.body.innerText)", 60000, "goals loaded"); await sleep(2500);
}
async function pickSort(S, label) {
  await clickEl(S, `document.querySelector('[aria-label="Sort goals"]')`, { js: true }); await sleep(400);
  const ok = await clickEl(S, `[...document.querySelectorAll('[role=menu] button,[role=menuitem],[role=option],[role=menu] *')].find((b) => b.textContent.trim() === ${JSON.stringify(label)} && b.getBoundingClientRect().width > 1) || [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === ${JSON.stringify(label)}).pop()`, { js: true });
  await sleep(500); return ok;
}
async function seedGoals(list) {
  const m = man(); const P = m.personalId;
  await admin.from("collection_goals").delete().eq("profile_id", P);
  const r = await admin.from("collection_goals").insert(list.map((g) => ({ profile_id: P, universe: null, subject: null, notes: null, ...g })));
  if (r.error) throw new Error(r.error.message);
}
Object.assign(module.exports, { gotoGoals, pickSort, seedGoals });
