// Behaviour checks for the item page, Share, Export, Cost to Sell, Home and the exhibition carousel (synthetic QA account only).
//   node ui-checks.cjs <label> [--base=http://localhost:3100] [--only=item,share,export,sell,home,exhibition]
const fs = require("fs");
const path = require("path");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const { session, qa, admin, sleep } = require("./ui-lib.cjs");
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.replace(/^--/, "").split("="); return [m[0], m[1] ?? true]; }));
const label = process.argv[2] || "checks";
const BASE = args.base || "http://localhost:3100";
const only = args.only ? String(args.only).split(",") : ["item", "share", "export", "sell", "home", "exhibition", "regress"];
const OUT = __dirname + "/shots-checks-" + label; fs.mkdirSync(OUT, { recursive: true });
const results = []; let pass = 0, fail = 0;
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); if (ok) pass++; else fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail ?? "").slice(0, 500)); };
const ID = (n) => `qa_ui_${qa.stamp}_${n}`;
const row = async (id) => (await admin.from("vault_items").select("*").eq("id", id).maybeSingle()).data;

// Fails every write to a table while `state.fail` is true (reads and everything else pass through).
async function interceptWrites(S, tableRe) {
  const state = { fail: false, failed: 0 };
  await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/*", requestStage: "Request" }] });
  S.c.on(async (m) => {
    if (m.method !== "Fetch.requestPaused") return;
    const { requestId, request } = m.params;
    try {
      if (state.fail && tableRe.test(request.url) && request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
        state.failed++;
        await S.send("Fetch.fulfillRequest", { requestId, responseCode: 500, responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" }], body: Buffer.from(JSON.stringify({ message: "simulated outage" })).toString("base64") });
      } else await S.send("Fetch.continueRequest", { requestId });
    } catch { /* request gone */ }
  });
  return state;
}

