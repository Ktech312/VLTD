// Safe-before-SQL check: NO simulation. The real database has no list_member_profiles yet, so a team member sees what they saw before, with no error page.
const { man, sleep } = require("./lib.cjs"); const { open, closeAll } = require("./br.cjs");
const base = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3003").slice(7);
(async () => {
  const m = man();
  const S = await open(base);
  S.c.on((e) => { if (e.method === "Network.responseReceived" && /list_member_profiles/.test(e.params.response.url)) console.log("function call status:", e.params.response.status); });
  await S.login(m.users.member.email, m.users.member.password); await sleep(5000);
  await S.evaluate(`document.querySelector('[aria-label="Account menu"]')?.click()`); await sleep(2000);
  const t = (await S.text()).replace(/\s+/g, " ");
  console.log("on arrival:", await S.path(), "| business listed:", /QA Biz Co/.test(t), "| own profile listed:", /QA Member Personal/.test(t), "| error banner:", /did not finish loading|something went wrong/i.test(t));
  await S.go("/vault"); await sleep(6000);
  const v = (await S.text()).replace(/\s+/g, " ");
  console.log("vault shows own items:", /MEMBERPERSONAL ITEM/.test(v), "| business items:", /BIZCO/.test(v));
  await closeAll();
})().catch(async (e) => { console.log("ERR", e.message); await closeAll(); process.exit(1); });
