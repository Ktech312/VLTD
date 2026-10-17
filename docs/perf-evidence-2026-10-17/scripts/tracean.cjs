// Summarise a timeline trace: the longest main-thread events by kind, and what runs inside the longest tasks.
const fs=require("fs");
for (const file of process.argv.slice(2)) {
  const ev = JSON.parse(fs.readFileSync(file,"utf8"));
  // renderer main thread = the thread with most RunTask
  const byTid = new Map(); for (const e of ev) if (e.name==="RunTask"&&e.ph==="X") byTid.set(e.tid,(byTid.get(e.tid)||0)+e.dur);
  const main=[...byTid.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0];
  const mine = ev.filter((e)=>e.tid===main && e.ph==="X" && e.dur>0).sort((a,b)=>a.ts-b.ts);
  const tasks = mine.filter((e)=>e.name==="RunTask").sort((a,b)=>b.dur-a.dur).slice(0,3);
  console.log("\n=====", file, "events", ev.length, "main tid", main, "top RunTask ms:", tasks.map((t)=>(t.dur/1000).toFixed(0)).join(", "));
  for (const t of tasks.slice(0,2)) {
    const inside = mine.filter((e)=>e!==t && e.ts>=t.ts && e.ts+e.dur<=t.ts+t.dur+1);
    // top-level children only: not contained in another non-RunTask child
    const kids = inside.filter((e)=>e.name!=="RunTask");
    const sums = new Map(); for (const e of kids) { sums.set(e.name,{ms:(sums.get(e.name)?.ms||0)+e.dur/1000, n:(sums.get(e.name)?.n||0)+1, max:Math.max(sums.get(e.name)?.max||0,e.dur/1000)}); }
    console.log(`-- task of ${(t.dur/1000).toFixed(0)} ms: event kinds (inclusive, may nest):`);
    for (const [k,v] of [...sums.entries()].sort((a,b)=>b[1].ms-a[1].ms).slice(0,12)) console.log("   ",k.padEnd(28),v.ms.toFixed(0).padStart(6),"ms in",String(v.n).padStart(4),"events, longest",v.max.toFixed(0),"ms");
    const big = kids.filter((e)=>["Layout","UpdateLayoutTree","Paint","PrePaint","Commit","Layerize","MajorGC","MinorGC","V8.GC_MC_BACKGROUND_MARKING","ParseHTML","EvaluateScript","FunctionCall","v8.callFunction","TimerFire","FireAnimationFrame","HitTest","UpdateLayer"].includes(e.name)).sort((a,b)=>b.dur-a.dur).slice(0,8);
    for (const e of big) { const a=e.args||{}; const d=a.data||{}; console.log("   *",e.name,(e.dur/1000).toFixed(0)+" ms", d.url?(d.url.split("/").pop().split("?")[0]+":"+d.lineNumber):"", a.beginData?("dirty "+a.beginData.dirtyObjects+" of "+a.beginData.totalObjects):"", a.elementCount?("elements "+a.elementCount):""); }
  }
}
