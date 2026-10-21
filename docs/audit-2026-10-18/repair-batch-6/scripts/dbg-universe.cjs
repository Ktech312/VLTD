const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  await S.visit("/vault/automotive"); await sleep(9000);
  console.log((await S.text()).replace(/\s+/g, " ").slice(0, 700));
  await S.visit("/portfolio"); await sleep(9000);
  console.log((await S.text()).replace(/\s+/g, " ").match(/Cost And Value By \w+/));
  await S.close(); process.exit(0);
})();
