// Probe 4: theme menu DOM + info popover.
const X = require("./audit-s-exh-lib.cjs");
const { session, sleep, mclick, byLabel } = X;
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
(async () => {
  const S = await session("owner");
  try {
    await S.visit("/museum/" + ex.A); await sleep(6000);
    await mclick(S, byLabel("Shelf style"), { wait: 800 });
    console.log(await S.evaluate(`JSON.stringify([...document.querySelectorAll('body *')].filter(e => /^(None|Glass|Metal)$/.test(e.textContent.trim()) && e.children.length === 0).map(e => ({ tag: e.tagName, role: e.getAttribute('role'), cls: (e.className||'').toString().slice(0,60), parent: e.parentElement.tagName + ':' + (e.parentElement.getAttribute('role')||'') })))`));
    await S.jshot("exh-probe4-theme-menu");
    await key(S, "Escape", "Escape", 27);
    await mclick(S, byLabel("Background picture size and format"), { wait: 800 });
    console.log("info", await S.evaluate(`!!document.getElementById('gallery-background-info')`), await S.evaluate(`document.querySelector('[aria-label="Background picture size and format"]').getAttribute('aria-expanded')`));
    await S.jshot("exh-probe4-info");
  } finally { await S.close(); }
})();
async function key(S, k, code, vk) { await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk }); }
