// Online status: OFF by default, switchable by the owner, a public profile shows nothing unless it is on, and a failed save or a not-yet-run SQL is reported honestly.
const L = require("./lib.cjs"); const { check } = L;
const SWITCH = `document.querySelector('[aria-label="Show when I am online on my public profile"]')`;
(async () => {
  await L.sim("/__sim/reset");
  const profiles = await L.dump("profiles"); const me = profiles.find((p) => p.id === L.P); me.is_public = true; me.last_seen_at = new Date().toISOString(); delete me.show_online_status; await L.seed({ profiles });
  let s = await L.open({ width: 1280, height: 1400 });
  try {
    await s.go("/account?section=preferences", 7000); await s.dismiss();
    check("Preferences shows the online-status switch", /Show when I am online/.test(await s.text()));
    check("the switch is OFF by default", (await s.evaluate(SWITCH + `?.getAttribute('aria-checked')`)) === "false");
    await s.go("/v/" + L.P, 7000);
    check("a public profile shows no online or last-active information by default", !/Online|Active \d|Offline/.test(await s.text()) && (await s.evaluate(`document.querySelectorAll('[aria-label="Online"],[aria-label="Offline"]').length`)) === 0);
    await s.go("/account?section=preferences", 7000); await s.dismiss();
    await s.evaluate(SWITCH + `.click()`); await L.sleep(1500);
    check("turning the switch on says so", /On\. Visitors/.test(await s.evaluate(`document.querySelector('[data-testid="online-status-message"]')?.innerText || ''`)));
    check("the choice was saved to the profile", (await L.dump("profiles")).find((p) => p.id === L.P).show_online_status === true);
    await s.go("/v/" + L.P, 7000);
    check("with the switch on, the public profile shows the online status", /Online|Active|Offline/.test(await s.text()));
    await s.go("/account?section=preferences", 7000); await s.dismiss();
    await s.evaluate(SWITCH + `.click()`); await L.sleep(1500);
    check("turning it off saves false", (await L.dump("profiles")).find((p) => p.id === L.P).show_online_status === false);
    await L.sim("/__sim/fail?write=1");
    await s.evaluate(SWITCH + `.click()`); await L.sleep(1500);
    check("a failed save is reported and not shown as done", /could not be saved/i.test(await s.evaluate(`document.querySelector('[data-testid="online-status-message"]')?.innerText || ''`)));
    await L.sim("/__sim/fail?write=0");
  } finally { await s.close(); }
  // If the SQL has not been run yet
  await L.sim("/__sim/reset");
  const p2 = await L.dump("profiles"); p2.find((p) => p.id === L.P).is_public = true; await L.seed({ profiles: p2 });
  await L.sim("/__sim/missing-col?names=show_online_status,rpc:get_public_online_status");
  s = await L.open({ width: 1280, height: 1400 });
  try {
    await s.go("/account?section=preferences", 7000); await s.dismiss();
    check("SQL not run: Preferences says the setting is unavailable and the status stays hidden", /isn.t available right now. Your online status stays hidden/.test(await s.text()));
    check("SQL not run: the switch cannot be changed", (await s.evaluate(SWITCH + `?.disabled`)) === true);
    await s.go("/v/" + L.P, 7000);
    check("SQL not run: a public profile shows no online information", !/Online|Active \d|Offline/.test(await s.text()) && (await s.evaluate(`document.querySelectorAll('[aria-label="Online"],[aria-label="Offline"]').length`)) === 0);
  } finally { await s.close(); await L.sim("/__sim/missing-col?names="); }
  console.log(JSON.stringify(L.results())); process.exit(L.results().fail ? 1 : 0);
})();
