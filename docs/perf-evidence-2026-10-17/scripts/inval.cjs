// What invalidated the style / layout / paint inside the biggest rendering task of a trace?
const fs=require("fs");
for (const file of process.argv.slice(2)) {
  const ev=JSON.parse(fs.readFileSync(file,"utf8"));
  const byTid=new Map(); for(const e of ev) if(e.name==="RunTask"&&e.ph==="X") byTid.set(e.tid,(byTid.get(e.tid)||0)+e.dur);
  const main=[...byTid.entries()].sort((a,b)=>b[1]-a[1])[0][0];
  const tasks=ev.filter(e=>e.tid===main&&e.name==="RunTask"&&e.ph==="X").sort((a,b)=>b.dur-a.dur);
  // the task that holds the biggest UpdateLayoutTree
  const ult=ev.filter(e=>e.tid===main&&e.name==="UpdateLayoutTree"&&e.ph==="X").sort((a,b)=>b.dur-a.dur)[0];
  const task=tasks.find(t=>ult&&ult.ts>=t.ts&&ult.ts<=t.ts+t.dur)||tasks[0];
  console.log("\n=====",file,"| render task",(task.dur/1000).toFixed(0),"ms | biggest UpdateLayoutTree",ult?(ult.dur/1000).toFixed(0)+" ms, elements "+(ult.args&&ult.args.elementCount):"none");
  // all rendering events in this task
  const inside=ev.filter(e=>e.tid===main&&e.ts>=task.ts&&e.ts<=task.ts+task.dur);
  const kinds=new Map(); for(const e of inside) if(e.ph==="X") kinds.set(e.name,(kinds.get(e.name)||0)+e.dur/1000);
  console.log("events inside:",[...kinds.entries()].filter(([k,v])=>v>=5).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>k+" "+v.toFixed(0)+"ms").join(", "));
  // invalidation tracking events: those that happened BEFORE this task (they schedule the work) and inside it
  const win=ev.filter(e=>/InvalidationTracking$/.test(e.name)&&e.ts>=task.ts-300000&&e.ts<=task.ts+task.dur);
  const agg=new Map();
  for(const e of win){const d=(e.args&&e.args.data)||{};const key=e.name.replace("InvalidationTracking","")+" | "+(d.reason||"")+" | "+(d.nodeName||"")+(d.changedClass?" class="+String(d.changedClass).slice(0,30):"")+(d.changedAttribute?" attr="+d.changedAttribute:"")+(d.changedId?" id="+d.changedId:"")+(d.selectorPart?" sel="+String(d.selectorPart).slice(0,30):"");agg.set(key,(agg.get(key)||0)+1);}
  console.log("invalidation events in/just before the task:",win.length);
  for(const [k,n] of [...agg.entries()].sort((a,b)=>b[1]-a[1]).slice(0,14)) console.log("  ",String(n).padStart(5),"x",k);
  // which node kinds were invalidated most (by nodeName)
  const nn=new Map(); for(const e of win){const d=(e.args&&e.args.data)||{}; if(d.nodeName) nn.set(d.nodeName,(nn.get(d.nodeName)||0)+1);} console.log("by element kind:",[...nn.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>k+" "+v).join(", "));
}
