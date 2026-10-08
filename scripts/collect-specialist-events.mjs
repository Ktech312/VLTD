import fs from 'node:fs';
import { parse } from 'parse5';
const dir='scripts/data';
const all=(n,p)=>[...(p(n)?[n]:[]),...(n.childNodes||[]).flatMap(c=>all(c,p))];
const text=n=>n.nodeName==='#text'?n.value:(n.childNodes||[]).map(text).join('');
const attr=(n,k)=>n.attrs?.find(a=>a.name===k)?.value;
const cacheFile=`${dir}/specialist-events.json`;
const cached=fs.existsSync(cacheFile)?JSON.parse(fs.readFileSync(cacheFile,'utf8')):[];
const results=new Map(cached.map(r=>[r.source,r]));
const cards=JSON.parse(fs.readFileSync(`${dir}/card-detail-urls.json`,'utf8'));
const guitars=JSON.parse(fs.readFileSync(`${dir}/guitar-detail-urls.json`,'utf8'));
const retry=process.argv.includes('--retry')&&fs.existsSync(`${dir}/specialist-fetch-failures.json`)?JSON.parse(fs.readFileSync(`${dir}/specialist-fetch-failures.json`,'utf8')).map(r=>r.source):null;
const jobs=[...new Set(retry||[...cards,...guitars])].filter(u=>!results.has(u)).sort((a,b)=>Number(b.includes('gbase.com'))-Number(a.includes('gbase.com')));
const failures=[];
let done=0;
async function collect(source){
 const r=await fetch(source,{signal:AbortSignal.timeout(retry?7000:25000)}); if(!r.ok)throw Error(`HTTP ${r.status}`);
 const doc=parse(await r.text());
 const ld=all(doc,n=>n.tagName==='script'&&attr(n,'type')==='application/ld+json').flatMap(n=>{try{return JSON.parse(text(n))}catch{return []}});
 const events=ld.flatMap(o=>o['@graph']||[o]).filter(o=>/Event$/.test(o['@type']||'')&&o.startDate&&o.endDate);
 const e=events[0]; if(!e)throw Error('No dated event schema');
 const start=e.startDate.slice(0,10),end=e.endDate.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)throw Error('Invalid date window');
 if(end<'2026-10-07'||end>'2027-12-31'||/Cancelled|Postponed/.test(e.eventStatus||''))return;
 const a=e.location?.address||{};
 const music=source.includes('gbase.com');
 const links=all(doc,n=>n.tagName==='a');
 const official=links.find(n=>/^(Event Website|Official Website|Official event website|Visit event website|Visit official website)$/i.test(text(n).trim()));
 let website=official?attr(official,'href'):e.organizer?.url;
 if(!website||!/^https?:\/\//.test(website))website=source;
 const content=`${e.name} ${e.description||''}`;
 let universes=music?['MUSIC']:[];
 if(!music){if(/sports|baseball|basketball|football|memorabilia|mixed/i.test(content))universes.push('SPORTS');if(/pokemon|pokémon|tcg|non.sport|trading card|magic|one piece|lorcana|yugioh/i.test(content))universes.push('TCG');if(!universes.length)universes=['SPORTS','TCG'];}
 const country=(typeof a.addressCountry==='string'?a.addressCountry:a.addressCountry?.name)||(music?'Not listed':null);
 if(!country)throw Error('Missing country');
 results.set(source,{source,name:e.name.trim(),start,end,city:a.addressLocality||null,region:a.addressRegion||null,country,venue:e.location?.name||null,address:a.streetAddress||null,website,universes,kind:music?'Music equipment show':'Card show'});
}
async function worker(){while(jobs.length){const u=jobs.shift();try{await collect(u)}catch(e){failures.push({source:u,error:e.message})}done++;if(done%40===0){fs.writeFileSync(cacheFile,JSON.stringify([...results.values()],null,2));console.log(`${done} checked, ${results.size} dated upcoming events, ${failures.length} failures`);}}}
await Promise.all(Array.from({length:6},worker));
fs.writeFileSync(cacheFile,JSON.stringify([...results.values()],null,2));
fs.writeFileSync(`${dir}/specialist-fetch-failures.json`,JSON.stringify(failures,null,2));
console.log(JSON.stringify({checked:done,upcoming:results.size,failures:failures.length}));
