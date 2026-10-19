const L = require("./audit-s-gin-lib.cjs"); const { sleep } = L;
(async () => {
  for (const kind of ["owner", "visitor"]) {
    const S = await L.session(kind);
    try {
      await S.visit("/insurance/packet/print?page=0&images=0"); await sleep(5000);
      console.log(kind, JSON.stringify(await S.evaluate(`({ htmlStyle: document.documentElement.getAttribute('style'), htmlDisplay: getComputedStyle(document.documentElement).display, htmlClass: document.documentElement.className.slice(0,80), bodyH: document.body.getBoundingClientRect().height, tbl: !!document.querySelector('table') })`)));
      console.log(await S.jshot("gin-print-" + kind));
      if (kind === "owner") { await S.send("Emulation.setEmulatedMedia", { media: "print" }); await sleep(500); console.log("print media html display", await S.evaluate("getComputedStyle(document.documentElement).display")); }
    } finally { await S.close(); }
  }
})();