(async () => {
  const batman = ID(1);

  // ================= item page: header, classification, Share, selling tools =================
  if (only.includes("item") || only.includes("share") || only.includes("sell")) {
    const dl = path.join(OUT, "downloads").replace(/\\/g, "/");
    fs.rmSync(dl, { recursive: true, force: true });
    const S = await session(BASE, { width: 1440, height: 900, downloads: dl });
    try {
      await S.go("/vault/item/" + batman);
      await S.waitFor(`/Batman/.test(document.body.innerText)`, 120000, "item page");
      await sleep(1500);

      if (only.includes("item")) {
        // --- one compact Share button, no frame ---
        const bar = await S.evaluate(`(() => { const t = document.querySelector('[role="toolbar"][aria-label^="Actions for this item"]'); const cs = getComputedStyle(t); const share = t.querySelector('button'); const stream = [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Stream'); const r1 = share.getBoundingClientRect(), r2 = stream.getBoundingClientRect(); return { bg: cs.backgroundColor, shadow: cs.boxShadow, border: cs.borderTopWidth, padding: cs.padding, h: Math.round(t.getBoundingClientRect().height), shareH: Math.round(r1.height), streamH: Math.round(r2.height), shareTop: Math.round(r1.top), streamTop: Math.round(r2.top), n: t.querySelectorAll('button').length }; })()`);
        check("[header] the Share control has no frame (transparent, no border, no shadow, no padding)", /rgba\(0, 0, 0, 0\)|transparent/.test(bar.bg) && (bar.shadow === "none" || !bar.shadow) && bar.padding === "0px", bar);
        check("[header] Share is one button, the same height and line as Stream", bar.n === 1 && bar.shareH === bar.streamH && Math.abs(bar.shareTop - bar.streamTop) <= 1, bar);
        const hero = await S.evaluate(`Math.round(document.querySelector('h1').closest('div[class*="rounded-[24px]"]').getBoundingClientRect().height)`);
        console.log("   hero height (item header card):", hero);

        // --- classification consistency ---
        const view = await S.evaluate(`(() => { const rows = {}; for (const r of document.querySelectorAll('section, div')) {} const t = document.body.innerText; const m = /Category\\s*\\n?\\s*([^\\n]+)/.exec(t); return { text: t.slice(0, 2000) }; })()`);
        const summaryCat = await S.evaluate(`(() => { const dts = [...document.querySelectorAll('div')].filter((d) => d.children.length === 2 && /^Category$/.test(d.children[0].textContent.trim())); return dts[0] ? dts[0].children[1].textContent.trim() : null; })()`);
        check("[class] the summary says Comics for the item that only had the stored code", summaryCat === "Comics", summaryCat);
        await S.click('button[aria-label="Edit title and category"]'); await sleep(600);
        const edit = await S.evaluate(`(() => { const sel = (l) => { const s = document.querySelector('select[aria-label="' + l + '"]'); return s ? { value: s.value, shown: s.options[s.selectedIndex]?.text, n: s.options.length, disabled: s.disabled } : null; }; const input = document.querySelector('input[aria-label="Title"]'); const save = document.querySelector('button[aria-label="Save title and classification"]'); const cs = save && getComputedStyle(save); return { universe: sel('Universe'), category: sel('Category'), sub: sel('Subcategory'), inputH: Math.round(input.getBoundingClientRect().height), saveBg: cs && cs.backgroundColor, saveW: Math.round(save.getBoundingClientRect().width), saveH: Math.round(save.getBoundingClientRect().height), titleTop: Math.round(input.getBoundingClientRect().top), descTop: Math.round([...document.querySelectorAll('div,p')].find((e) => /Add a description/.test(e.textContent) && e.children.length === 0)?.getBoundingClientRect().top ?? 0) }; })()`);
        check("[class] Universe, Category and Subcategory are all editable, and the editor says Comics (same as the summary)", edit.universe && edit.category && edit.sub && edit.category.shown === "Comics" && !edit.sub.disabled && edit.sub.n > 3, edit);
        check("[title] the title field is compact (<= 36 px tall)", edit.inputH <= 36, edit.inputH);
        const [r, g, b] = (edit.saveBg.match(/\d+/g) || []).map(Number);
        check("[title] the Save check is green and at least 36 x 36", g > r + 40 && g > b && edit.saveW >= 36 && edit.saveH >= 36, edit);
        await S.shot(OUT + "/item-edit.png", { x: 0, y: 0, width: 1440, height: 420 });

        // empty title -> a visible error, the editor stays open
        await S.evaluate(`(() => { const i = document.querySelector('input[aria-label="Title"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
        await S.click('button[aria-label="Save title and classification"]'); await sleep(700);
        const err = await S.evaluate(`({ alert: document.querySelector('[role="alert"]')?.textContent || '', open: !!document.querySelector('input[aria-label="Title"]') })`);
        check("[title] saving an empty title shows an error and keeps the editor open", /required/i.test(err.alert) && err.open, err);

        // real save: new title, Subcategory = Book. Details/other fields must stay.
        const before = await row(batman);
        await S.evaluate(`(() => { const i = document.querySelector('input[aria-label="Title"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'QA Batman Absolute #1 (edited)'); i.dispatchEvent(new Event('input', { bubbles: true })); const s = document.querySelector('select[aria-label="Subcategory"]'); const sset = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; sset.call(s, 'Book'); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
        await sleep(300);
        await S.click('button[aria-label="Save title and classification"]');
        await S.waitFor(`!document.querySelector('input[aria-label="Title"]')`, 20000, "editor closes after save");
        await sleep(2500);
        const after = await row(batman);
        check("[class] the save wrote the title, the label Comics and the subcategory Book to the account", after && after.title === "QA Batman Absolute #1 (edited)" && after.category_label === "Comics" && after.subcategory_label === "Book" && after.universe === "POP_CULTURE", { title: after?.title, cl: after?.category_label, sub: after?.subcategory_label });
        check("[class] other values are untouched (purchase price, images, status, visibility)", after && after.purchase_price === before.purchase_price && JSON.stringify((after.images_json || []).map((i) => i.url)) === JSON.stringify((before.images_json || []).map((i) => i.url)) && after.status === before.status && after.is_public === before.is_public && JSON.stringify(after.specs) === JSON.stringify(before.specs), { b: before.purchase_price, a: after?.purchase_price });
        const summary2 = await S.evaluate(`(() => { const t = [...document.querySelectorAll('div')].filter((d) => d.children.length === 2); const f = (k) => t.find((d) => d.children[0].textContent.trim() === k)?.children[1].textContent.trim(); return { cat: f('Category'), sub: f('Subcategory'), head: document.querySelector('h1').textContent.trim() }; })()`);
        check("[class] header, summary and subcategory all show the saved classification", summary2.cat === "Comics" && summary2.sub === "Book" && /edited/.test(summary2.head), summary2);
        await admin.from("vault_items").update({ title: "QA Batman Absolute #1" }).eq("id", batman);
      }

      if (only.includes("share")) {
        // reload so the earlier edit does not matter
        await S.go("/vault/item/" + batman);
        await S.waitFor(`/Batman/.test(document.body.innerText)`, 60000);
        await sleep(1500);
        // a stand-in share sheet that records exactly what would be sent
        await S.evaluate(`window.__shared = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__shared = { keys: Object.keys(d), files: (d.files || []).map((f) => [f.name, f.type, f.size]) }; }; true`);
        const writes = await interceptWrites(S, /\/rest\/v1\/vault_items/);
        await S.click('button[aria-label="Share this item"]'); await sleep(800);
        const dlg = await S.evaluate(`(() => { const d = document.querySelector('[role="dialog"][aria-label="Share item"]'); const t = d ? d.innerText : ''; return { has: !!d, photos: /share photos/i.test(t), link: /share public link/i.test(t), prompt: /Turn on public sharing\\?/.test(t), tiles: d ? d.querySelectorAll('.vltd-glass-destination').length : -1, long: /Visibility switch lower on this page/.test(t), thumbs: d ? d.querySelectorAll('[aria-label="Pictures to share"] button').length : 0, h: d ? Math.round(d.getBoundingClientRect().height) : 0 }; })()`);
        check("[share] a private item shows Share photos, and one short question instead of the long explanation", dlg.has && dlg.photos && dlg.link && dlg.prompt && dlg.tiles === 0 && !dlg.long && dlg.thumbs === 2, dlg);
        // Share the selected photo: only files, no link, no text
        await S.click("text:Share 1 photo"); await sleep(1500);
        const shared = await S.evaluate("window.__shared");
        check("[share] Share photos hands the share sheet only the chosen picture (a file, no link, no text)", shared && JSON.stringify(shared.keys) === '["files"]' && shared.files.length === 1 && /^image\//.test(shared.files[0][1]) && shared.files[0][2] > 1000, shared);
        // choose both and download
        await S.evaluate(`(() => { const b = document.querySelectorAll('[aria-label="Pictures to share"] button')[1]; b.click(); return true; })()`); await sleep(300);
        const label2 = await S.evaluate(`!![...document.querySelectorAll('button')].find((b) => /Share 2 photos/.test(b.textContent))`);
        check("[share] picking a second picture updates the button (Share 2 photos)", label2);
        await S.click("text:Download to device"); await sleep(2500);
        // newer Chrome also drops its own downloads.htm listing into the folder: it is not a picture the page saved
        const files = (fs.existsSync(dl) ? fs.readdirSync(dl) : []).filter((f) => f !== "downloads.htm");
        check("[share] Download to device saves the two chosen pictures", files.length === 2 && files.every((f) => /\.(png|jpe?g|webp)$/.test(f)), files);
        const stillPrivate = await row(batman);
        check("[share] sharing pictures did not make the item public", stillPrivate.is_public === false);
        // Not now / Turn it on
        await S.click("text:Not now"); await sleep(300);
        const declined = await S.evaluate(`document.querySelector('[role="dialog"]').innerText`);
        check("[share] Not now leaves it private and says so", /Public sharing is off/.test(declined) && /Turn it on/.test(declined));
        await S.click("text:Turn it on"); await sleep(300);
        // failure: the account refuses the change
        writes.fail = true;
        await S.click("text:Yes"); await sleep(3500);
        const failed = await S.evaluate(`({ alert: document.querySelector('[role="dialog"] [role="alert"]')?.textContent || '', tiles: document.querySelectorAll('.vltd-glass-destination').length, prompt: /Turn on public sharing\\?/.test(document.querySelector('[role="dialog"]').innerText) })`);
        const afterFail = await row(batman);
        check("[share] when the change cannot be saved: an error is shown, no destinations appear, the item stays private (account and screen)", /still private/i.test(failed.alert) && failed.tiles === 0 && failed.prompt && afterFail.is_public === false, { failed, db: afterFail.is_public, blocked: writes.failed });
        await S.shot(OUT + "/share-failure.png");
        // success
        writes.fail = false;
        await S.click("text:Yes");
        await S.waitFor(`document.querySelectorAll('.vltd-glass-destination').length >= 6`, 30000, "destinations after Yes");
        await sleep(1200);
        const ok = await S.evaluate(`({ tiles: document.querySelectorAll('.vltd-glass-destination').length, link: document.querySelector('input[aria-label="Link to this item"]')?.value || '' })`);
        const afterYes = await row(batman);
        check("[share] after Yes is saved: the destinations and the link appear, and the account has the item public", ok.tiles >= 6 && ok.link.endsWith("/share/" + batman) && afterYes.is_public === true, { ok, db: afterYes.is_public });
        await S.shot(OUT + "/share-public.png");
        // put it back to private
        await admin.from("vault_items").update({ is_public: false }).eq("id", batman);
      }
    } finally { await S.close(); }
  }

  // ================= export for social =================
  if (only.includes("export")) {
    const dl = path.join(OUT, "export-downloads").replace(/\\/g, "/");
    fs.rmSync(dl, { recursive: true, force: true });
    const S = await session(BASE, { width: 1440, height: 900, downloads: dl });
    try {
      await S.go("/vault/item/" + batman);
      await S.waitFor(`/Batman/.test(document.body.innerText)`, 120000, "item page");
      await sleep(1500);
      await S.click('button[aria-label="Share this item"]'); await sleep(600);
      await S.click("text:Export for social");
      await S.waitFor(`document.querySelector('img[alt^="Export preview"]')`, 30000, "first preview");
      const specs = { "1:1": [1080, 1080], "4:5": [1080, 1350], "9:16": [1080, 1920], "16:9": [1920, 1080] };
      for (const [ratio, [w, h]] of Object.entries(specs)) {
        await S.evaluate(`window.__gaps = 0; window.__seen = 0; window.__t = setInterval(() => { window.__seen++; if (!document.querySelector('img[alt^="Export preview"]')) window.__gaps++; }, 20); true`);
        await S.click(`text:${ratio.replace(":", ":")}\\s*.*`); await sleep(100);
        await S.waitFor(`(() => { const i = document.querySelector('img[alt^="Export preview"]'); return i && i.alt.includes(${JSON.stringify(ratio)}) && i.naturalWidth === ${w} && i.naturalHeight === ${h}; })()`, 20000, "preview " + ratio);
        const gaps = await S.evaluate(`(() => { clearInterval(window.__t); return { gaps: window.__gaps, seen: window.__seen }; })()`);
        check(`[export ${ratio}] the preview never disappears while it updates, and ends at ${w} x ${h}`, gaps.gaps === 0 && gaps.seen >= 3, gaps);
        const note = await S.evaluate(`document.body.innerText.match(/saved exactly as shown/) ? document.body.innerText.match(/[^\\n]*saved exactly as shown/)[0] : ''`);
        check(`[export ${ratio}] the caption states the format and size`, note.includes(ratio) && note.includes(`${w} × ${h}`), note);
        await S.shot(OUT + `/export-${ratio.replace(":", "x")}.png`);
        // the saved file is the preview
        fs.rmSync(dl, { recursive: true, force: true }); fs.mkdirSync(dl, { recursive: true });
        const previewData = await S.evaluate(`document.querySelector('img[alt^="Export preview"]').src`);
        await S.click("text:Download PNG"); await sleep(1800);
        const f = fs.existsSync(dl) ? fs.readdirSync(dl).filter((x) => x.endsWith(".png")) : [];
        if (f.length === 1) {
          const buf = fs.readFileSync(path.join(dl, f[0]));
          const meta = await sharp(buf).metadata();
          const same = Buffer.compare(buf, Buffer.from(previewData.split(",")[1], "base64")) === 0;
          check(`[export ${ratio}] the downloaded file is ${w} x ${h} and byte-identical to the preview (${f[0]})`, meta.width === w && meta.height === h && same, { meta: [meta.width, meta.height], same });
        } else check(`[export ${ratio}] a PNG was downloaded`, false, f);
      }
      // a drawing failure: message + Try again, the old preview stays visible
      await S.evaluate(`window.__orig = HTMLCanvasElement.prototype.toDataURL; HTMLCanvasElement.prototype.toDataURL = function () { throw new Error('canvas blocked for the test'); }; true`);
      await S.click("text:1:1\\s*.*"); await sleep(1500);
      const errState = await S.evaluate(`({ alert: document.querySelector('[role="alert"]')?.textContent || '', img: !!document.querySelector('img[alt^="Export preview"]'), dl: [...document.querySelectorAll('button')].find((b) => /Download PNG/.test(b.textContent))?.disabled })`);
      check("[export] when drawing fails: a message and Try again are shown, the last preview stays, Download is off", /could not be drawn/i.test(errState.alert) && errState.img && errState.dl === true, errState);
      await S.shot(OUT + "/export-error.png");
      await S.evaluate(`HTMLCanvasElement.prototype.toDataURL = window.__orig; true`);
      await S.click("text:Try again");
      await S.waitFor(`(() => { const i = document.querySelector('img[alt^="Export preview"]'); return i && i.alt.includes('1:1') && i.naturalWidth === 1080; })()`, 20000, "recovered preview");
      check("[export] Try again recovers the preview", true);
      // privacy wording + no publishing
      const priv = await S.evaluate(`document.body.innerText`);
      const dbp = await row(batman);
      check("[export] the sheet says the picture works for a private item, offers the same short question, and publishes nothing", /works as it is, even for a private item/.test(priv) && /Turn on public sharing\\?/.test(priv) && dbp.is_public === false);
    } finally { await S.close(); }
  }

  // ================= cost to sell + listing copy =================
  if (only.includes("sell")) {
    const S = await session(BASE, { width: 1440, height: 900 });
    try {
      const chips = async (id) => {
        await S.go("/vault/item/" + id);
        await S.waitFor(`document.querySelector('section[aria-label="Cost to sell"]')`, 120000, "cost to sell " + id);
        await sleep(600);
        return S.evaluate(`(() => { const s = document.querySelector('section[aria-label="Cost to sell"]'); return { chips: [...s.querySelectorAll('button')].map((b) => b.textContent.trim()), h: Math.round(s.getBoundingClientRect().height), advice: s.innerText.slice(-200) }; })()`);
      };
      const b = await chips(ID(1));
      check("[sell] a comic is offered eBay, Mercari, Whatnot and Custom (not Fanatics Collect, not Discogs)", JSON.stringify(b.chips.filter((c) => !/override/i.test(c))) === JSON.stringify(["eBay", "Mercari", "Whatnot", "Custom"]), b.chips);
      console.log("   Cost to Sell panel height (desktop):", b.h);
      const sp = await chips(ID(2)); check("[sell] a sports card: eBay, Mercari, Whatnot, Fanatics Collect, Custom", JSON.stringify(sp.chips) === JSON.stringify(["eBay", "Mercari", "Whatnot", "Fanatics Collect", "Custom"]), sp.chips);
      const gt = await chips(ID(4)); check("[sell] a guitar: eBay, Mercari, Whatnot, Custom (no Discogs, no Fanatics Collect)", JSON.stringify(gt.chips) === JSON.stringify(["eBay", "Mercari", "Whatnot", "Custom"]), gt.chips);
      const vn = await chips(ID(3)); check("[sell] vinyl: eBay, Mercari, Whatnot, Discogs, Custom (no Fanatics Collect)", JSON.stringify(vn.chips) === JSON.stringify(["eBay", "Mercari", "Whatnot", "Discogs", "Custom"]), vn.chips);
      // calculations (vinyl, Discogs): 100 sale, 5 shipping -> fees 9 + 2.9 + 0.30 = 12.20, net 82.80, gain over $30 cost = 52.80
      await S.evaluate(`(() => { const s = document.querySelector('section[aria-label="Cost to sell"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const [sale, ship] = s.querySelectorAll('input'); set.call(sale, '100'); sale.dispatchEvent(new Event('input', { bubbles: true })); set.call(ship, '5'); ship.dispatchEvent(new Event('input', { bubbles: true })); [...s.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Discogs').click(); return true; })()`);
      await sleep(400);
      const calcDiscogs = await S.evaluate(`document.querySelector('section[aria-label="Cost to sell"]').innerText.replace(/\\s+/g, ' ')`);
      check("[sell] Discogs maths: fees $12.20, net $82.80, gain +$52.80", /Fees \$12\.20/i.test(calcDiscogs) && /Net \$82\.80/i.test(calcDiscogs) && /\+\$52\.80/.test(calcDiscogs), calcDiscogs);
      await S.go("/vault/item/" + ID(1));
      await S.waitFor(`document.querySelector('section[aria-label="Cost to sell"]')`, 60000);
      await S.evaluate(`(() => { const s = document.querySelector('section[aria-label="Cost to sell"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const [sale, ship] = s.querySelectorAll('input'); set.call(sale, '100'); sale.dispatchEvent(new Event('input', { bubbles: true })); set.call(ship, '5'); ship.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      await sleep(400);
      const calcEbay = await S.evaluate(`document.querySelector('section[aria-label="Cost to sell"]').innerText.replace(/\\s+/g, ' ')`);
      check("[sell] eBay maths for a comic: 13.25% + $0.40 = $13.65, net $81.35, gain +$32.35 over the $49 cost", /Fees \$13\.65/i.test(calcEbay) && /Net \$81\.35/i.test(calcEbay) && /\+\$32\.35/.test(calcEbay), calcEbay);
      // the general eBay rate for a guitar: 13.6% + 0.40 on $100 = 14.00
      await S.go("/vault/item/" + ID(4));
      await S.waitFor(`document.querySelector('section[aria-label="Cost to sell"]')`, 60000);
      await S.evaluate(`(() => { const s = document.querySelector('section[aria-label="Cost to sell"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const [sale] = s.querySelectorAll('input'); set.call(sale, '100'); sale.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      await sleep(400);
      const calcGuitar = await S.evaluate(`document.querySelector('section[aria-label="Cost to sell"]').innerText.replace(/\\s+/g, ' ')`);
      check("[sell] eBay general rate for a guitar: 13.6% + $0.40 = $14.00", /Fees \$14\.00/i.test(calcGuitar), calcGuitar);
      // listing copy: compact explanation + the action that unlocks it
      await S.go("/vault/item/" + ID(1));
      await S.waitFor(`/Listing copy/i.test(document.body.innerText)`, 60000);
      const lc = await S.evaluate(`(() => { const e = [...document.querySelectorAll('div')].find((d) => d.children.length === 2 && /^Listing copy$/i.test(d.children[0].textContent.trim())); const box = e && e.parentElement.parentElement; const r = box.getBoundingClientRect(); return { h: Math.round(r.height), text: box.innerText.replace(/\\s+/g, ' '), btn: !![...box.querySelectorAll('button')].find((b) => /Mark for sale to unlock/.test(b.textContent)) }; })()`);
      check("[listing] the locked panel is compact and says what it makes, that nothing is published, and how to unlock it", lc.h <= 110 && /paste-ready/.test(lc.text) && /nothing is listed or published/.test(lc.text) && lc.btn, lc);
      // unlock and use the copy
      await S.click("text:Mark for sale to unlock");
      await S.waitFor(`document.querySelector('textarea[readonly]')`, 30000, "listing textarea");
      await sleep(600);
      const listing = await S.evaluate(`(() => { const ta = document.querySelector('textarea[readonly]'); const chips = [...document.querySelectorAll('button[aria-pressed]')].map((b) => b.textContent.trim()).filter((t) => /^(eBay|Mercari|Facebook|Etsy|Whatnot|Discogs|Fanatics Collect|Icona)$/.test(t)); return { text: ta.value.slice(0, 300), chips }; })()`);
      check("[listing] unlocked: platforms fit the comic (no Fanatics Collect, no Discogs) and the text names the item", /QA Batman/.test(listing.text) && !listing.chips.includes("Fanatics Collect") && !listing.chips.includes("Discogs"), listing);
      await S.evaluate(`navigator.clipboard.writeText = async () => { window.__copied = true; }; true`);
      await S.click("text:Copy Listing"); await sleep(800);
      const copied = await S.evaluate(`({ copied: !!window.__copied, msg: document.body.innerText.match(/listing copied\\./i)?.[0] || '' })`);
      check("[listing] Copy Listing puts the text on the clipboard (nothing is posted)", copied.copied && /copied/i.test(copied.msg), copied);
      await admin.from("vault_items").update({ status: "COLLECTION" }).eq("id", ID(1));
    } finally { await S.close(); }
  }

  // ================= Home =================
  if (only.includes("home")) {
    const S = await session(BASE, { width: 1440, height: 900 });
    try {
      await S.go("/");
      await S.waitFor(`/Your exhibitions/i.test(document.body.innerText) && document.querySelector('[aria-roledescription="carousel"]')`, 120000, "home");
      await sleep(1500);
      const layout = await S.evaluate(`(() => { const hero = document.querySelector('section[aria-label="Collection overview"]'); const h1 = hero.querySelector('h1').getBoundingClientRect(); const add = hero.querySelector('[data-add-item-actions]').getBoundingClientRect(); const hr = hero.getBoundingClientRect(); const basis = [...hero.querySelectorAll('span')].find((s) => /Value basis/.test(s.textContent) && s.children.length === 0).getBoundingClientRect(); const tiles = hero.querySelector('a[href="/portfolio#cost-breakdown"]').getBoundingClientRect(); const ctl = [...hero.querySelectorAll('button')].filter((b) => /Show priced only|Include unpriced|What does this change/.test(b.textContent)).map((b) => { const cs = getComputedStyle(b); const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), bg: cs.backgroundColor, ring: cs.boxShadow, h: Math.round(r.height), top: Math.round(r.top) }; }); const panels = ['/portfolio', '/vault/sold#sales-analytics', '/activity'].map((h) => { const a = hero.querySelector('a[href="' + h + '"][class*="flex-col"][class*="gap-2"]'); const r = a.getBoundingClientRect(); return { h, w: Math.round(r.width), ht: Math.round(r.height), top: Math.round(r.top) }; }); return { heroH: Math.round(hr.height), addTop: Math.round(add.top - hr.top), addRight: Math.round(hr.right - add.right), h1Top: Math.round(h1.top - hr.top), basisTop: Math.round(basis.top), tilesTop: Math.round(tiles.top), ctl, panels, goDeeper: /GO DEEPER/i.test(hero.innerText) }; })()`);
      check("[home] Quick Add / Add Item / Upload sit at the top right of the summary, level with the heading", layout.addTop < 60 && layout.addRight < 40, layout);
      check("[home] the value-basis controls sit above the money tiles as plain text controls (no pill backgrounds)", layout.basisTop < layout.tilesTop && layout.ctl.length === 2 && layout.ctl.every((c) => /rgba\(0, 0, 0, 0\)|transparent/.test(c.bg) && (c.ring === "none" || !c.ring)), layout.ctl);
      check("[home] three summary panels sit under the figures and each is a link to its full page", layout.panels.length === 3 && layout.panels.every((p) => p.w > 250 && p.ht > 100) && !layout.goDeeper, layout.panels);
      console.log("   hero height:", layout.heroH);
      const panelText = await S.evaluate(`[...document.querySelectorAll('section[aria-label="Collection overview"] a')].filter((a) => ['/portfolio','/vault/sold#sales-analytics','/activity'].includes(a.getAttribute('href')) && /flex-col/.test(a.className) && /gap-2/.test(a.className)).map((a) => a.innerText.replace(/\\s+/g, ' '))`);
      check("[home] the panels hold real data: universe counts, sales by month with revenue/profit, recent activity", /Pop Culture/.test(panelText[0]) && /\$240/.test(panelText[1]) && /Added QA/.test(panelText[2]), panelText);
      // toggles still work
      await S.click("text:Show priced only"); await sleep(500);
      const priced = await S.evaluate(`document.querySelector('section[aria-label="Collection overview"]').innerText.replace(/\\s+/g, ' ')`);
      check("[home] Show priced only still switches the basis", /Include unpriced/.test(priced) && /2 of \d+ priced/.test(priced), priced.slice(0, 300));
      await S.click("text:Include unpriced"); await sleep(300);
      await S.click("text:What does this change\\?"); await sleep(300);
      check("[home] What does this change? opens the explanation", await S.evaluate(`!!document.getElementById('home-basis-explainer')`));

      // ---- carousel ----
      const car = async () => S.evaluate(`(() => { const c = document.querySelector('[aria-roledescription="carousel"]'); const cards = [...c.querySelectorAll('a[aria-label^="Open "], button[aria-label^="Show "]')]; const act = c.querySelector('a[aria-current="true"]'); const rects = cards.map((x) => x.getBoundingClientRect()); const cr = c.getBoundingClientRect(); return { cards: cards.length, visible: cards.filter((x, i) => rects[i].width > 20 && rects[i].right > cr.left && rects[i].left < cr.right && getComputedStyle(x).opacity > 0.05).length, active: act ? act.getAttribute('aria-label') : null, title: c.innerText.match(/QA Exhibition \\d/g)?.slice(-1)[0] || '', count: c.innerText.match(/\\d of \\d/)?.[0] || '', width: Math.round(cr.width), prev: !!c.querySelector('button[aria-label="Previous exhibition"]'), next: !!c.querySelector('button[aria-label="Next exhibition"]') }; })()`);
      const c0 = await car();
      check("[carousel] all 4 exhibitions are in the carousel, several visible at once across the card width", c0.cards === 4 && c0.visible >= 3 && c0.width > 900 && c0.prev && c0.next, c0);
      const seen = [c0.count + " " + c0.active];
      for (let i = 0; i < 4; i++) { await S.click('button[aria-label="Next exhibition"]'); await sleep(500); const c = await car(); seen.push(c.count + " " + c.active); }
      check("[carousel] Next reaches every exhibition and wraps around to the first", new Set(seen.map((s) => s.split(" ")[0] + s.split(" ")[1])).size === 4 && seen[0] === seen[4], seen);
      await S.click('button[aria-label="Previous exhibition"]'); await sleep(500);
      const cp = await car(); check("[carousel] Previous goes back (wraps to the last)", /4 of 4/.test(cp.count), cp);
      // keyboard
      await S.evaluate(`document.querySelector('[aria-roledescription="carousel"] [role="group"]').focus(); true`);
      await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await sleep(500);
      const ck = await car(); check("[carousel] the Right arrow key flips to the next exhibition (4 -> 1)", /1 of 4/.test(ck.count), ck);
      await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 }); await sleep(500);
      check("[carousel] the Left arrow key goes back", /4 of 4/.test((await car()).count));
      // click a side card
      const side = await S.evaluate(`(() => { const b = document.querySelector('[aria-roledescription="carousel"] button[aria-label^="Show "]'); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: b.getAttribute('aria-label') }; })()`);
      await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: side.x, y: side.y }); await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: side.x, y: side.y, button: "left", clickCount: 1 }); await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: side.x, y: side.y, button: "left", clickCount: 1 }); await sleep(700);
      const cs = await car(); check("[carousel] clicking a side card brings it to the front (" + side.label + ")", cs.active && side.label.replace(/^Show /, "Open ") === cs.active, { cs, side });
      // drag
      await S.reveal("^your exhibitions$", 600); await sleep(900);
      const pathBefore = await S.evaluate("location.pathname");
      const before = await car();
      const dr = await S.evaluate(`(() => { const r = document.querySelector('[aria-roledescription="carousel"] [role="group"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: dr.x, y: dr.y }); await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: dr.x, y: dr.y, button: "left", clickCount: 1 });
      for (let i = 1; i <= 8; i++) { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: dr.x - i * 20, y: dr.y, buttons: 1 }); await sleep(30); }
      await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: dr.x - 160, y: dr.y, button: "left", clickCount: 1 }); await sleep(700);
      const after = await car(); check("[carousel] dragging left moves to another exhibition (and does not open one)", after.count !== before.count && (await S.evaluate("location.pathname")) === pathBefore, { before: before.count, after: after.count });
      // header: Create exhibition at the right, arrow link
      const head = await S.evaluate(`(() => { const sec = [...document.querySelectorAll('section')].find((s) => /^Your exhibitions/i.test(s.innerText.trim())); const hdr = sec.firstElementChild; const create = [...hdr.querySelectorAll('a')].find((a) => /Create exhibition/.test(a.textContent)); const all = [...hdr.querySelectorAll('a')].find((a) => /All exhibitions/.test(a.textContent)); return { createRight: Math.round(hdr.getBoundingClientRect().right - create.getBoundingClientRect().right), createHref: create.getAttribute('href'), allHref: all.getAttribute('href'), allLabel: all.getAttribute('aria-label'), allText: all.textContent.trim(), viewAll: /View all/.test(hdr.innerText) }; })()`);
      check("[carousel] Create exhibition is at the right of the header (where View all was); a labelled arrow link opens all exhibitions", head.createRight < 30 && head.createHref === "/museum/new" && head.allHref === "/museum" && /All exhibitions/.test(head.allText) && head.allText.includes("→") && !head.viewAll, head);
      await S.reveal("^your exhibitions$", 600); await sleep(1200);
      await S.shot(OUT + "/home-carousel.png");

    } finally { await S.close(); }

    // one and zero exhibitions, each in a fresh browser
    {
      const gids = (await admin.from("galleries").select("id").eq("profile_id", qa.profileId)).data.map((g) => g.id);
      const saved = (await admin.from("galleries").select("*").in("id", gids)).data;
      try {
        await admin.from("galleries").delete().in("id", gids.slice(1));
        const O = await session(BASE, { width: 1440, height: 900 });
        try {
          await O.go("/"); await O.waitFor(`document.querySelector('[aria-roledescription="carousel"]')`, 120000, "carousel with one"); await sleep(1500);
          const one = await O.evaluate(`(() => { const c = document.querySelector('[aria-roledescription="carousel"]'); return { cards: c.querySelectorAll('a[aria-label^="Open "], button[aria-label^="Show "]').length, prev: !!c.querySelector('button[aria-label="Previous exhibition"]'), next: !!c.querySelector('button[aria-label="Next exhibition"]'), text: c.innerText.replace(/\\s+/g, ' ') }; })()`);
          check("[carousel] one exhibition: the card is shown, no arrows, no counter", one.cards === 1 && !one.prev && !one.next && !/ of /.test(one.text), one);
          await O.reveal("^your exhibitions$", 600); await sleep(800); await O.shot(OUT + "/home-carousel-one.png");
        } finally { await O.close(); }
        await admin.from("galleries").delete().in("id", gids);
        const Z = await session(BASE, { width: 1440, height: 900 });
        try {
          await Z.go("/"); await Z.waitFor(`/Your exhibitions/i.test(document.body.innerText) && /Welcome back/i.test(document.body.innerText)`, 120000); await sleep(3000);
          const zero = await Z.evaluate(`(() => { const sec = [...document.querySelectorAll('section')].find((s) => /^Your exhibitions/i.test(s.innerText.trim())); return { text: sec.innerText.replace(/\\s+/g, ' '), carousel: !!document.querySelector('[aria-roledescription="carousel"]') }; })()`);
          check("[carousel] zero exhibitions: a plain empty line, Create exhibition still in the header, no carousel", /No exhibitions yet/.test(zero.text) && /Create exhibition/.test(zero.text) && !zero.carousel, zero);
          await Z.reveal("^your exhibitions$", 600); await sleep(800); await Z.shot(OUT + "/home-carousel-zero.png");
        } finally { await Z.close(); }
      } finally {
        await admin.from("galleries").delete().in("id", gids);
        await admin.from("galleries").insert(saved);
      }
    }

    // phone width
    const P = await session(BASE, { width: 390, height: 844, mobile: true });
    try {
      await P.go("/"); await P.waitFor(`document.querySelector('[aria-roledescription="carousel"]')`, 120000, "home phone"); await sleep(2000);
      const ph = await P.evaluate(`(() => { const c = document.querySelector('[aria-roledescription="carousel"]'); const arrows = [...c.querySelectorAll('button[aria-label$="exhibition"]')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }); return { overflow: document.documentElement.scrollWidth - innerWidth, bodyOverflow: document.body.scrollWidth - innerWidth, arrows, w: Math.round(c.getBoundingClientRect().width) }; })()`);
      check("[phone 390] no sideways page scroll; carousel arrows are at least 44 px", ph.overflow <= 0 && ph.arrows.length === 2 && ph.arrows.every(([w, h]) => w >= 44 && h >= 44), ph);
      await P.reveal("^your exhibitions$", 300); await sleep(800); await P.shot(OUT + "/phone-home-carousel.png");
      await P.go("/vault/item/" + batman); await P.waitFor(`/Batman/.test(document.body.innerText)`, 120000); await sleep(1500);
      await P.click('button[aria-label="Share this item"]'); await sleep(800);
      const pd = await P.evaluate(`(() => { const d = document.querySelector('[role="dialog"]'); const r = d.getBoundingClientRect(); return { w: Math.round(r.width), vw: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth, btnH: [...d.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height)).filter((h) => h > 0).sort((a, b) => a - b)[0] }; })()`);
      check("[phone 390] the Share panel fits the screen with 44 px controls", pd.w <= pd.vw && pd.overflow <= 0 && pd.btnH >= 44, pd);
      await P.shot(OUT + "/phone-share.png");
    } finally { await P.close(); }
  }

  // ================= exhibition Share =================
  if (only.includes("exhibition")) {
    const gid = qa.galleryIds ? qa.galleryIds[0] : null;
    await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", gid);
    const S = await session(BASE, { width: 1440, height: 900 });
    try {
      await S.go("/museum/" + gid);
      await S.waitFor(`document.querySelector('button[aria-label="Share this exhibition"]')`, 120000, "exhibition page"); await sleep(1500);
      await S.evaluate(`window.__shared = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__shared = { keys: Object.keys(d), n: (d.files || []).length }; }; true`);
      const writes = await interceptWrites(S, /\/rest\/v1\/galleries/);
      await S.click('button[aria-label="Share this exhibition"]'); await sleep(900);
      await S.waitFor(`(() => { const dl = document.querySelector('[role="dialog"][aria-label="Share exhibition"]'); return dl && dl.querySelectorAll('[aria-label="Pictures to share"] button').length >= 1; })()`, 15000, "exhibition photos").catch(() => {});
      const d = await S.evaluate(`(() => { const dl = document.querySelector('[role="dialog"][aria-label="Share exhibition"]'); const t = dl.innerText; return { photos: /share photos/i.test(t), prompt: /Turn on public sharing\\?/.test(t), tiles: dl.querySelectorAll('.vltd-glass-destination').length, thumbs: dl.querySelectorAll('[aria-label="Pictures to share"] button').length, hasExport: /Export for social/.test(t) }; })()`);
      check("[exhibition] same panel as an item: Share photos (cover + item photos) and the one short question for a private exhibition", d.photos && d.prompt && d.tiles === 0 && d.thumbs >= 1, d);
      await S.shot(OUT + "/exhibition-share-private.png");
      writes.fail = true; await S.click("text:Yes"); await sleep(4500);
      const f = await S.evaluate(`({ alert: document.querySelector('[role="dialog"] [role="alert"]')?.textContent || '', tiles: document.querySelectorAll('.vltd-glass-destination').length })`);
      const dbf = (await admin.from("galleries").select("visibility").eq("id", gid).maybeSingle()).data;
      check("[exhibition] when the change cannot be saved: an error is shown, nothing appears, the exhibition stays private", /could not be saved|still private/i.test(f.alert) && f.tiles === 0 && dbf.visibility === "LOCKED", { f, db: dbf, blocked: writes.failed });
      await S.shot(OUT + "/exhibition-share-failure.png");
      writes.fail = false;
      await sleep(16000); // the page may retry its own save: it must not publish anything
      const dbr = (await admin.from("galleries").select("visibility").eq("id", gid).maybeSingle()).data;
      check("[exhibition] after the failure and the page's own retries it is still private in the account", dbr.visibility === "LOCKED", dbr);
      await S.click("text:Yes").catch(() => {});
      await S.waitFor(`document.querySelectorAll('.vltd-glass-destination').length >= 6`, 40000, "destinations").catch(() => {});
      await sleep(2500);
      const ok = await S.evaluate(`({ tiles: document.querySelectorAll('.vltd-glass-destination').length, link: document.querySelector('input[aria-label="Link to this exhibition"]')?.value || '' })`);
      const dbs = (await admin.from("galleries").select("visibility,layout").eq("id", gid).maybeSingle()).data;
      check("[exhibition] after Yes is saved: link and destinations appear; the account has Guest View (anyone with the link), not the public listing", ok.tiles >= 6 && /\/museum\/share\//.test(ok.link) && dbs.visibility === "INVITE", { ok, db: dbs.visibility });
      await S.shot(OUT + "/exhibition-share-public.png");
    } finally { await S.close(); }
  }


  // ================= the visibility eye still works (it now shares its code with the Share panel); light themes =================
  if (only.includes("regress")) {
    const S = await session(BASE, { width: 1440, height: 900 });
    try {
      const vinyl = ID(5);
      await S.go("/vault/item/" + vinyl);
      await S.waitFor(`document.querySelector('button[aria-label="Make item public"]')`, 120000, "visibility eye"); await sleep(800);
      await S.click('button[aria-label="Make item public"]');
      await S.waitFor(`document.querySelector('button[aria-label="Make item private"]')`, 20000, "eye turns public");
      await sleep(2500);
      const pubRow = await row(vinyl);
      check("[eye] Make public: the screen changes at once and the account has it", pubRow.is_public === true, pubRow.is_public);
      await S.click('button[aria-label="Make item private"]');
      await S.waitFor(`document.querySelector('button[aria-label="Make item public"]')`, 20000, "eye turns private");
      await sleep(2500);
      const privRow = await row(vinyl);
      check("[eye] Make private: back to private in the account", privRow.is_public === false, privRow.is_public);
      // with the account refusing the change, the eye goes back and says why
      const writes = await interceptWrites(S, /\/rest\/v1\/vault_items/);
      writes.fail = true;
      await S.click('button[aria-label="Make item public"]'); await sleep(3500);
      const back = await S.evaluate(`({ eye: !!document.querySelector('button[aria-label="Make item public"]'), msg: document.body.innerText.includes('simulated outage') || /could not|failed|Visibility/i.test(document.body.innerText.slice(0, 20000)) })`);
      const stillRow = await row(vinyl);
      check("[eye] when the account refuses, the eye goes back to private and the account is unchanged", back.eye && stillRow.is_public === false, { back, db: stillRow.is_public });
      writes.fail = false;
    } finally { await S.close(); }
    for (const theme of ["steel-light", "pearl-light"]) {
      const L = await session(BASE, { width: 1440, height: 900, theme });
      try {
        await L.go("/"); await L.waitFor(`/Welcome back/i.test(document.body.innerText) && document.querySelector('[aria-roledescription="carousel"]')`, 120000, "home " + theme); await sleep(2500);
        await L.shot(OUT + "/" + theme + "-home-top.png");
        await L.reveal("^your exhibitions$", 600); await sleep(1000); await L.shot(OUT + "/" + theme + "-home-carousel.png");
        await L.go("/vault/item/" + batman); await L.waitFor(`/Batman/.test(document.body.innerText)`, 120000); await sleep(1500);
        await L.shot(OUT + "/" + theme + "-item-header.png", { x: 0, y: 0, width: 1440, height: 420 });
        await L.click('button[aria-label="Share this item"]'); await sleep(900); await L.shot(OUT + "/" + theme + "-share.png");
        await L.click("text:Export for social"); await sleep(2500); await L.shot(OUT + "/" + theme + "-export.png");
        const ov = await L.evaluate("document.documentElement.scrollWidth - innerWidth");
        check("[" + theme + "] no sideways page scroll", ov <= 0, ov);
      } finally { await L.close(); }
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  fs.writeFileSync(OUT + "/results.json", JSON.stringify(results, null, 1));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("CHECKS ERROR", e.message || e); process.exit(2); });
