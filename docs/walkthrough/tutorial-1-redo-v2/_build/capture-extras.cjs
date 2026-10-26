// Extra scenes: where every entry point leads (empty Vault, Upload from device menu, Add manually), and the blocked-camera message. Run reset-qa.cjs first (the empty Vault state is shown).
const { start, btn, byText, T } = require("./lib.cjs");
const sleep = T.sleep;

async function map() {
  const R = await start({ scene: "x-map", camera: false });
  const { S } = R;
  try {
    await R.goto("/vault");
    const hrefs = await R.js(`(() => { const out = {}; for (const t of ['Scan your first item', 'Quick Add', 'Add manually', 'Import']) { const a = [...document.querySelectorAll('a,button')].filter((e) => e.getBoundingClientRect().width > 0 && e.innerText.trim() === t); out[t] = a.map((e) => e.getAttribute('href') || '[button]'); } return out; })()`);
    console.log("empty vault buttons:", JSON.stringify(hrefs));
    const emptyBtn = (t) => `[...document.querySelectorAll('a,button')].filter((e) => e.getBoundingClientRect().width > 0 && e.innerText.trim() === ${JSON.stringify(t)}).pop()`;
    await R.js(`(() => { const e = ${emptyBtn("Add manually")}; if (e) e.scrollIntoView({ block: 'center' }); })()`);
    await R.shot("empty-vault-buttons", {
      title: "A new, empty Vault offers four starting points", marks: [emptyBtn("Scan your first item"), emptyBtn("Quick Add"), emptyBtn("Add manually"), emptyBtn("Import")],
      caption: "Scan your first item opens the Add Item form. Quick Add opens the multi-photo camera. Add manually opens a simpler typing-only form. Import brings in a spreadsheet.",
      verify: async () => { const ok = hrefs["Scan your first item"].includes("/capture") && hrefs["Quick Add"].includes("/vault/quick") && hrefs["Add manually"].includes("/vault/add") && hrefs["Import"].includes("/vault/import"); return { ok, hrefs }; },
    });
    await R.clickExpr(emptyBtn("Add manually"), 3500);
    await R.shot("add-manually", {
      title: "Add manually is a different, typing-only form", marks: [`document.querySelector("input[placeholder^='Name this item']")`],
      caption: "Add manually opens a separate one-page form. Its required field is called Title, and it has its own photo area and extra fields. This tutorial teaches the main Add Item form and Quick Add instead.",
      verify: async () => { const p = await S.path(); const t = await R.text(); return { ok: p === "/vault/add" && /TITLE/i.test(t), p }; },
    });
    await R.goto("/dashboard");
    await R.click("Upload from device", 1500);
    await R.shot("upload-from-device-menu", {
      title: "Upload from device offers two routes", marks: [byText("Single item"), byText("Batch")],
      caption: "Upload from device asks: Single item (all the photos go on one item, in Add Item) or Batch (each photo becomes a new item, in Bulk Upload). Bulk Upload is not covered in this tutorial.",
      verify: async () => R.js(`[...document.querySelectorAll('a')].filter((e) => e.getBoundingClientRect().width > 0 && /^(Single item|Batch)/.test(e.innerText.trim())).map((e) => e.getAttribute('href'))`).then((h) => (h.includes("/capture?openUpload=1") && h.includes("/vault/bulk")) ? h : { ok: false, h }),
    });
  } catch (e) { console.log("SCRIPT ERROR (map):", e.message); await R.shot("zz-error", { title: "error" }).catch(() => {}); }
  finally { await R.close(); }
}

async function denied() {
  const R = await start({ scene: "x-denied", deniedCamera: true });
  const { S } = R;
  try {
    await R.goto("/vault/quick"); await sleep(2500);
    await R.shot("camera-blocked", {
      title: "If the camera is blocked", marks: [byText("Camera access is blocked")],
      caption: "If you tapped Block, Quick Add says: Camera access is blocked for this site. Allow the camera in your browser's site settings, then reopen Quick Add. Without a camera you can still use Upload or Add manually.",
      simulated: "The permission was set to Blocked in the test browser; the message is the app's own.",
      verify: async () => (await R.has("Camera access is blocked for this site")) || { ok: false },
    });
  } catch (e) { console.log("SCRIPT ERROR (denied):", e.message); }
  finally { await R.close(); }
}

(async () => { await map(); await denied(); process.exit(0); })();
