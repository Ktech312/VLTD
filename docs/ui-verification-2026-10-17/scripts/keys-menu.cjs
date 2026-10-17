const { session, sleep } = require("./ui-lib.cjs");
const KEY = { Tab: 9, Escape: 27, Enter: 13 };
async function press(S, key) {
  const base = { key, code: key, windowsVirtualKeyCode: KEY[key], nativeVirtualKeyCode: KEY[key] };
  await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base });
  if (key === "Enter") await S.send("Input.dispatchKeyEvent", { type: "char", text: "\r", ...base });
  await S.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  await sleep(150);
}
const open = (S) => S.evaluate("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Sign Out')");
const focus = (S) => S.evaluate("(document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim().slice(0, 30))");
(async () => {
  const K = await session("http://localhost:3000", { width: 1440, height: 900 });
  try {
    await K.go("/vault"); await K.waitFor("document.querySelector('button[aria-label=\"Account menu\"]')", 120000); await sleep(2500);
    await K.evaluate("document.querySelector('button[aria-label=\"Account menu\"]').focus(); true");
    await press(K, "Enter"); await sleep(600);
    console.log("open after Enter:", await open(K));
    await press(K, "Tab"); await press(K, "Tab");
    await press(K, "Escape"); await sleep(600);
    console.log("open after Escape:", await open(K), "| focus:", await focus(K));
    await press(K, "Enter"); await sleep(600);
    console.log("reopens with Enter:", await open(K));
  } finally { await K.close(); }
})();
