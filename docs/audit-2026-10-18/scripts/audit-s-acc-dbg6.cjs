const A = require("./audit-s-acc-lib.cjs");
(async () => {
  const S = await A.session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/account"); await A.sleep(2000);
    await A.clickText(S, "^Image upload$", "main button", {}); await A.sleep(600);
    await S.evaluate("(() => { const i = document.querySelector('main input[type=file]'); window.__ev = []; i.addEventListener('change', () => window.__ev.push('change:' + i.files.length)); i.addEventListener('input', () => window.__ev.push('input')); return !!i; })()");
    const file = "C:/Users/EK/AppData/Local/Temp/qa-c/acc-avatar.png";
    const doc = await S.send("DOM.getDocument", { depth: 1 });
    const q = await S.send("DOM.querySelectorAll", { nodeId: doc.root.nodeId, selector: "main input[type=file]" });
    console.log("nodes", q.nodeIds);
    const n0 = S.reqs.length;
    await S.send("DOM.setFileInputFiles", { nodeId: q.nodeIds[0], files: [file] });
    for (let i=0;i<6;i++){ await A.sleep(700); const t=await S.evaluate("[...document.querySelectorAll('div,span,p')].filter((e)=>e.children.length===0 && /row-level|Failed|violates|upload/i.test(e.innerText||'') ).map((e)=>e.innerText.trim().slice(0,120))"); console.log('t'+i, JSON.stringify(t)); if(i==1) console.log(await S.jshot('acc-set-avatar-upload-error')); }
    console.log("events", await S.evaluate("window.__ev"), "files", await S.evaluate("document.querySelector('main input[type=file]').files.length"));
    console.log("reqs", JSON.stringify(S.reqs.slice(n0).map((x) => x.method + " " + x.url.slice(0, 90)).filter((x) => /storage|avatar/.test(x))));
    console.log("toast/text", await S.evaluate("(document.body.innerText.match(/(Uploading|Failed|Choose Image|image)[^\\n]{0,60}/gi) || []).slice(0,5)"));
    console.log("console", JSON.stringify(S.consoleErrors.slice(-5)), JSON.stringify(S.badResponses.slice(-5)));
  } finally { await S.close(); }
})();
