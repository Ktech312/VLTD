const V = require("./audit-s-vlt-lib.cjs");
const { sleep, squash } = V;
(async () => {
  const S = await V.session("owner");
  try {
    await S.visit("/dashboard");
    await V.clickEl(S, 'button[aria-label="Account menu"]'); await sleep(800);
    console.log(await S.evaluate("[...document.querySelectorAll('[role=menu],[role=dialog],[data-account-menu]')].map((e) => e.innerText.replace(/\\s+/g, ' ')).join(' ## ') || document.body.innerText.slice(0, 1000)"));
    const c = await V.controls(S);
    console.log(c.filter((x) => x.visible && /menuitem|button|link/.test(x.kind) && /(profile|business|personal|switch|workspace)/i.test(x.label)).map((x) => x.kind + ":" + x.label + ":" + x.href).join("\n"));
    await S.jshot("vlt-probe-account-menu");
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
