const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  await S.visit("/portfolio"); await sleep(12000);
  const t = (await S.text()).replace(/\s+/g, " ");
  console.log(t.length, JSON.stringify(t.match(/COST AND VALUE BY \w+|Cost And Value By \w+/i)));
  console.log(JSON.stringify(await S.evaluate("[...document.querySelectorAll('a')].filter((a) => /movers|view all|review items|add note/i.test(a.innerText)).map((a) => [a.innerText.trim().slice(0,20), a.getAttribute('href')])")));
  await S.close(); process.exit(0);
})();
