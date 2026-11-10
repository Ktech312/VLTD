// Saves while the database refuses every write (simulated 503): item note, exhibition name, a want, profile settings.
// Rules checked: a failure is stated (no false "Saved"), what the person typed stays, nothing is stuck on "Saving", and after the database is back one retry stores it once.
const L = require("./lib.cjs"); const { sleep, NL, check, sim, seed, P } = L; const GID = "00000000-0000-4000-8000-0000000099ab";
const norm = (t) => t.split(NL).join(" ").replace(/\s+/g, " ");
const alerts = (s) => s.evaluate(`JSON.stringify([...document.querySelectorAll("[role=alert],[role=status]")].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.innerText.trim().split(String.fromCharCode(10)).join(" ")).filter(Boolean))`).then(JSON.parse);
const falseSaved = (t) => /(^|[^a-z])(Saved!|Saved\.|Saved successfully|Changes saved|Profile saved|Added to (your )?wishlist)/i.test(t) && !/not (in your account|saved|yet)/i.test(t);
const stuck = (s) => s.evaluate(`[...document.querySelectorAll("button")].some((b) => /^(Saving|Adding|Working)/i.test(b.innerText.trim()))`);
const fieldByValue = (s, v) => s.evaluate(`(() => { const e = [...document.querySelectorAll("input,textarea")].find((x) => x.value === ${JSON.stringify(v)} && x.getBoundingClientRect().width > 0); if (!e) return false; e.setAttribute("data-fv", "1"); return true; })()`);
(async () => {
  // ---- A. item note
  let s = await L.open({ width: 1280, height: 1500 });
  try { await s.go("/vault/item/sim_item_1", 9000); await s.dismiss(); await s.mclick("Edit notes", false); await sleep(800); await s.setField("textarea", "SF note one");
    await sim("/__sim/fail?write=1"); await s.mclick("Save", true); await sleep(3500); let t = norm(await s.text()); const a = await alerts(s);
    check("item note: the screen says it is saved on this device but not in the account yet", a.some((x) => /not in your account yet/i.test(x)), a);
    check("item note: no false 'Saved' claim and the typed note is shown", !falseSaved(t.replace(/Saved on this device[^.]*\./, "")) && /SF note one/.test(t), t.slice(0, 200));
    check("item note: nothing stuck on Saving", !(await stuck(s)));
    await s.go("/vault/item/sim_item_1", 9000); t = norm(await s.text()); check("item note: after a reload the note is still shown (kept on the device)", /SF note one/.test(t), t.slice(0, 120));
    await sim("/__sim/fail?write=0"); await s.mclick("Retry now", false); await sleep(5000);
    const row = (await L.dump("vault_items")).find((r) => r.id === "sim_item_1"); check("item note: after the database is back, Retry stores the note once", row && (row.notes === "SF note one" || row.description === "SF note one" || JSON.stringify(row).includes("SF note one")), row && Object.keys(row).filter((k) => /note/i.test(k)));
  } finally { await s.close(); await sim("/__sim/fail?write=0"); }
  // ---- B. exhibition name
  await seed({ galleries: [{ id: GID, profile_id: P, title: "SF exhibition", visibility: "LOCKED", state: "ACTIVE", public_token: "pub_sim_sf", layout: { itemIds: [], publicItemSnapshots: [] }, exhibition_layout: { itemIds: [], publicItemSnapshots: [] }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] });
  s = await L.open({ width: 1280, height: 1500 });
  try { await s.go("/museum/" + GID, 10000); await s.dismiss(); await s.setField("input[placeholder*='Exhibit name' i], input[aria-label*='Exhibit name' i]", "SF renamed exhibition");
    await sim("/__sim/fail?write=1"); await s.mclick("Save", true); await sleep(4500); let t = norm(await s.text()); const a = await alerts(s); console.log("exhibition alerts:", JSON.stringify(a), "| text:", (t.match(/(saved|couldn.t|could not|failed|try again|not saved)[^.]{0,90}/gi) || []).slice(0, 5));
    check("exhibition: a failed save is stated (not silent, not 'Saved')", (a.some((x) => /couldn.t|could not|failed|try again|not saved|not in your account/i.test(x)) || /couldn.t save|could not save|not saved|try again/i.test(t)) && !falseSaved(t), [a, t.slice(0, 160)]);
    check("exhibition: the typed name is still in the field and the Save button is not stuck", (await s.evaluate(`document.querySelector("input[placeholder*='Exhibit name' i], input[aria-label*='Exhibit name' i]")?.value`)) === "SF renamed exhibition" && !(await stuck(s)));
    await sim("/__sim/fail?write=0"); await s.mclick("Save", true); await sleep(4000); const g = (await L.dump("galleries")).find((r) => r.id === GID); console.log("gallery after retry:", g && g.title);
    check("exhibition: retry after the database is back stores the name", g && /SF renamed exhibition/.test(JSON.stringify(g)), g && g.title);
  } finally { await s.close(); await sim("/__sim/fail?write=0"); }
  // ---- C. a want
  s = await L.open({ width: 1280, height: 1500 });
  try { await s.go("/watchlist", 9000); await s.dismiss(); await s.mclick("Add a want", false); await sleep(1200); await s.mclick("Type it in", false); await sleep(600); await s.setField("input[placeholder='Title'], input[aria-label='Title']", "SF failing want");
    await sim("/__sim/fail?write=1"); await s.mclick("Add to wishlist", false); await sleep(4000); let t = norm(await s.text()); const a = await alerts(s); console.log("want alerts:", JSON.stringify(a), "| listed:", /SF failing want/.test(t), "| dialog open:", /Add to wishlist/.test(t));
    const said = a.some((x) => /couldn.t|could not|failed|try again|not saved|not in your account|device/i.test(x)) || /not in your account yet|couldn.t|could not|try again/i.test(t);
    check("want: when the account cannot be reached the person is told (or it says it is kept on this device), never a silent success", said || !/SF failing want/.test(t), [a, t.slice(0, 200)]);
    check("want: the typed want is not lost (still in the open form or in the list)", /SF failing want/.test(t) || (await s.evaluate(`!!document.querySelector("input[value='SF failing want']")`)), t.slice(0, 160));
    check("want: nothing stuck on Adding/Saving", !(await stuck(s)));
    await sim("/__sim/fail?write=0"); await s.go("/watchlist", 9000); await sleep(3000); const wishRows = Object.entries((await sim("/__sim/counts")).counts).filter(([k]) => /wish|want/i.test(k) && /POST|PATCH/.test(k)); console.log("want writes seen by the simulator:", JSON.stringify(wishRows));
    const wr = (await L.dump("wishlist")).filter((w) => /SF failing want/.test(w.title || "")); check("want: once the database is back the pending want reaches the account exactly once", wr.length === 1, wr.length);
  } finally { await s.close(); await sim("/__sim/fail?write=0"); }
  // ---- D. profile settings
  s = await L.open({ width: 1280, height: 1800 });
  try { await s.go("/account", 9000); await s.dismiss(); const ok = await fieldByValue(s, "Sim Collector"); if (ok) { await s.setField("input[data-fv='1']", "SF New Name"); }
    await sim("/__sim/fail?write=1"); await s.mclick("Save changes", false); await sleep(4000); let t = norm(await s.text()); const a = await alerts(s); console.log("settings alerts:", JSON.stringify(a));
    check("settings: a failed profile save is stated and not shown as saved", ok && a.some((x) => /couldn.t|could not|failed|try again|not saved|error/i.test(x)) && !falseSaved(t), [ok, a, t.slice(0, 160)]);
    check("settings: the typed name is still in the field and Save is not stuck", (await s.evaluate(`document.querySelector("input[data-fv='1']")?.value`)) === "SF New Name" && !(await stuck(s)));
    await sim("/__sim/fail?write=0"); await s.mclick("Save changes", false); await sleep(3500); const pr = (await L.dump("profiles")).find((r) => r.id === P); check("settings: retry after the database is back stores the name", pr && pr.display_name === "SF New Name", pr && pr.display_name);
  } finally { await s.close(); await sim("/__sim/fail?write=0"); }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
