const L = require("./lib.cjs"); const { NL, sleep, check, sim } = L; const norm = (t) => t.split(NL).join(" ").replace(/\s+/g, " ");
(async () => {
  // Frame Studio on a device that never opened the Vault
  let s = await L.open({ width: 1280, height: 1200 });
  try { await s.go("/vault/frames", 11000); await s.dismiss(); let t = norm(await s.text());
    check("Frame Studio fresh device lists the account's items", (t.match(/Sim Item \d+/g) || []).length >= 20, t.slice(0, 250));
    check("Frame Studio fresh device counts them (80+ items in vault)", /\b8\d items in vault/.test(t), t.slice(t.indexOf("items in vault") - 20, t.indexOf("items in vault") + 20));
    check("no false 'No items in vault yet'", !/No items in vault yet/.test(t), 0);
  } finally { await s.close(); }
  // account unreachable: say so, do not claim empty
  await sim("/__sim/fail?rest=1");
  s = await L.open({ width: 1280, height: 1200 });
  try { await s.go("/vault/frames", 26000); /* the shared sync retries for about 20 s before giving up */ await s.dismiss(); const t = norm(await s.text()); console.log("outage text:", t.slice(t.indexOf("Frame Studio"), t.indexOf("Frame Studio") + 200));
    check("outage: Frame Studio says it could not load (not 'No items')", /Couldn.t load your vault/.test(t) && !/No items in vault yet/.test(t), t.slice(0, 250));
  } finally { await s.close(); await sim("/__sim/fail?rest=0"); }
  // category insights default window
  s = await L.open({ width: 1280, height: 1600 });
  try { await s.go("/portfolio/universe/SPORTS/category/Collectors%20Choice", 10000); await s.dismiss(); let t = norm(await s.text());
    check("category page opens on All time with all 20 items", /Items 20/.test(t) && /Cost \$880/.test(t) && /All time/.test(t), t.slice(t.indexOf("TOTAL"), t.indexOf("TOTAL") + 200));
    await s.mclick("7d", true); await sleep(1200); t = norm(await s.text()); check("7d still narrows the window", /Items 0/.test(t) && /Last 7 days/.test(t), 0);
    await s.go("/portfolio/universe/SPORTS/category/Collectors%20Choice", 9000); t = norm(await s.text()); check("a chosen window is remembered", /Last 7 days/.test(t), 0);
    await s.mclick("All", true); await sleep(900); await s.go("/portfolio/universe/SPORTS/category/Collectors%20Choice", 9000); t = norm(await s.text()); check("choosing All is remembered too", /Items 20/.test(t), 0);
  } finally { await s.close(); }
  console.log(JSON.stringify(L.results())); process.exit(0); })();
