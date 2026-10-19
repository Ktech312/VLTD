const L = require("./audit-s-gin-lib.cjs"); const { sleep } = L;
(async () => {
  const S = await L.session("owner");
  try {
    await S.visit("/insurance/packet/print?page=0&images=0"); await sleep(8000);
    console.log(JSON.stringify(await S.evaluate(`(() => { const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }; const main = document.querySelector('main'); const tbl = document.querySelector('table'); const fixed=[...document.querySelectorAll('body *')].filter(e=>getComputedStyle(e).position==='fixed').map(e=>({t:e.tagName, c:String(e.className).slice(0,60), r:r(e), z:getComputedStyle(e).zIndex, txt:e.textContent.trim().slice(0,60)})); return { main: main && r(main), tbl: tbl && r(tbl), scroll: [document.documentElement.scrollHeight, document.body.scrollHeight], bodyKids: [...document.body.children].map(e=>e.tagName+'.'+String(e.className).slice(0,40)+':'+r(e).join(',')), fixed, sc:[...document.querySelectorAll('*')].filter(e=>e.scrollTop>0).map(e=>e.tagName+e.scrollTop) }; })()`), null, 1));
    console.log(await S.jshot("gin-probe-print"));
  } finally { await S.close(); }
})();
