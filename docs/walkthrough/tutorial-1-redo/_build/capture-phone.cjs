// Phone captures (390x844 emulated phone, touch UA) for both chapters. Run with AUDIT_MANIFEST=<qa manifest>. Run reset-qa.cjs first.
const { start, btn, T } = require("./lib.cjs");
const { admin } = T;
const sleep = T.sleep;
const clickLastBtn = (t) => `[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === ${JSON.stringify(t)} && b.getBoundingClientRect().width > 0).pop()`;
const secBtn = (n) => `[...document.querySelectorAll('button')].find((x) => x.innerText.split('\\n')[0].trim() === ${JSON.stringify(String(n))} && x.getBoundingClientRect().width > 200)`;
const selects = `[...document.querySelectorAll('select')].filter((s) => s.getBoundingClientRect().width > 0)`;
const nameInput = `document.querySelector("input[placeholder='Item name']")`;
const finishedBtn = `[...document.querySelectorAll('button')].find((b) => /^Finished/.test(b.innerText.trim()) && b.getBoundingClientRect().width > 0)`;
const reviewBtn = `document.querySelector('button[aria-label="Review captured items"]')`;
const startsBtn = (t) => `[...document.querySelectorAll('button')].find((b) => b.innerText.trim().indexOf(${JSON.stringify(t)}) === 0 && b.getBoundingClientRect().width > 0)`;
const SIM = "The viewfinder shows a test camera playing a synthetic, fictional picture. On a real phone the browser asks to allow the camera first; that prompt cannot be captured.";

async function quick() {
  const R = await start({ scene: "q-phone", phone: true });
  const { S, m } = R; const P = m.personalId;
  try {
    await R.goto("/dashboard");
    await R.shot("home-bar", {
      title: "On a phone, the buttons sit at the bottom", marks: [btn("Quick Add"), btn("ADD ITEM")],
      caption: "On a phone, Quick Add and ADD ITEM are in a bar near the bottom of Home and the Vault. The tab bar underneath has Home, Vault, Exhibitions, Lounge and Discover.",
      verify: async () => R.js(`(() => { const a = [...document.querySelectorAll('a')]; const q = a.find((x) => /^Quick Add$/.test(x.innerText.trim())); const i = a.find((x) => /^ADD ITEM/.test(x.innerText.trim())); return { q: q && q.getAttribute('href'), i: i && i.getAttribute('href') }; })()`).then((v) => (v.q === "/vault/quick" && v.i === "/capture") ? v : { ok: false, v }),
    });
    await R.click("Quick Add", 3500);
    await R.shot("quick-open", {
      title: "Quick Add opens the camera", marks: [`document.querySelector('button[aria-label="Take picture"]')`, finishedBtn],
      caption: "Quick Add fills the screen with the camera. The round button takes a photo. Finished is at the top right.",
      simulated: SIM,
      verify: async () => { const p = await S.path(); const v = await R.feedNow(); return p === "/vault/quick" && !!v ? { path: p } : { ok: false, p }; },
    });
    const shoot = async (name) => { await R.waitFeed(name); await R.click("Take picture", 700); };
    await shoot("sports-card"); await shoot("tcg-card"); await shoot("toy-figure"); await shoot("accidental");
    await R.shot("four-taken", {
      title: "Take one photo per item", marks: [finishedBtn, reviewBtn],
      caption: "The counter shows how many photos you have. Tap the small picture at the bottom left, or Finished, to review them.",
      simulated: SIM,
      verify: async () => /Finished \(4\)/.test(await R.text()),
    });
    await R.clickExpr(finishedBtn, 1500);
    const removeBtn = `[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'Remove' && b.getBoundingClientRect().width > 0)[3]`;
    await R.shot("review", {
      title: "Remove the photo you do not want", marks: [removeBtn],
      caption: "Every photo is listed with its own Universe and Category. Tap Remove on the accidental one.",
      verify: async () => (await R.has("Review your Drop")) && (await R.has("4 items ready")),
    });
    await R.clickExpr(removeBtn, 1200);
    await R.clickExpr(startsBtn("Add 3 items"), 1800);
    await R.type(`document.querySelectorAll("input[placeholder='Item name']")[0]`, "1992 Hardwood Heroes Javier Alvarez Rookie #14");
    await R.type(`document.querySelectorAll("input[placeholder='Item name']")[1]`, "Aurora Dragon Holo Rare 045/200");
    await R.type(`document.querySelectorAll("input[placeholder='Item name']")[2]`, "Retro Robots Series 2 Action Figure (boxed)");
    await R.shot("verify", {
      title: "Name each item, then save", marks: [`document.querySelectorAll("input[placeholder='Item name']")[0]`, startsBtn("Save 3 items")],
      caption: "Type a name for each item. Cost and Value are optional. Identify with AI is optional and not on every account. Then tap Save 3 items to Vault.",
      verify: async () => R.js(`[...document.querySelectorAll("input[placeholder='Item name']")].map((i) => i.value)`).then((v) => (v.length === 3 && v.every(Boolean)) ? v : { ok: false, v }),
    });
    await R.clickExpr(startsBtn("Save 3 items"), 6000);
    await R.shot("vault", {
      title: "Back in your Vault", marks: [],
      caption: "You land in your Vault. Scroll down to see your three new items.",
      verify: async () => { const rows = (await admin.from("vault_items").select("title,image_front_url").eq("profile_id", P)).data || []; return { ok: rows.length === 3 && rows.every((r) => r.image_front_url), n: rows.length, path: await S.path() }; },
    });
  } catch (e) { console.log("SCRIPT ERROR (quick phone):", e.message); await R.shot("zz-error", { title: "error" }).catch(() => {}); }
  finally { await R.close(); }
}

