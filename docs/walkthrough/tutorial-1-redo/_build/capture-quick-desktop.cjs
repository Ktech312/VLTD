// Chapter 1, desktop: Quick Add. Run with AUDIT_MANIFEST=<qa manifest>. Writes screenshots + manifest.json into the work folder.
const { start, byText, btn, css, T } = require("./lib.cjs");
const { admin } = T;
const sleep = T.sleep;
const clickLastExpr = (t) => `[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === ${JSON.stringify(t)} && b.getBoundingClientRect().width > 0).pop()`;

(async () => {
  const R = await start({ scene: "q-desktop" });
  const { S, m } = R;
  const P = m.personalId;
  try {
    // 1. Home
    await R.goto("/dashboard");
    await R.shot("home-entry-points", {
      title: "Start on Home", marks: [btn("Quick Add"), btn("ADD ITEM")],
      caption: "On Home, the Quick Add and ADD ITEM buttons sit side by side in the top card.",
      verify: async () => R.js(`(() => { const a = [...document.querySelectorAll('a')]; const q = a.find((x) => /^Quick Add$/.test(x.innerText.trim())); const i = a.find((x) => /^ADD ITEM/.test(x.innerText.trim())); return { quick: q && q.getAttribute('href'), add: i && i.getAttribute('href') }; })()`).then((v) => (v.quick === "/vault/quick" && v.add === "/capture") ? v : { ok: false, ...v }),
    });
    // 2. Vault
    await R.goto("/vault");
    await R.shot("vault-entry-points", {
      title: "The same buttons are in your Vault", marks: [btn("Quick Add"), btn("ADD ITEM")],
      caption: "In the Vault they are at the top right. A new Vault also shows Quick Add and Add manually in the middle.",
      verify: async () => (await R.has("Quick Add")) && (await R.has("Add manually")) && (await R.has("Scan your first item")),
    });
    // 3. open Quick Add (real click)
    await R.click("Quick Add", 3500);
    await R.shot("quick-add-open", {
      title: "Quick Add opens the camera", marks: [btn("Take picture"), btn("Finished.*"), btn("Universe"), btn("Category")],
      caption: "Quick Add is a full-screen camera. Take as many photos as you like, then press Finished.",
      simulated: "The picture in the viewfinder comes from a test camera that plays a synthetic, fictional card picture. The real camera permission prompt is drawn by the browser and cannot be captured.",
      verify: async () => { const p = await S.path(); const v = await R.feedNow(); return p === "/vault/quick" && !!v ? { path: p, feed: v.best } : { ok: false, p, v }; },
    });
    // 4. choose a Universe and Category before shooting
    await R.click("Universe", 800);
    await R.shot("quick-add-universe-menu", {
      title: "Optionally pick a Universe first", marks: [btn("Universe"), `[...document.querySelectorAll('button')].find((b) => /^Sports$/.test(b.innerText.trim()))`],
      caption: "Choose a Universe before you shoot so new photos start in the right place. You can still change each one later.",
      verify: async () => R.has("Pop Culture.*Sports.*TCG"),
    });
    await R.click("Sports", 900);
    await R.click("Category", 800);
    const catText = await R.js(`[...document.querySelectorAll('[role=menu],[role=listbox],ul')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.innerText.replace(/\\s+/g, ' ')).join(' | ')`);
    console.log("category menu:", catText);
    await R.shot("quick-add-category-menu", {
      title: "...and a Category", marks: [btn("Category")],
      caption: "Category narrows it further, for example Cards.",
      verify: async () => ({ ok: /Card/i.test(catText), menu: catText }),
    });
    await R.click("Card.*", 900);

    // 5. take photos: sports, TCG (switch universe), toy (switch), accidental
    const shoot = async (name) => { await R.waitFeed(name); await R.click("Take picture", 700); };
    await shoot("sports-card");
    await R.shot("photo-1-taken", {
      title: "Press the round button to take a photo", marks: [btn("Take picture"), `document.querySelector('button[aria-label="Review captured items"]')`],
      caption: "Press the round shutter button. The counter in the corner goes up and the newest photo appears bottom left.",
      simulated: "Test camera picture (synthetic, fictional card).",
      verify: async () => (await R.text()).match(/Finished \(1\)/) ? true : { ok: false, t: (await R.text()).slice(0, 200) },
    });
    // switch universe for the next card
    await R.click("Universe", 700); await R.click("TCG & Non Sport Card", 800);
    await shoot("tcg-card");
    await R.click("Universe", 700); await R.click("Pop Culture", 800);
    await shoot("toy-figure");
    await shoot("accidental");
    await R.shot("photo-4-taken", {
      title: "Keep going: one photo per item", marks: [btn("Finished.*")],
      caption: "Four photos so far. One of them was an accident, and we will remove it in a moment. Press Finished when you are done.",
      simulated: "Test camera pictures (synthetic, fictional items).",
      verify: async () => /Finished \(4\)/.test(await R.text()),
    });

    // 6. review
    await R.click("Finished.*", 1500);
    await R.shot("review-your-drop", {
      title: "Review what you captured", marks: [`[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'Remove' && b.getBoundingClientRect().width > 0)[3]`],
      caption: "Every photo is listed. Spot the accidental one? Press Remove on it.",
      verify: async () => (await R.has("Review your Drop")) && (await R.has("4 items ready")),
    });
    const removeBtn = `[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'Remove' && b.getBoundingClientRect().width > 0)[3]`;
    await R.clickExpr(removeBtn, 1200);
    await R.shot("review-after-remove", {
      title: "The unwanted photo is gone", marks: [btn("Add 3 items to Vault")],
      caption: "Three items remain. The removed photo shows Undo, in case you change your mind. Each item has its own Universe and Category you can correct. Then press Add 3 items to Vault.",
      verify: async () => (await R.has("3 items ready")) && (await R.has("Add 3 items to Vault")),
    });
    // correct a detail: the toy defaulted to Pop Culture > Comics
    const revSel = `[...document.querySelectorAll('select')].filter((s) => s.getBoundingClientRect().width > 0)`;
    const setRev = (i, text) => R.js(`(() => { const s = (${revSel})[${i}]; const o = [...s.options].find((x) => x.text.trim() === ${JSON.stringify(text)}); if (!o) return 'no option'; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
    console.log("fix item 3 category:", await setRev(5, "Toys & Figures")); await sleep(800);
    await R.shot("review-correct-category", {
      title: "Correct a detail before saving", marks: [`(${revSel})[4]`, `(${revSel})[5]`],
      caption: "Item 3 is a toy, but Pop Culture started on Comics. Change its Category to Toys & Figures. Every item's Universe and Category can be corrected like this.",
      verify: async () => R.js(`[...(${revSel})].slice(0, 6).map((s) => s.options[s.selectedIndex].text.trim())`).then((v) => (v[4] === "Pop Culture" && v[5] === "Toys & Figures") ? v : { ok: false, v }),
    });
    await R.click("Add 3 items to Vault", 1800);

    // 7. verify sheet: names, details
    const nameSel = (i) => `document.querySelectorAll("input[placeholder='Item name']")[${i}]`;
    await R.type(nameSel(0), "1992 Hardwood Heroes Javier Alvarez Rookie #14");
    await R.type(nameSel(1), "Aurora Dragon Holo Rare 045/200");
    await R.type(nameSel(2), "Retro Robots Series 2 Action Figure (boxed)");
    await R.shot("verify-names", {
      title: "Name each item", marks: [nameSel(0), nameSel(1), nameSel(2)],
      caption: "Type a name for each item. Universe, Category, Cost and Value are optional and can be added later.",
      verify: async () => R.js(`[...document.querySelectorAll("input[placeholder='Item name']")].map((i) => i.value)`).then((v) => (v.length === 3 && v.every(Boolean)) ? v : { ok: false, v }),
    });
    await R.type(`document.querySelectorAll("input[placeholder='Cost']")[0] || document.querySelectorAll("input[placeholder*='Cost']")[0]`, "25");
    await R.shot("verify-cost", {
      title: "Add what you know", marks: [`document.querySelectorAll("input[placeholder*='Cost']")[0]`],
      caption: "Cost is what you paid. Leave Cost or Value empty when you do not know it: empty means unknown, not zero.",
      verify: async () => R.js(`document.querySelectorAll("input[placeholder*='Cost']")[0].value`).then((v) => v === "25" ? v : { ok: false, v }),
    });

    // 8. Identify with AI: the real server's answer for an account without AI access
    await R.allowRealAiRefusal();
    await R.clickExpr(`document.querySelectorAll('button')` + `.length && [...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'Identify with AI')[0]`, 3500);
    await R.shot("identify-with-ai", {
      title: "Identify with AI is optional and account-dependent", marks: [`[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'Identify with AI')[0]`],
      caption: "Nothing is identified unless you press Identify with AI. AI is not on every account. If yours does not have it, you see a message and fill the details in yourself.",
      simulated: "This is the real answer from the live server for a test account that does not have AI access. No AI request was paid for.",
      verify: async () => R.text().then((t) => ({ ok: /AI scans are not available on this account./.test(t), snippet: t.slice(t.search(/Verify your Drop/), t.search(/Verify your Drop/) + 300) })),
    });
    // 9. save
    await R.click("Save 3 items to Vault", 6000);
    await R.shot("saved-in-vault", {
      title: "Saved: you land in your Vault", marks: [], caption: "A message confirms the save and you are back in your Vault, where all three items now appear.",
      verify: async () => {
        const rows = (await admin.from("vault_items").select("title,image_front_url,current_value,purchase_price,universe,category").eq("profile_id", P)).data || [];
        return { ok: rows.length === 3 && rows.every((r) => r.image_front_url), count: rows.length, rows: rows.map((r) => ({ t: r.title, cv: r.current_value, pp: r.purchase_price, u: r.universe, c: r.category })) };
      },
    });
    console.log("path after save:", await S.path());
    // 10. find them in the Vault
    await R.js("window.scrollTo(0, 0)");
    const card = (re) => `[...document.querySelectorAll('a[href*="/vault/item/"],[role=button],article,div')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 80 && r.width < 700 && r.height > 80 && r.height < 700 && new RegExp(${JSON.stringify(re)}, 'i').test(e.innerText || ''); }).sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0]`;
    const searchBox = `[...document.querySelectorAll('input')].filter((i) => i.getBoundingClientRect().width > 0 && /^Search/.test(i.placeholder || ''))[1]`;
    await R.js(`(() => { const e = ${card("Alvarez")}; if (e) e.scrollIntoView({ block: 'center' }); return !!e; })()`);
    await sleep(900);
    await R.shot("vault-new-items", {
      title: "Your new items are in the Vault", marks: [card("Alvarez"), card("Aurora Dragon"), card("Retro Robots")],
      caption: "Scroll down in the Vault. Each new item shows its photo and name. The chips above the list count items by Universe.",
      verify: async () => { const t = await R.text(); return /Alvarez/.test(t) && /Aurora Dragon/.test(t) && /Retro Robots/.test(t); },
    });
    await R.type(searchBox, "Aurora");
    await sleep(1500);
    await R.js(`(() => { const e = ${card("Aurora Dragon")}; if (e) e.scrollIntoView({ block: 'center' }); return !!e; })()`);
    await R.shot("vault-search", {
      title: "Search for an item by name", marks: [searchBox],
      caption: "Type part of the name into the Vault search box to find it again.",
      verify: async () => { const t = await R.text(); return { ok: /Aurora Dragon/.test(t) }; },
    });
    await R.clickExpr(card("Aurora Dragon"), 4000);
    await R.shot("item-opened", {
      title: "Open the item to check it", marks: [`[...document.querySelectorAll('h1,h2')].find((e) => /Aurora Dragon/.test(e.innerText) && e.getBoundingClientRect().width > 50)`, `[...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 250)[0]`],
      caption: "Open an item to see its photo and details exactly as you saved them.",
      verify: async () => { const p = await S.path(); const t = await R.text(); return { ok: /\/vault\/item\//.test(p) && /Aurora Dragon/.test(t), path: p }; },
    });
  } catch (e) { console.log("SCRIPT ERROR:", e.message); await R.shot("zz-error", { title: "error" }).catch(() => {}); }
  finally { await R.close(); process.exit(0); }
})();
