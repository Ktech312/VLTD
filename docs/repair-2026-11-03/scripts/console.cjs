const L = require("./shr-lib.cjs");
(async () => {
  const [kind, p] = process.argv.slice(2);
  const S = await L.session(kind);
  const errs = [];
  S.c.on((e) => { if (e.method === "Runtime.exceptionThrown") errs.push(JSON.stringify(e.params.exceptionDetails).slice(0, 900)); if (e.method === "Runtime.consoleAPICalled" && e.params.type === "error") errs.push("console: " + JSON.stringify(e.params.args.map((a) => a.value || a.description)).slice(0, 700)); });
  await S.send("Runtime.enable");
  await S.visit(p);
  console.log((await S.text()).slice(0, 200)); console.log(errs.join("\n---\n"));
  await S.close(); process.exit(0);
})();
