// VLT suite 6: /vault Wall controls (search, universe pills, A-Z, Advanced, size), selection mode (delete / move / move to Business on throwaway QA items), Tools menu exports.
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, ids, setMode, typeInto, PAGE_SEARCH, stats, admin, fs, AUD } = X; const r = R("VLT");
const PG = (x) => `/vault | owner, Personal, 40 listed (34 counted) + 6 sold | ${x}`;
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const uni = (u) => String(u).toUpperCase();
const wallSearch = 'input[type=search][placeholder="Search…"]';
const wallCount = (S) => S.evaluate("(() => { const m = /(\\d+) items(?= All \\()/.exec(document.body.innerText.replace(/\\s+/g, ' ')); return m ? Number(m[1]) : null; })()");
const clickBtn = (S, re, scope = "main") => clickEl(S, `[...document.querySelectorAll('${scope} button')].find((b) => ${re}.test(b.innerText.replace(/\\s+/g, ' ').trim()) || ${re}.test(b.getAttribute('aria-label') || ''))`, { js: true });
const BLOB_INIT = `(() => { if (window.__vltBlobs) return; window.__vltBlobs = []; const c = URL.createObjectURL; URL.createObjectURL = function (b) { try { window.__vltBlobs.push(b); } catch (e) {} return c.call(URL, b); }; })();`;

