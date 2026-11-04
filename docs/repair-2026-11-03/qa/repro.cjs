// Reproduce on a given base (default live): owner adds member through the Team page; member signs in elsewhere and looks around.
// node repro.cjs [--base=https://vltd.app] [--skip-add]
const { man, sleep } = require("./lib.cjs");
const { open } = require("./br.cjs");
const base = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const skipAdd = process.argv.includes("--skip-add");
const out = (k, v) => console.log(k.padEnd(34), typeof v === "string" ? v : JSON.stringify(v));
(async () => {
  const m = man();
  if (!skipAdd) {
    const O = await open(base);
    await O.login(m.users.owner.email, m.users.owner.password);
    out("owner after login", await O.path());
    await O.setActive(m.profiles.business);
    await O.go("/account/team"); await O.settle(4000);
    out("owner team page", (await O.text()).replace(/\s+/g, " ").slice(0, 300));
    await O.setVal("input[type=email]", m.users.member.email);
    await sleep(300);
    out("clicked Add", await O.clickText("Add"));
    await O.settle(3500);
    out("owner team after Add", (await O.text()).replace(/\s+/g, " ").slice(0, 400));
    out("owner net", O.take().filter((r) => /rpc|profile_members|profiles/.test(r.path)));
    await O.close();
  }
  const M = await open(base);
  await M.login(m.users.member.email, m.users.member.password);
  out("member after login", await M.path());
  out("member active profile", (await M.activeProfile()) || "none");
  M.take();
  for (const p of ["/vault", "/account", "/account/team", "/account/workspace"]) {
    await M.go(p); await M.settle(4000);
    out("member " + p + " ->", await M.path());
  }
  out("member net (profiles)", M.take().filter((r) => /profiles|profile_members|vault_items/.test(r.path)).slice(0, 12));
  await M.setActive(m.profiles.business);
  await M.go("/vault"); await M.settle(4000);
  out("member forced active=business, vault", (await M.text()).replace(/\s+/g, " ").slice(0, 300));
  out("member active after", await M.activeProfile());
  await M.close();
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
