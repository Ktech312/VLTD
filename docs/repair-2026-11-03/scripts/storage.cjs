// node storage.cjs <title> <Storage|Active>: owner opens Exhibitions, selects the card, Change > State.
const L = require("./shr-lib.cjs");
(async () => {
  const [title, state] = process.argv.slice(2);
  const O = await L.session("owner", { height: 1400 });
  try {
    await O.visit("/museum");
    await O.waitFor(`document.body.innerText.includes(${JSON.stringify(title)})`, 120000, "card");
    await O.mclick(`[...document.querySelectorAll('h2,h3,div,span,button,a')].filter(e => e.textContent.trim() === ${JSON.stringify(title)})[0]`, 1500);
    await O.mclick(O.byText("Change"), 1200);
    await O.waitFor("document.querySelectorAll('select').length >= 2", 20000, "modal selects");
    console.log(await O.evaluate(`(() => { const sels=[...document.querySelectorAll('select')]; const s = sels.find(x => [...x.options].some(o => o.value === 'STORAGE')); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s, ${JSON.stringify(state.toUpperCase())}); s.dispatchEvent(new Event('change',{bubbles:true})); return s.value; })()`));
    await O.mclick(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save' && b.closest('[role=dialog]'))`, 3500);
    await L.sleep(5000);
    console.log("db:", JSON.stringify((await L.admin.from("galleries").select("state,visibility").eq("title", title).maybeSingle()).data));
  } finally { await O.close(); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