async function add() {
  const R = await start({ scene: "a-phone", phone: true });
  const { S, m } = R; const P = m.personalId;
  try {
    await R.goto("/dashboard");
    await R.click("ADD ITEM.*", 3500);
    await R.shot("form", {
      title: "The Add Item form on a phone", marks: [nameInput, `[...document.querySelectorAll('button')].find((b) => /^Take photo$/.test(b.innerText.trim()))`],
      caption: "On a phone the photo area comes first, and the five numbered sections follow below it. Scroll down for the rest. Only Item name is required.",
      verify: async () => { const t = await R.text(); return { ok: (await S.path()) === "/capture" && /ITEM NAME \*/.test(t) }; },
    });
    await R.click("Take photo", 3500);
    await R.waitFeed("toy-figure");
    await R.shot("camera", {
      title: "Take a photo", marks: [`document.querySelector('button[aria-label="Capture photo"]')`],
      caption: "Take photo opens the camera and the round button captures. In this phone-size test the button sits partly behind the tab bar (see the highlight): tap its top edge. Take Real Photo opens your phone's own camera app instead, and Upload lets you pick a photo you already have.",
      simulated: SIM,
      verify: async () => R.js(`!!document.querySelector('button[aria-label="Capture photo"]')`).then((v) => v || { ok: false }),
    });
    const sh = await R.js(`(() => { const b = document.querySelector('button[aria-label="Capture photo"]').getBoundingClientRect(); const tabs = [...document.querySelectorAll('nav,[role=navigation]')].map((n) => n.getBoundingClientRect()).filter((r) => r.top > 500).map((r) => r.top); return { x: b.left + b.width / 2, top: b.top, h: b.height, tabTop: tabs.length ? Math.min(...tabs) : null }; })()`);
    console.log("shutter:", JSON.stringify(sh));
    R.shutterGeometry = sh;
    await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sh.x, y: sh.top + 6 }] });
    await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(3500);
    await R.shot("keep", {
      title: "Keep or retake", marks: [btn("↩ Retake"), clickLastBtn("Save")],
      caption: "Tap Save to keep the photo, or Retake to throw it away and shoot again.",
      simulated: "Test camera picture.",
      verify: async () => { const t = await R.text(); return /Retake/.test(t) && /Fine Tune/.test(t); },
    });
    await R.clickExpr(clickLastBtn("Save"), 4000);
    await R.type(nameInput, "Retro Robots Series 2 Action Figure (boxed)");
    await R.shot("named", {
      title: "Type the name", marks: [nameInput],
      caption: "Type the Item name. On a phone, the keyboard covers the lower half, so scroll the form to reach the other sections.",
      verify: async () => R.js(`document.querySelector("input[placeholder='Item name']").value`).then((v) => v ? v : { ok: false }),
    });
    await R.clickExpr(secBtn(4), 1200);
    await R.type(`document.querySelector("#capture-purchase-price")`, "38.00");
    await R.js(`document.querySelector("#capture-purchase-price").scrollIntoView({ block: 'center' })`);
    await R.shot("value", {
      title: "Purchase price and current value", marks: [`document.querySelector("#capture-purchase-price")`, `document.querySelector("#capture-current-value")`],
      caption: "Open section 4, Value. Purchase price is what you paid. Current value stays empty if you do not know it: empty means unknown.",
      verify: async () => R.js(`[document.querySelector("#capture-purchase-price").value, document.querySelector("#capture-current-value").value]`).then((v) => (v[0] === "38.00" && v[1] === "") ? v : { ok: false, v }),
    });
    await R.clickExpr(btn("Save to Vault"), 6000);
    await R.shot("saved", {
      title: "Saved", marks: [],
      caption: "Saving takes you to your Vault, where the new item is listed.",
      verify: async () => { const r = (await admin.from("vault_items").select("*").eq("profile_id", P).ilike("title", "Retro Robots%")).data || []; return { ok: r.length === 1 && r[0].purchase_price === 38 && r[0].current_value === null && !!r[0].image_front_url, path: await S.path() }; },
    });
  } catch (e) { console.log("SCRIPT ERROR (add phone):", e.message); await R.shot("zz-error", { title: "error" }).catch(() => {}); }
  finally { await R.close(); }
}

(async () => { await quick(); require("child_process").execFileSync(process.execPath, [require("path").join(__dirname, "reset-qa.cjs")], { stdio: "inherit" }); await add(); process.exit(0); })();
