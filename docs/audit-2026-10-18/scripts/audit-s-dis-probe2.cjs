const C = require("./audit-s-dis-common.cjs");
(async () => {
  const sd = C.seed();
  const S = await C.session("visitor");
  for (const k of ["A", "B", "C"]) {
    await S.visit(`/museum/${sd.ids[k]}/guest`);
    await C.sleep(2500);
    console.log(k, C.clean(await S.text()).slice(0, 1200));
    console.log(S.reqs.filter((r) => /vault_items|public_vault/.test(r.url)).map((r) => decodeURIComponent(r.url)).slice(0, 4));
  }
  const cs = await C.controls(S);
  console.log(cs.filter((c) => c.visible).map((c) => `${c.kind}|${c.label}|${c.href}`).join("\n"));
  await S.jshot("dis-probe-guest");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
