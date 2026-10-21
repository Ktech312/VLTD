const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  await S.visit("/vault"); await sleep(9000);
  await S.send("Network.setBlockedURLs", { urls: ["*supabase.co/rest/v1/*", "*supabase.co/auth/v1/user*"] });
  await S.visit("/dashboard"); await sleep(25000);
  console.log((await S.text()).replace(/\s+/g, " ").slice(0, 900));
  console.log(JSON.stringify(await S.evaluate("({ own: localStorage.getItem('vltd_local_data_owner') , keys: Object.keys(localStorage).filter(k => /vltd/.test(k)).slice(0,30) })")));
  await S.close(); process.exit(0);
})();
