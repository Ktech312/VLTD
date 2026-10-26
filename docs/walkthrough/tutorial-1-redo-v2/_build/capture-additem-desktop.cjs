// Chapter 2, desktop: Add Item (/capture). Run with AUDIT_MANIFEST=<qa manifest>.
const { start, byText, btn, css, ASSETS, T } = require("./lib.cjs");
const { admin } = T;
const sleep = T.sleep;
const clickLastBtn = (t) => `[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === ${JSON.stringify(t)} && b.getBoundingClientRect().width > 0).pop()`;
const secBtn = (n) => `[...document.querySelectorAll('button')].find((x) => x.innerText.split('\\n')[0].trim() === ${JSON.stringify(String(n))} && x.getBoundingClientRect().width > 300)`;
const selects = `[...document.querySelectorAll('select')].filter((s) => s.getBoundingClientRect().width > 0)`;
const nameInput = `document.querySelector("input[placeholder='Item name']")`;
const row = async (P, like) => (await admin.from("vault_items").select("*").eq("profile_id", P).ilike("title", like)).data || [];

(async () => {
  const R = await start({ scene: "a-desktop" });
  const { S, m } = R; const P = m.personalId;
  try {
    await R.goto("/dashboard");
    await R.shot("home-add-item", {
      title: "Open Add Item", marks: [btn("ADD ITEM")],
      caption: "On Home or in your Vault, press ADD ITEM (top right of the card).",
      verify: async () => R.js(`(() => { const i = [...document.querySelectorAll('a')].find((x) => /^ADD ITEM/.test(x.innerText.trim())); return i && i.getAttribute('href'); })()`).then((h) => h === "/capture" ? h : { ok: false, h }),
    });
    await R.click("ADD ITEM.*", 3500);
    await R.shot("form-overview", {
      title: "The Add Item form", marks: [nameInput, `[...document.querySelectorAll('button')].find((b) => /^Take photo$/.test(b.innerText.trim()))`, btn("Save to Vault")],
      caption: "Photo on the left. Details on the right in five numbered sections. Only Item name has a star: it is the only required field.",
      verify: async () => { const t = await R.text(); const p = await S.path(); return { ok: p === "/capture" && /NEW VAULT ITEM/.test(t) && /ITEM NAME \*/.test(t) && /1 IDENTITY/.test(t) && /5 DOCUMENTS/.test(t), p }; },
    });
    // the Save button with nothing filled in: required name
    await R.clickExpr(btn("Save to Vault"), 1500);
    await R.shot("name-required", {
      title: "Save needs an Item name", marks: [nameInput],
      caption: "If you press Save to Vault with no name, nothing is saved and the cursor jumps back to Item name. Type a name and try again.",
      verify: async () => { const rows = (await admin.from("vault_items").select("id").eq("profile_id", P)).data || []; const t = await R.text(); return { ok: rows.length === 0, rows: rows.length, hint: /name/i.test(t) }; },
    });

    // photo: Take photo (test camera), accept with Save
    await R.click("Take photo", 3500);
    await R.waitFeed("toy-figure");
    await R.shot("camera-dialog", {
      title: "Take a photo", marks: [btn("Capture photo")],
      caption: "Take photo opens the camera. Line the item up inside the corner brackets and press the round button.",
      simulated: "The viewfinder shows a test camera playing a synthetic, fictional toy picture. The browser's own camera permission prompt cannot be captured.",
      verify: async () => R.js(`!!document.querySelector("button[aria-label=\\"Capture photo\\"]")`).then((v) => v || { ok: false }),
    });
    await R.click("Capture photo", 3500);
    await R.shot("crop-editor", {
      title: "Keep the photo or retake it", marks: [btn("↩ Retake"), clickLastBtn("Save"), btn("Fine Tune")],
      caption: "Save keeps the photo. Retake throws it away and returns to the camera. Fine Tune lets you adjust it first. Drag the corners to crop.",
      simulated: "Test camera picture.",
      roi: "lower-middle",
      verify: async () => { const t = await R.text(); return /Retake/.test(t) && /Fine Tune/.test(t); },
    });
    await R.clickExpr(clickLastBtn("Save"), 4000);
    await R.shot("photo-added", {
      title: "The photo is on your item", marks: [`[...document.querySelectorAll('span,div')].find((e) => e.children.length === 0 && /^Cover$/i.test(e.innerText.trim()) && e.getBoundingClientRect().width > 0)`, btn("Retake")],
      caption: "The photo appears as the Cover. Retake replaces it. If your account has AI you also see an Identify with AI button here; this account does not, and typing the details yourself always works.",
      verify: async () => { const t = await R.text(); return /Cover/i.test(t) && !/Identify with AI|AI scans? left/i.test(t) ? true : { ok: false, t: t.slice(0, 200) }; },
    });

    // identity
    await R.type(nameInput, "Retro Robots Series 2 Action Figure (boxed)");
    await R.type(`document.querySelector("input[placeholder^='e.g. Nintendo']")`, "Retro Robots");
    await R.type(`document.querySelector("input[placeholder^='e.g. 1986']")`, "Series 2");
    await R.shot("name-and-optional", {
      title: "Name it (required) and add what you know", marks: [nameInput, `document.querySelector("input[placeholder^='e.g. Nintendo']")`, `document.querySelector("input[placeholder^='e.g. 1986']")`],
      caption: "Type the Item name. Brand and Set / Series are optional but make the item easier to find later.",
      verify: async () => R.js(`[document.querySelector("input[placeholder='Item name']").value, document.querySelector("input[placeholder^='e.g. Nintendo']").value, document.querySelector("input[placeholder^='e.g. 1986']").value]`).then((v) => v.every(Boolean) ? v : { ok: false, v }),
    });

    // category
    await R.clickExpr(secBtn(2), 1200);
    await R.js(`(${selects})[0].scrollIntoView({ block: 'center' })`);
    const setSel = async (i, text) => R.js(`(() => { const s = (${selects})[${i}]; const o = [...s.options].find((x) => x.text.trim() === ${JSON.stringify(text)}); if (!o) return 'no option ' + ${JSON.stringify(text)} + ' in ' + [...s.options].map((x) => x.text.trim()).join('|'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
    const universeSel = await R.js(`(() => { const ss = ${selects}; return ss.findIndex((s) => [...s.options].some((o) => /Pop Culture/.test(o.text))); })()`);
    console.log("universe select idx", universeSel, await setSel(universeSel, "Pop Culture")); await sleep(900);
    const catOpts = await R.js(`[...(${selects})[${universeSel + 1}].options].map((o) => o.text.trim())`);
    console.log("category options:", catOpts.join(" | "));
    R.catOpts = catOpts;
    const pick = catOpts.find((o) => /toy|figure|collectible/i.test(o)) || catOpts[1];
    console.log("category pick:", pick, await setSel(universeSel + 1, pick)); await sleep(900);
    const subOpts = await R.js(`[...(${selects})[${universeSel + 2}].options].map((o) => o.text.trim())`);
    console.log("subcategory options:", subOpts.join(" | "));
    const subPick = subOpts.find((o) => /action|figure|robot/i.test(o)) || subOpts[1];
    if (subPick) console.log("sub pick:", subPick, await setSel(universeSel + 2, subPick));
    await sleep(700);
    await R.shot("category", {
      title: "Choose Universe, Category and Subcategory", marks: [`(${selects})[${universeSel}]`, `(${selects})[${universeSel + 1}]`, `(${selects})[${universeSel + 2}]`],
      caption: `Open section 2, Category. Pick a Universe first (here Pop Culture), then the Category (${pick}) and, if one fits, a Subcategory. They are optional, and each list narrows to match the one before it.`,
      verify: async () => R.js(`[...(${selects})].slice(${universeSel}, ${universeSel + 3}).map((s) => s.options[s.selectedIndex].text.trim())`).then((v) => (v[0] === "Pop Culture" && v[1] === pick) ? v : { ok: false, v }),
    });

    // value
    await R.clickExpr(secBtn(4), 1200);
    await R.type(`document.querySelector("#capture-purchase-price")`, "38.00");
    await R.js(`document.querySelector("#capture-purchase-price").scrollIntoView({ block: 'center' })`);
    await R.shot("value-purchase-price", {
      title: "Purchase price is separate from value", marks: [`document.querySelector("#capture-purchase-price")`, `document.querySelector("#capture-current-value")`],
      caption: "Purchase price is what you paid. Current value is what you think it is worth now. Leave either one empty if you do not know it: empty means unknown, not zero.",
      verify: async () => R.js(`[document.querySelector("#capture-purchase-price").value, document.querySelector("#capture-current-value").value]`).then((v) => (v[0] === "38.00" && v[1] === "") ? v : { ok: false, v }),
    });

    // save
    await R.clickExpr(btn("Save to Vault"), 6000);
    const afterPath = await S.path();
    console.log("after save path:", afterPath);
    await R.shot("saved", {
      title: "Saved", marks: [],
      caption: "A short message confirms the save. The form clears and you can add another item, or go to your Vault.",
      verify: async () => { const r = await row(P, "Retro Robots%"); return { ok: r.length === 1 && r[0].purchase_price === 38 && r[0].current_value === null && !!r[0].image_front_url, path: afterPath, rows: r.map((x) => ({ pp: x.purchase_price, cv: x.current_value, img: !!x.image_front_url, u: x.universe, c: x.category, b: x.brand })) }; },
    });
    // back in the Vault: the item is there, counted at its purchase cost
    await R.js(`(() => { const e = [...document.querySelectorAll('a,[role=button],article,div')].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 80 && r.width < 700 && r.height > 80 && r.height < 700 && /Retro Robots/i.test(x.innerText || '') || false; }).sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0]; if (e) e.scrollIntoView({ block: 'center' }); return !!e; })()`);
    await R.js("window.scrollTo(0, 0)");
    await R.shot("vault-after-save", {
      title: "Saved: you land in your Vault", marks: [`(() => { const b = [...document.querySelectorAll('button')].find((x) => /Show priced only/.test(x.innerText)); let e = b; for (let i = 0; i < 8 && e; i++) { e = e.parentElement; if (e) { const r = e.getBoundingClientRect(); if (r.width > 250 && r.width < 560 && r.height > 150) return e; } } return null; })()`],
      caption: "A short message confirms the save and you are taken to your Vault. Total value shows $38: the item has no valuation, so it counts at what you paid, and the card says so (1 of 1 at purchase cost).",
      verify: async () => { const r = await row(P, "Retro Robots%"); const t = await R.text(); return { ok: r[0].current_value === null && /at purchase cost/.test(t) && /\$38/.test(t), cv: r[0].current_value }; },
    });
    await R.click(".*Retro Robots.*", 4000);
    await R.shot("item-saved", {
      title: "Open it and check", marks: [`[...document.querySelectorAll('h1,h2')].find((e) => /Retro Robots/.test(e.innerText) && e.getBoundingClientRect().width > 50)`, `[...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 250)[0]`],
      caption: "Open the item. The photo and the details you typed are all there.",
      verify: async () => { const t = await R.text(); const p = await S.path(); return { ok: /\/vault\/item\//.test(p) && /Retro Robots Series 2/.test(t) && /Toys & Figures/.test(t), p }; },
    });
    const scrollTo = async (re) => R.js(`(() => { const e = [...document.querySelectorAll('h2,h3,div,p,span')].find((x) => x.children.length === 0 && new RegExp(${JSON.stringify(re)}).test(x.innerText.trim())); if (e) e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -140); return !!e; })()`);
    await scrollTo("^PURCHASE$");
    const purchasePanel = `[...document.querySelectorAll('div,section')].filter((e) => /^PURCHASE\\s*[\\r\\n]/i.test((e.innerText || '').trim()) && /Tax/.test(e.innerText || '') && e.getBoundingClientRect().width > 300 && e.getBoundingClientRect().width < 900).sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0]`;
    const editPurchase = `document.querySelector('button[aria-label="Edit purchase"]')`;
    await R.shot("item-purchase-panel", {
      title: "Purchase details live on the item", marks: [editPurchase],
      caption: "Extra costs are not on the Add Item form. Open the item and press the pencil on the Purchase panel (Edit purchase) to add Tax, Shipping and Fees.",
      verify: async () => R.js(`!!document.querySelector('button[aria-label="Edit purchase"]')`).then((v) => v || { ok: false }),
    });
    await R.click("Edit purchase", 1500);
    const aria = (l) => `document.querySelector('input[aria-label="${l}"]')`;
    await R.type(aria("Tax"), "3.50");
    await R.type(aria("Shipping"), "4.25");
    await R.type(aria("Fees"), "0");
    await R.shot("purchase-editor", {
      title: "Add the extra costs", marks: [aria("Purchase price"), aria("Tax"), aria("Shipping"), aria("Fees")],
      caption: "Purchase price is already filled in. Add Tax and Shipping. For Fees we typed 0 on purpose: there were none. 0 is a real answer, while an empty box means unknown.",
      verify: async () => R.js(`["Purchase price","Tax","Shipping","Fees","Source"].map((l) => document.querySelector('input[aria-label="' + l + '"]').value)`).then((v) => (v[0] === "38" && v[1] === "3.50" && v[2] === "4.25" && v[3] === "0" && v[4] === "") ? v : { ok: false, v }),
    });
    // confirm with the check mark above the Purchase panel
    const purchaseCheck = `(() => { const p = document.querySelector('input[aria-label="Purchase price"]'); let e = p; for (let i = 0; i < 8 && e; i++) { e = e.parentElement; const b = e && [...e.querySelectorAll('button')].find((x) => x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().width < 70 && x.getBoundingClientRect().top < p.getBoundingClientRect().top); if (b) return b; } return null; })()`;
    await R.clickExpr(purchaseCheck, 2500);
    await R.shot("purchase-saved", {
      title: "Extra costs saved", marks: [purchasePanel],
      caption: "Press the check mark to save. Tax, Shipping and Fees are listed separately from the purchase price and shown to the cent: $3.50, $4.25 and $0.00. Fees shows $0.00, which is different from the dashes left on Source and Order #.",
      verify: async () => { const flat = (await R.text()).replace(/\n/g, " "); const shown = /Tax\s*\$3\.50/.test(flat) && /Shipping\s*\$4\.25/.test(flat) && /Fees\s*\$0\.00/.test(flat) && /Purchase price\s*\$38\.00/.test(flat); const r = (await row(P, "Retro Robots%"))[0]; return { ok: shown && r.purchase_price === 38 && r.purchase_tax === 3.5 && r.purchase_shipping === 4.25 && r.purchase_fees === 0 && r.current_value === null && (r.purchase_source ?? null) === null, pp: r.purchase_price, tax: r.purchase_tax, ship: r.purchase_shipping, fees: r.purchase_fees, cv: r.current_value, src: r.purchase_source ?? null }; },
    });
    await R.js("window.scrollTo(0, 0)");
    await R.shot("item-cost-basis", {
      title: "Cost and value stay separate", marks: [byText("Cost basis\\s*[$]45[.]75")],
      caption: "The cost basis adds the extras exactly: 38.00 + 3.50 + 4.25 + 0 = $45.75. The item still has no valuation: nothing was invented for the value.",
      verify: async () => { const t = await R.text(); return { ok: /Total cost/i.test(t), cost: (t.match(/Total cost[^A-Za-z]{0,6}\$[0-9.,]+/i) || [""])[0] }; },
    });
    // persistence: reload the page and read it back
    await S.send("Page.reload"); await sleep(5000);
    await scrollTo("^PURCHASE$");
    await R.shot("persisted-after-reload", {
      title: "Reload and check it stuck", marks: [purchasePanel],
      caption: "Reload the page, or come back tomorrow: the photo, name, category and costs are exactly as you left them.",
      verify: async () => { const t = await R.text(); const r = (await row(P, "Retro Robots%"))[0]; return { ok: /Retro Robots Series 2/.test(t) && !!r.image_front_url && r.purchase_tax === 3.5, img: !!r.image_front_url }; },
    });

    // ---- second item: Upload from the device, and an explicit zero price ----
    await R.goto("/capture");
    const up = await T.chooseViaButton(S, T.btnExpr("Upload"), [`${ASSETS}/comic-cover.jpg`]);
    console.log("chooser:", JSON.stringify(up)); await sleep(3500);
    await R.shot("upload-added", {
      title: "Or upload a photo you already have", marks: [btn("Retake"), `document.querySelector('[aria-label="Remove photo"]')`],
      caption: "Upload opens your device's file picker (your photo library on a phone). The photo goes straight on as the Cover, with no crop step. Retake replaces it; the small x on the thumbnail removes it.",
      simulated: "The uploaded file is a synthetic, fictional comic cover.",
      verify: async () => ({ ok: !!up.dialog && /Cover/.test(await R.text()), up }),
    });
    await R.type(nameInput, "Midnight Courier #1 Cover A (gift)");
    await R.clickExpr(secBtn(2), 1200);
    const uIdx2 = await R.js(`(() => { const ss = ${selects}; return ss.findIndex((s) => [...s.options].some((o) => /Pop Culture/.test(o.text))); })()`);
    await R.js(`(${selects})[${uIdx2}].scrollIntoView({ block: 'center' })`);
    console.log("2nd item category:", await setSel(uIdx2 + 1, "Comics")); await sleep(900);
    await R.shot("category-remembered", {
      title: "The form remembers your last category", marks: [`(${selects})[${uIdx2}]`, `(${selects})[${uIdx2 + 1}]`],
      caption: "Heads up: the form keeps the Universe and Category from your last item to save you time. Change them whenever the new item is different, as we did here for a comic.",
      verify: async () => R.js(`[...(${selects})].slice(${uIdx2}, ${uIdx2 + 2}).map((s) => s.options[s.selectedIndex].text.trim())`).then((v) => (v[0] === "Pop Culture" && v[1] === "Comics") ? v : { ok: false, v }),
    });
    await R.clickExpr(secBtn(4), 1200);
    await R.type(`document.querySelector("#capture-purchase-price")`, "0");
    await R.js(`document.querySelector("#capture-purchase-price").scrollIntoView({ block: 'center' })`);
    await R.shot("zero-price", {
      title: "A gift: type 0, not nothing", marks: [`document.querySelector("#capture-purchase-price")`],
      caption: "If an item cost you nothing, such as a gift, type 0 in Purchase price. Leaving the box empty would mean you do not know what it cost.",
      verify: async () => R.js(`document.querySelector("#capture-purchase-price").value`).then((v) => v === "0" ? v : { ok: false, v }),
    });
    await R.clickExpr(btn("Save to Vault"), 6000);
    await R.js(`(() => { const e = [...document.querySelectorAll('a,[role=button],article,div')].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 80 && r.width < 700 && r.height > 80 && r.height < 700 && /Midnight Courier/i.test(x.innerText || ''); }).sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0]; if (e) e.scrollIntoView({ block: 'center' }); return !!e; })()`);
    await R.click(".*Midnight Courier.*", 4000);
    await scrollTo("^PURCHASE$");
    await R.shot("zero-vs-blank", {
      title: "Zero stays zero, blank stays unknown", marks: [purchasePanel],
      caption: "On the gift item, Purchase price shows $0.00 (you said it was free). The other costs stay as dashes, because they were never entered.",
      verify: async () => { const a = (await row(P, "Midnight Courier%"))[0]; const b = (await row(P, "Retro Robots%"))[0]; return { ok: a.purchase_price === 0 && a.current_value === null && a.purchase_tax === null && b.purchase_price === 38, giftPrice: a.purchase_price, giftValue: a.current_value, giftTax: a.purchase_tax }; },
    });
  } catch (e) { console.log("SCRIPT ERROR:", e.message); await R.shot("zz-error", { title: "error" }).catch(() => {}); }
  finally { await R.close(); process.exit(0); }
})();
