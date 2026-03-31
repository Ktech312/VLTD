
"use client";

export function detectDuplicates(items){
  const seen = new Map();
  const dups = [];
  items.forEach(i=>{
    const key = (i.title||"").toLowerCase().trim();
    if(!key) return;
    if(seen.has(key)){
      dups.push(i);
    } else {
      seen.set(key, true);
    }
  });
  return dups;
}

export function buildImportSummary(items, ignored){
  const totalValue = items.reduce((s,i)=>s + Number(i.currentValue||0),0);
  const totalCost = items.reduce((s,i)=>s + Number(i.purchasePrice||0),0);
  return {
    count: items.length,
    ignored: ignored.length,
    totalValue,
    totalCost
  };
}
