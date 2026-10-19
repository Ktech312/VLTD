const { session } = require("./audit-lib.cjs");
(async () => { const S = await session("owner"); await S.visit("/vault"); console.log(await S.evaluate("location.pathname + ' | ' + document.body.innerText.slice(0,120).replace(/\s+/g,' ')")); await S.close(); process.exit(0); })();
