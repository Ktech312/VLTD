// Import Undo's "moved to another profile" and "is in an exhibition" flags on PRODUCTION (synthetic fixture). The move uses the app's own Move action.
//   AUDIT_MANIFEST=<manifest> node rb7-undo-flags.cjs <label>
const L = require("./rb6-lib.cjs");
const { r, admin, sleep, man, session, body, click, poll, btn, shot, save, T, fs } = L;
const LABEL = process.argv[2] || "run";
const out = { label: LABEL, cases: [] };
const mclick = async (S, js) => { const pos = await S.evaluate(`(() => { const e = (${js})(); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`); if (!pos) return false; await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pos.x, y: pos.y, button: "none" }); await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 1 }); await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 0 }); return true; };

(async () => {
  const m = man(); const P = m.personalId; const B = m.businessId; const st = m.stamp;
  const titles = { moved: `QA RB7 flag moved ${st}`, exh: `QA RB7 flag exhibition ${st}`, plain: `QA RB7 flag plain ${st}` };
  const profileName = (await admin.from("profiles").select("display_name").eq("id", B).single()).data.display_name;
  const statusNow = (S) => S.evaluate(`(() => { const e = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && /^(Imported|Undid|Removed|Nothing parsed|No import history to undo)/.test((d.textContent || '').trim())); return e ? e.textContent.trim() : ''; })()`);
  const S = await session("owner", { width: 1440, height: 900 });
  // 1) import three items and wait for the account to have them
  await S.visit("/vault/import"); await S.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')`, 60000).catch(() => {}); await sleep(3000);
  fs.writeFileSync(T.tmp("rb7-flags.csv"), "Name,Purchase Price,Notes\n" + Object.values(titles).map((t, i) => `${t},${5 + i},rb7`).join("\n") + "\n");
  await T.chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), T.tmp("rb7-flags.csv")); await S.waitFor(`/Parsed 3 item/.test(document.body.innerText)`, 25000).catch(() => {}); await sleep(800);
  await click(S, `[...document.querySelectorAll('label')].find((l) => /Import all parsed rows/.test(l.textContent))`); await sleep(300);
  for (let k = 0; k < 2; k++) { await click(S, btn(/Confirm Import/)); await sleep(2200); }
  const rows = await poll(async () => { const x = (await admin.from("vault_items").select("id,title").eq("profile_id", P).like("title", "QA RB7 flag%")).data || []; return x.length >= 3 ? x : null; }, 90000, 3000) || [];
  const idOf = (t) => rows.find((x) => x.title === t)?.id;
  const importMsg = await statusNow(S); await sleep(3000);

  // 2) move one item to the Business profile with the app's own Move action
  await S.visit("/vault"); await S.waitFor(`document.querySelectorAll('a[href^="/vault/item/"]').length > 3`, 90000).catch(() => {}); await sleep(4000);
  await mclick(S, `() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Gallery' && b.getBoundingClientRect().width > 1)`); await sleep(2500);
  await mclick(S, `() => document.querySelector('[aria-label="Select items"]')`); await sleep(900);
  await mclick(S, "() => [...document.querySelectorAll('button[aria-label]')].find((b) => b.getAttribute('aria-label') === " + JSON.stringify("Select " + titles.moved) + ")"); await sleep(600);
  await mclick(S, `() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes(${JSON.stringify(profileName)}) && b.getBoundingClientRect().width > 1)`); await sleep(800);
  await mclick(S, `() => [...document.querySelectorAll('button')].find((b) => /^Yes, move$/.test((b.textContent || '').trim()))`);
  const movedRow = await poll(async () => { const x = (await admin.from("vault_items").select("id,profile_id").eq("id", idOf(titles.moved))).data?.[0]; return x && x.profile_id === B ? x : null; }, 60000, 2500);
  await sleep(4000);

  // 3) put another item into an exhibition on this device (membership as the app stores it), then reload the import page
  await S.visit("/museum"); await sleep(7000);
  const inExh = await S.evaluate(`(() => { const raw = localStorage.getItem('vltd_galleries'); if (!raw) return 'no galleries stored'; const list = JSON.parse(raw); if (!list.length) return 'empty'; const id = ${JSON.stringify(idOf(titles.exh))}; const g = list.find((x) => x.profile_id === ${JSON.stringify(P)}) || list[0]; g.itemIds = [...(g.itemIds || []), id]; if (g.layout) g.layout.itemIds = [...(g.layout.itemIds || []), id]; localStorage.setItem('vltd_galleries', JSON.stringify(list)); return g.id; })()`);

  // 4) Undo: the moved item and the exhibition item are named, the plain one is not
  await S.visit("/vault/import"); await S.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Undo last')`, 60000).catch(() => {}); await sleep(3500);
  await click(S, btn(/^Undo last$/)); await S.waitFor(`!!document.querySelector('[data-testid=undo-prompt]')`, 15000).catch(() => {});
  const prompt = await S.evaluate(`(document.querySelector('[data-testid=undo-prompt]') || {}).innerText || ''`);
  const sh = await shot(S, "undo-flags-prompt");
  const flaggedMoved = new RegExp(titles.moved.replace(/ /g, "\\s") + ":[^\\n]*moved to another profile").test(prompt);
  const flaggedExh = new RegExp(titles.exh.replace(/ /g, "\\s") + ":[^\\n]*is in 1 exhibition").test(prompt);
  const plainNamed = prompt.includes(titles.plain);
  out.cases.push({ importMsg, rows: rows.length, movedToBusiness: !!movedRow, inExhibition: inExh, prompt });
  r.check(rows.length === 3 && !!movedRow && flaggedMoved && flaggedExh && !plainNamed, { page: "/vault/import", control: "Undo last with one item moved to another profile (app's own Move) and one placed in an exhibition", expected: "The prompt names the moved item ('moved to another profile') and the exhibition item ('is in 1 exhibition') and does not name the untouched one", actual: `rows ${rows.length}; moved to Business ${!!movedRow}; exhibition set on device: ${inExh}; prompt "${prompt.replace(/\n/g, " | ").slice(0, 330)}"`, evidence: sh, impact: "D-06 flags" });
  // 5) keep the moved and exhibition items (nothing destructive happens to anything that is not mine to remove): remove only the untouched one through the prompt
  const keepBtn = `[...document.querySelectorAll('button')].find((b) => /^Keep the changed ones, remove 1$/.test((b.textContent || '').trim()))`;
  await mclick(S, `() => ${keepBtn}`); await sleep(7000);
  const msg = await statusNow(S);
  const left = (await admin.from("vault_items").select("id,title,profile_id").like("title", "QA RB7 flag%")).data || [];
  r.check(/Undid 1 of 3/.test(msg) && /2 you had changed were kept/.test(msg) && left.length === 2 && !left.some((x) => x.title === titles.plain), { page: "/vault/import", control: "Undo, keep the changed ones", expected: "Only the untouched item is removed; the moved item (now in Business) and the exhibition item stay; message says 2 were kept", actual: `message "${msg.slice(0, 160)}"; items left ${left.map((x) => x.title.replace(/QA RB7 flag |\s\w+$/g, "")).join(", ")}`, impact: "D-06 flags" });
  await S.close();
  for (const x of left) await admin.from("vault_items").delete().eq("id", x.id);
  for (const x of (await admin.from("vault_items").select("id").like("title", "QA RB7 flag%")).data || []) await admin.from("vault_items").delete().eq("id", x.id);
  save(`rb7-undo-flags-${LABEL}`, out); console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(2); });