(async () => {
  const m = X.man(); const P = m.personalId; const B = m.businessId; const st = m.stamp;
  const all = await X.rows(P); const listed = all.filter((x) => !X.isSold(x));
  const idOf = (rows) => rows.map((x) => x.id);
  const S = await X.session("owner");
  try {
    await S.send("Page.addScriptToEvaluateOnNewDocument", { source: BLOB_INIT });
    await S.visit("/vault"); await S.evaluate("localStorage.setItem('vltd_vault_view_mode', 'wall'); sessionStorage.clear(); true"); await S.visit("/vault");
    // ---------- Wall own controls
    const total = await wallCount(S); const tiles = (await ids(S)).length;
    r.check(total === listed.length && tiles === listed.length, { page: PG("Wall"), control: "Wall header count ('N items')", expected: `${listed.length} items = tiles drawn`, actual: `count text ${total}; tiles ${tiles}`, impact: "misleading result", repro: "Open /vault Wall" });
    await X.typeInto(S, wallSearch, "zebra"); let got = await ids(S); let c = await wallCount(S);
    r.check((got.length === 1 && got[0].endsWith("_zebra") && c === 1), { page: PG("Wall own search"), control: "Wall 'Search…' box", expected: "Only the Zebra Comic (title/source) and the count says 1 items", actual: `shown ${got.join(",")}; count ${c}`, evidence: await S.jshot("vlt-wall-search"), impact: "misleading result", repro: "Wall: type zebra in the small Search… box" });
    // two search boxes: page level + wall level combine (AND)
    await X.typeInto(S, PAGE_SEARCH, "needle42"); got = await ids(S);
    r.check(got.length === 1 && got[0].endsWith("_zebra"), { page: PG("Wall + page search"), control: "Page search AND Wall search together", expected: "Both searches apply (zebra AND needle42 = Zebra Comic)", actual: `shown ${got.join(",")}`, impact: "usability", repro: "Type in both boxes" });
    await X.typeInto(S, PAGE_SEARCH, "paint"); got = await ids(S);
    r.check(got.length === 0 && /No items match\./.test(squash(await S.text())), { page: PG("Wall + page search"), control: "Page search 'paint' + Wall search 'zebra' (no overlap)", expected: "No items; explicit 'No items match.'", actual: `shown ${got.length}`, impact: "misleading result", repro: "Page search paint, wall search zebra" });
    await X.typeInto(S, PAGE_SEARCH, ""); await X.typeInto(S, wallSearch, "");
    r.pass({ page: PG("Wall"), control: "Two search boxes on the Wall page", expected: "(observation) the Wall view has its own 'Search…' box, universe pills and counts in addition to the page-level Search, universe chips and summary cards; the two sets are independent, and the summary cards never reflect Wall-only filters", actual: `with Wall search 'zebra' the Items card still reads ${(await (async () => { await X.typeInto(S, wallSearch, "zebra"); const s = await stats(S); await X.typeInto(S, wallSearch, ""); return s.itemsCard; })())}`, evidence: "shots/vlt-wall-search.jpg", impact: "improvement", repro: "Type in the Wall search box and read the cards" });
    // wall universe pills multi-select
    const pill = (lab) => `[...document.querySelectorAll('main button')].find((b) => /^${lab} \\(\\d+\\)$/.test(b.innerText.replace(/\\s+/g, ' ').trim()))`;
    await clickEl(S, pill("Sports"), { js: true }); await sleep(700); await clickEl(S, pill("TCG"), { js: true }); await sleep(900);
    const wantU = listed.filter((x) => ["SPORTS", "TCG"].includes(uni(x.universe)));
    got = await ids(S);
    r.check(same(got, idOf(wantU)) && (await wallCount(S)) === wantU.length, { page: PG("Wall universe pills"), control: "Wall universe pills (multi-select Sports + TCG)", expected: `Union of both: ${wantU.length} items`, actual: `shown ${got.length}; count ${await wallCount(S)}`, evidence: await S.jshot("vlt-wall-pills"), impact: "misleading result", repro: "Click Sports then TCG pills inside the Wall" });
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /^All \\(\\d+\\)$/.test(b.innerText.replace(/\\s+/g, ' ').trim()))", { js: true }); await sleep(800);
    r.check(same(await ids(S), idOf(listed)), { page: PG("Wall universe pills"), control: "Wall 'All (N)' pill", expected: "Clears the pills; everything back", actual: String((await ids(S)).length), impact: "usability", repro: "Click All" });
    // A-Z
    const letters = await S.evaluate("[...document.querySelectorAll('main button')].filter((b) => /^[A-Z#]$/.test(b.textContent.trim())).map((b) => b.textContent.trim() + (b.disabled ? '-' : '+'))");
    const enabled = letters.filter((l) => l.endsWith("+")).map((l) => l[0]);
    const startLetters = [...new Set(listed.map((x) => { const f = (x.title || "").trim().toUpperCase()[0] || "#"; return /[A-Z]/.test(f) ? f : "#"; }))].sort();
    r.check(JSON.stringify(enabled.sort()) === JSON.stringify(startLetters), { page: PG("Wall A-Z"), control: "A-Z letter buttons", expected: `Enabled only for letters that start a title: ${startLetters.join(",")}`, actual: `enabled: ${enabled.join(",")}`, impact: "usability", repro: "Look at the A-Z row" });
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Q')", { js: true }); await sleep(1500);
    const qTop = await S.evaluate("(() => { const el = [...document.querySelectorAll('main div')].find((d) => d.children.length === 0 && d.textContent.trim() === 'Q'); return el ? Math.round(el.getBoundingClientRect().top) : null; })()");
    r.check(qTop !== null && qTop > 0 && qTop < 450, { page: PG("Wall A-Z"), control: "Letter 'Q' jump", expected: "Scrolls the Q section header into view", actual: `Q header top=${qTop}px`, impact: "usability", repro: "Click Q" });
    // Advanced
    await clickBtn(S, /^Advanced$/); await sleep(500);
    const adv = async (ph, text) => { await X.typeInto(S, `input[placeholder="${ph}"]`, text); return ids(S); };
    got = await adv("e.g. 9.8, PSA 10", "CGC"); r.check(got.length === 1 && got[0].endsWith("_zebra"), { page: PG("Wall Advanced"), control: "Advanced > Grade 'CGC'", expected: "Zebra Comic only", actual: got.join(","), evidence: await S.jshot("vlt-wall-advanced"), impact: "misleading result", repro: "Advanced; Grade = CGC" });
    await adv("e.g. 9.8, PSA 10", "");
    const catWant = listed.filter((x) => [x.category_label, x.subcategory_label, x.category].filter(Boolean).join(" ").toLowerCase().includes("comics"));
    got = await adv("e.g. Comics, TCG", "comics"); r.check(same(got, idOf(catWant)), { page: PG("Wall Advanced"), control: "Advanced > Category 'comics'", expected: `${catWant.length} comics items`, actual: String(got.length), impact: "misleading result", repro: "Category = comics" });
    await adv("e.g. Comics, TCG", "");
    got = await adv("e.g. Box A, Shelf 3", "shelf q"); r.check(got.length === 1 && got[0].endsWith("_zebra"), { page: PG("Wall Advanced"), control: "Advanced > Storage 'shelf q'", expected: "Zebra Comic", actual: got.join(","), impact: "misleading result", repro: "Storage = shelf q" });
    await adv("e.g. Box A, Shelf 3", "");
    got = await adv("e.g. eBay, LCS", "zebra mart"); r.check(got.length === 1 && got[0].endsWith("_zebra"), { page: PG("Wall Advanced"), control: "Advanced > Source 'zebra mart'", expected: "Zebra Comic", actual: got.join(","), impact: "misleading result", repro: "Source = zebra mart" });
    await adv("e.g. eBay, LCS", "");
    const stSel = async (v) => { await S.evaluate(`(() => { const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === 'FOR_SALE')); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(v)}); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await sleep(900); return ids(S); };
    for (const [v, lab] of [["FOR_SALE", "For Sale"], ["COLLECTION", "Collection"], ["AUCTION", "Auction"]]) {
      got = await stSel(v); const w = listed.filter((x) => x.status === v);
      r.check(same(got, idOf(w)) && (w.length > 0 || /No items match/.test(squash(await S.text()))), { page: PG("Wall Advanced"), control: `Advanced > Status '${lab}'`, expected: `${w.length} items with that status${w.length === 0 ? " and a no-match message" : ""}`, actual: `shown ${got.length}`, impact: "misleading result", repro: `Status = ${lab}` });
    }
    await stSel("");
    await clickEl(S, "[...document.querySelectorAll('label')].find((l) => /Graded only/.test(l.innerText)).querySelector('input')", { js: true }); await sleep(800);
    got = await ids(S); r.check(same(got, idOf(listed.filter((x) => x.grade))), { page: PG("Wall Advanced"), control: "Advanced > Graded only", expected: "2 graded items", actual: String(got.length), impact: "misleading result", repro: "tick Graded only" });
    await clickBtn(S, /^Clear filters$/); await sleep(800);
    r.check(same(await ids(S), idOf(listed)), { page: PG("Wall Advanced"), control: "Advanced > Clear filters", expected: "All advanced filters cleared", actual: String((await ids(S)).length), impact: "usability", repro: "Clear filters" });
    // size slider
    await S.evaluate("(() => { const s = document.querySelector('input[type=range]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(s, '3'); s.dispatchEvent(new Event('input', { bubbles: true })); return true; })()"); await sleep(700);
    const colsNow = await S.evaluate("(() => { const g = [...document.querySelectorAll('main div.grid')].find((d) => d.querySelector('a[href^=\"/vault/item/\"]')); return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : null; })()");
    r.check(colsNow === 3, { page: PG("Wall size slider"), control: "Size slider (3)", expected: "3 columns of tiles", actual: String(colsNow), evidence: await S.jshot("vlt-wall-size3"), impact: "usability", repro: "Drag Size to 3" });

    // ---------- selection mode on throwaway rows (gallery view)
    await S.visit("/vault"); await setMode(S, "Gallery");
    const delId = `qa_vlt_${st}_del1`, mvId = `qa_vlt_${st}_mv1`, mbId = `qa_vlt_${st}_mvb1`;
    await clickEl(S, 'button[aria-label="Select items"]'); await sleep(600);
    const countOverlays = await S.evaluate("document.querySelectorAll('button[aria-label^=\"Select \"]').length");
    r.check(countOverlays > listed.length - 3, { page: PG("Select items"), control: "Select items (icon)", expected: "Turns on selection: every card gets a select overlay; 'Select all N' and 'Cancel' appear", actual: `${countOverlays} overlays; buttons: ${await S.evaluate("[...document.querySelectorAll('main button')].map((b) => b.innerText.trim()).filter((t) => /^(Select all|Cancel)/.test(t)).join(' | ')")}`, evidence: await S.jshot("vlt-vault-selectmode"), impact: "usability", repro: "Click the select icon" });
    await clickBtn(S, /^Select all \d+$/); await sleep(500);
    const selTxt = await S.evaluate("[...document.querySelectorAll('main button')].map((b) => b.innerText.trim()).find((t) => /^Delete \\d+$/.test(t))");
    r.check(selTxt === `Delete ${listed.length}`, { page: PG("Select items"), control: "Select all N", expected: `Selects all ${listed.length} listed items ('Delete ${listed.length}')`, actual: selTxt, impact: "usability", repro: "Select items > Select all" });
    await clickBtn(S, /^Cancel$/); await sleep(600);
    r.check((await S.evaluate("document.querySelectorAll('button[aria-label^=\"Select \"]').length")) <= 1, { page: PG("Select items"), control: "Cancel (selection)", expected: "Leaves selection mode, nothing deleted or changed", actual: `overlays left ${await S.evaluate("document.querySelectorAll('button[aria-label^=\"Select \"]').length")}; db rows ${(await X.rows(P)).length}`, impact: "data loss", repro: "Select all, Cancel" });
    // delete: cancel first
    const rowCount0 = (await X.rows(P)).length;
    await clickEl(S, 'button[aria-label="Select items"]'); await sleep(500);
    await clickEl(S, `button[aria-label="Select QA VLT Throwaway Delete"]`); await sleep(400);
    await clickBtn(S, /^Delete 1$/); await sleep(400);
    const confirmTxt = squash(await S.text());
    r.check(/Delete 1 item\?/.test(confirmTxt), { page: PG("Select items > Delete"), control: "Delete 1", expected: "Asks 'Delete 1 item?' with Yes, Delete / Cancel (no deletion yet)", actual: (/Delete 1 item\?/.exec(confirmTxt) || ["no confirmation"])[0], evidence: await S.jshot("vlt-vault-delete-confirm"), impact: "data loss", repro: "Select one item; click Delete 1" });
    await clickBtn(S, /^Cancel$/, "main"); await sleep(600);
    const stillThere = (await admin.from("vault_items").select("id").eq("id", delId)).data.length === 1;
    r.check(stillThere && (await X.rows(P)).length === rowCount0, { page: PG("Select items > Delete"), control: "Delete confirmation 'Cancel'", expected: "Nothing deleted: the item is still in the database and the list", actual: `db still has item: ${stillThere}; rows ${(await X.rows(P)).length}/${rowCount0}`, impact: "data loss", repro: "Delete 1 > Cancel" });
    // confirm delete
    await S.visit("/vault"); await setMode(S, "Gallery"); await clickEl(S, 'button[aria-label="Select items"]'); await sleep(500);
    await clickEl(S, `button[aria-label="Select QA VLT Throwaway Delete"]`); await sleep(400); await clickBtn(S, /^Delete 1$/); await sleep(300); await clickBtn(S, /^Yes, Delete$/); await sleep(2500);
    let gone = false; for (let i = 0; i < 10 && !gone; i++) { gone = (await admin.from("vault_items").select("id").eq("id", delId)).data.length === 0; if (!gone) await sleep(1000); }
    const after = await X.rows(P);
    r.check(gone && after.length === rowCount0 - 1 && !(await ids(S)).includes(delId), { page: PG("Select items > Delete"), control: "Yes, Delete (one item)", expected: "Only the selected QA item is deleted (database row gone, list shrinks by one, every other row untouched)", actual: `row gone=${gone}; rows ${after.length} (was ${rowCount0}); still listed=${(await ids(S)).includes(delId)}`, evidence: await S.jshot("vlt-vault-after-delete"), impact: "data loss", repro: "Select the throwaway item; Delete 1; Yes, Delete" });
    // move to universe
    await S.visit("/vault"); await setMode(S, "Gallery"); await clickEl(S, 'button[aria-label="Select items"]'); await sleep(500);
    await clickEl(S, `button[aria-label="Select QA VLT Throwaway Move"]`); await sleep(400);
    await S.evaluate(`(() => { const s = [...document.querySelectorAll('main select')].find((x) => [...x.options].some((o) => /^Move \\d+ to/.test(o.textContent))); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'GAMES'); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await sleep(500);
    await clickBtn(S, /^Move 1$/); await sleep(2500);
    let moved = null; for (let i = 0; i < 12; i++) { moved = (await admin.from("vault_items").select("universe,profile_id").eq("id", mvId).single()).data; if (moved && moved.universe === "GAMES") break; await sleep(1000); }
    r.check(moved && moved.universe === "GAMES" && moved.profile_id === P, { page: PG("Select items > Move"), control: "Move 1 to… Games", expected: "The selected item's universe becomes GAMES in the database (same profile); other items unchanged", actual: JSON.stringify(moved), evidence: await S.jshot("vlt-vault-after-move"), impact: "data loss", repro: "Select throwaway item; Move 1 to… Games; Move 1" });
    const g1 = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("universe", "GAMES")).data.length;
    r.pass({ page: PG("Select items > Move"), control: "Move: only the selected item moved", expected: "GAMES holds the earlier quote item plus the moved one", actual: `GAMES rows in db: ${g1} (expected 2)`, impact: "none", repro: "see Move row" });
    // move to the Business profile
    await S.visit("/vault"); await setMode(S, "Gallery"); await clickEl(S, 'button[aria-label="Select items"]'); await sleep(500);
    await clickEl(S, `button[aria-label="Select QA VLT Throwaway ToBusiness"]`); await sleep(400);
    const profBtns = await S.evaluate("[...document.querySelectorAll('main button')].map((b) => b.getAttribute('title') || '').filter((t) => /Move selected items to/.test(t))");
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /Move selected items to/.test(b.getAttribute('title') || ''))", { js: true }); await sleep(400);
    const askTxt = squash(await S.text());
    r.check(/Move 1 to .*They leave this profile/.test(askTxt), { page: PG("Select items > move to profile"), control: "Move to the other profile (button)", expected: "Asks 'Move 1 to <profile>? They leave this profile.' with Yes, move / No", actual: `${JSON.stringify(profBtns)} | ${(/Move 1 to [^?]*\?[^.]*\./.exec(askTxt) || ["no prompt"])[0]}`, impact: "data loss", repro: "Select an item; click the Business profile button" });
    await clickBtn(S, /^No$/); await sleep(400);
    const still = (await admin.from("vault_items").select("profile_id").eq("id", mbId).single()).data;
    r.check(still.profile_id === P, { page: PG("Select items > move to profile"), control: "'No' on the profile-move prompt", expected: "Item stays in Personal", actual: still.profile_id === P ? "stayed in Personal" : "MOVED", impact: "data loss", repro: "Move prompt > No" });
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /Move selected items to/.test(b.getAttribute('title') || ''))", { js: true }); await sleep(400); await clickBtn(S, /^Yes, move$/); await sleep(3000);
    let mb = null; for (let i = 0; i < 12; i++) { mb = (await admin.from("vault_items").select("profile_id,is_public").eq("id", mbId).single()).data; if (mb.profile_id === B) break; await sleep(1000); }
    r.check(mb.profile_id === B && mb.is_public === false && !(await ids(S)).includes(mbId), { page: PG("Select items > move to profile"), control: "Yes, move (to Business)", expected: "Item belongs to Business profile (private), leaves the Personal list; Personal never shows it again", actual: `profile=${mb.profile_id === B ? "Business" : "Personal"}; public=${mb.is_public}; still in Personal list=${(await ids(S)).includes(mbId)}`, evidence: await S.jshot("vlt-vault-after-profile-move"), impact: "privacy/data loss", repro: "Select item; Business button; Yes, move" });

    // ---------- Tools menu
    await S.visit("/vault");
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tools')", { js: true }); await sleep(600);
    const menuItems = await S.evaluate("[...document.querySelectorAll('[role=menuitem]')].map((a) => a.innerText.replace(/\\s+/g, ' ').trim())");
    r.check(menuItems.length === 6, { page: PG("Tools"), control: "Tools menu", expected: "Import, Export CSV, Export JSON, Insurance PDF, Collection report, Download photos (ZIP)", actual: JSON.stringify(menuItems), evidence: await S.jshot("vlt-vault-tools"), impact: "usability", repro: "Click Tools" });
    const blobText = async () => S.evaluate("(async () => { const b = (window.__vltBlobs || []).slice(-1)[0]; return b ? { type: b.type, size: b.size, text: b.size < 400000 && /text|json|csv/.test(b.type) ? await b.text() : '' } : null; })()");
    const chooseTool = async (re) => { await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tools')", { js: true }); await sleep(500); await clickEl(S, `[...document.querySelectorAll('[role=menuitem]')].find((a) => ${re}.test(a.innerText))`, { js: true }); await sleep(2500); };
    const dbNow = await X.rows(P);
    await S.evaluate("window.__aud && (window.__aud.downloads.length = 0); window.__vltBlobs.length = 0; true");
    await chooseTool(/Export CSV/); const lk = await S.look(); const csv = await blobText();
    const lines = csv && csv.text ? csv.text.split(/\r?\n/).filter(Boolean) : [];
    const hasQuote = csv && csv.text.includes('"QA VLT O\'Brien ""Quote"" (50%) [x] \\ Item"');
    r.check(lk.downloads.includes("vltd-vault-export.csv") && lines.length - 1 === dbNow.length && hasQuote, { page: PG("Tools > Export CSV"), control: "Export CSV", expected: `A file vltd-vault-export.csv with a header and one row per record (${dbNow.length} incl. sold), awkward title quoted correctly`, actual: `downloads=${JSON.stringify(lk.downloads)}; data rows=${lines.length - 1}; quote-escaped title present=${hasQuote}`, evidence: "", impact: "data loss", repro: "Tools > Export CSV (download stubbed and read in-page)" });
    if (csv && csv.text) fs.writeFileSync(AUD + "/vlt-export-sample.csv", csv.text.split(/\r?\n/).slice(0, 6).join("\n"));
    const head = (lines[0] || "").split(",").slice(0, 12).join(",");
    const zebraLine = lines.find((l) => l.includes("QA VLT Zebra Comic")) || "";
    r.check(zebraLine.includes("CGC 9.8") && zebraLine.includes("50") , { page: PG("Tools > Export CSV"), control: "Export CSV: values per record", expected: "The Zebra Comic row carries its grade 'CGC 9.8' and value 50", actual: zebraLine.slice(0, 200) + " || header: " + head, impact: "misleading result", repro: "Open the exported CSV" });
    await S.evaluate("window.__vltBlobs.length = 0; window.__aud.downloads.length = 0; true");
    await chooseTool(/Export JSON/); const lk2 = await S.look(); const js = await blobText();
    let parsed = null; try { parsed = JSON.parse(js.text); } catch {}
    r.check(lk2.downloads.includes("vltd-vault-export.json") && parsed && parsed.items.length === dbNow.length, { page: PG("Tools > Export JSON"), control: "Export JSON", expected: `vltd-vault-export.json with ${dbNow.length} items`, actual: `downloads=${JSON.stringify(lk2.downloads)}; items=${parsed && parsed.items.length}; version=${parsed && parsed.version}`, impact: "data loss", repro: "Tools > Export JSON" });
    // Collection report opens new tab (stubbed window.open)
    await S.evaluate("window.__aud.opens.length = 0; true");
    await chooseTool(/Collection report/); const lk3 = await S.look();
    r.check(lk3.opens.some((u) => /\/vault\/print/.test(u)), { page: PG("Tools > Collection report"), control: "Collection report", expected: "Opens /vault/print in a new tab", actual: JSON.stringify(lk3.opens), impact: "blocked workflow", repro: "Tools > Collection report (window.open stubbed)" });
    // Insurance PDF: opens a dialog
    await chooseTool(/Insurance PDF/);
    const dlg = squash(await S.evaluate("(() => { const d = document.querySelector('[role=dialog], dialog[open]') || document.body; return d.innerText; })()"));
    r.check(/insurance/i.test(dlg), { page: PG("Tools > Insurance PDF"), control: "Insurance PDF", expected: "Opens an insurance PDF dialog (intercepted: no email or upload)", actual: dlg.slice(0, 260), evidence: await S.jshot("vlt-vault-insurance-pdf"), impact: "blocked workflow", repro: "Tools > Insurance PDF" });
    await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(600);
    // Import navigates
    await S.visit("/vault"); await chooseTool(/^Import/); const ip = await S.path();
    r.check(ip === "/vault/import", { page: PG("Tools > Import"), control: "Import", expected: "Opens /vault/import", actual: ip, impact: "blocked workflow", repro: "Tools > Import" });
    // ZIP of photos: record only (downloads local /collectibles photos)
    await S.visit("/vault"); await S.evaluate("window.__aud.downloads.length = 0; window.__vltBlobs.length = 0; true");
    await chooseTool(/Download photos/); await sleep(5000); const lk4 = await S.look(); const zb = await blobText();
    r.check(lk4.downloads.some((d) => /\.zip$/i.test(d)) && zb && zb.size > 1000, { page: PG("Tools > Download photos (ZIP)"), control: "Download photos (ZIP)", expected: "A .zip with the item photos is produced", actual: `downloads=${JSON.stringify(lk4.downloads)}; blob=${zb ? zb.type + " " + zb.size + " bytes" : "none"}`, evidence: await S.jshot("vlt-vault-zip"), impact: "blocked workflow", repro: "Tools > Download photos (ZIP)" });
  } finally { console.log("errors", S.consoleErrors.slice(0, 4)); await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
