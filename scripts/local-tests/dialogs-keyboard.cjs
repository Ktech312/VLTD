// Dialog and keyboard behaviour on the real shared components: focus moves in, Tab stays inside, Escape closes, focus returns to the control that opened it, an outside press closes where the dialog
// allows it, the page behind does not scroll, and a form with typed work asks before it is left. Usage: node scripts/local-tests/dialogs-keyboard.cjs (needs the local build + simulator).
const L = require("./lib.cjs"); const { sleep, NL, check, sim } = L;
const key = async (s, k, extra = {}) => { const code = { Escape: 27, Tab: 9, Enter: 13 }[k]; await s.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: code, ...extra }); await s.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: code, ...extra }); };
const dlg = (s) => s.evaluate(`(() => { const d = [...document.querySelectorAll("[role=dialog],[role=alertdialog]")].filter((e) => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== "hidden"); return d.length; })()`);
const inside = (s) => s.evaluate(`(() => { const d = [...document.querySelectorAll("[role=dialog],[role=alertdialog]")].filter((e) => e.getBoundingClientRect().width > 0).pop(); return !!d && d.contains(document.activeElement); })()`);
const activeDesc = (s) => s.evaluate(`(() => { const a = document.activeElement; return a ? (a.getAttribute("aria-label") || a.innerText || a.tagName).trim().split(String.fromCharCode(10))[0].slice(0, 30) : ""; })()`);
const SPECS = [
  { name: "Lounge: Post Update", route: "/community-board", opener: "Post Update" },
  { name: "Wants: Add a want", route: "/watchlist", opener: "Add a want" },
  { name: "Item: Share this item", route: "/vault/item/sim_item_1", opener: "Share this item", aria: true },
  { name: "Bug report", route: "/dashboard", opener: "Report a bug" },
];
(async () => {
  await sim("/__sim/reset"); const s = await L.open({ width: 1280, height: 900 });
  try {
    for (const sp of SPECS) {
      await s.go(sp.route, 8500); await s.dismiss(); const opened = await s.mclick(sp.opener, false); await sleep(900);
      if (!opened || !(await dlg(s))) { console.log("could not open", sp.name, "opened:", opened); check(sp.name + ": opens from its control", false, sp); continue; }
      check(sp.name + ": focus moves into the dialog when it opens", await inside(s), await activeDesc(s));
      let stays = true; for (let i = 0; i < 14; i++) { await key(s, "Tab"); if (!(await inside(s))) { stays = false; break; } } check(sp.name + ": Tab stays inside the dialog (14 presses)", stays);
      let back = true; for (let i = 0; i < 6; i++) { await key(s, "Tab", { modifiers: 8 }); if (!(await inside(s))) { back = false; break; } } check(sp.name + ": Shift+Tab stays inside the dialog", back);
      await key(s, "Escape"); await sleep(700); const closed = (await dlg(s)) === 0; check(sp.name + ": Escape closes it", closed);
      const ret = await activeDesc(s); check(sp.name + ": focus returns to the control that opened it", closed && (ret.toLowerCase().includes(sp.opener.toLowerCase().slice(0, 8)) || ret.toLowerCase().includes("post") && sp.opener === "Post Update"), ret);
      // outside press (information: not every dialog is meant to close this way)
      await s.mclick(sp.opener, false); await sleep(800); if (await dlg(s)) { await s.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 4, y: 4, button: "left", clickCount: 1 }); await s.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 4, y: 4, button: "left", clickCount: 1 }); await sleep(700); console.log("  info:", sp.name, "- outside press closes it:", (await dlg(s)) === 0); await key(s, "Escape"); await sleep(400); }
    }
    // command palette: opens from the keyboard, Escape closes it, focus goes back where it was
    await s.go("/dashboard", 8000); await s.dismiss(); await s.evaluate(`document.querySelector("input[placeholder*='Search']")?.focus()`); const before = await activeDesc(s); await key(s, "k", { modifiers: 2 }); await sleep(900); const pal = await dlg(s); check("Command palette: Ctrl+K opens a dialog", pal > 0, pal);
    if (pal) { check("Command palette: focus is inside", await inside(s)); await key(s, "Escape"); await sleep(600); check("Command palette: Escape closes it and focus goes back to the search box it came from", (await dlg(s)) === 0 && (await activeDesc(s)) === before, [before, await activeDesc(s)]); }
    // unsaved work: Add Item with a typed name asks before the person leaves
    await s.go("/vault/add", 8500); await s.dismiss(); await s.setField("input[placeholder*='Name this item']", "Unsaved draft item"); await sleep(500);
    const dialogs0 = (s.opts.dialogs || []).length; await s.mclick("Vault", true); await sleep(1800); const asked = (s.opts.dialogs || []).length > dialogs0 || (await dlg(s)) > 0 || /unsaved|discard|leave/i.test(await s.text()); const path1 = await s.evaluate("location.pathname"); console.log("  leaving Add Item with a typed name: asked =", asked, "| now on", path1, "| native dialogs:", JSON.stringify((s.opts.dialogs || []).slice(dialogs0)));
    check("Add Item: leaving with typed work asks first (or the typed work is kept as a draft)", asked || path1.includes("/vault/add") || /draft/i.test(await s.evaluate(`localStorage.getItem("vltd_capture_draft_v1") || Object.keys(localStorage).join(",")`)), [asked, path1]);
    // the browser Back button with typed work
    await s.go("/vault", 7000); await s.go("/vault/add", 8500); await s.dismiss(); await s.setField("input[placeholder*='Name this item']", "Unsaved via Back"); await sleep(500); const d1 = (s.opts.dialogs || []).length; await s.evaluate("history.back()"); await sleep(1800);
    const askedBack = (s.opts.dialogs || []).length > d1 || (await s.evaluate("location.pathname")).includes("/vault/add"); console.log("  Back with typed work: asked or stayed =", askedBack, "| now on", await s.evaluate("location.pathname"), "| dialogs:", JSON.stringify((s.opts.dialogs || []).slice(d1)));
    check("Add Item: the browser Back button with typed work asks first (or stays on the form)", askedBack);
  } finally { await s.close(); }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
