// Preview first; --apply publishes only validated factual listings, preserving existing records.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
const norm=s=>(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
const nameKey=s=>norm((s||'').replace(/^The\s+/i,'').replace(/\b20\d\d\b/g,''));
const urlKey=s=>{if(!s)return '';const u=new URL(s);return u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'');};
const countryMap={'United States':'US','United States of America':'US',USA:'US',Canada:'CA','United Kingdom':'GB',UK:'GB',Germany:'DE',Netherlands:'NL',Australia:'AU',France:'FR',Italy:'IT',Japan:'JP',Sweden:'SE',Belgium:'BE',Spain:'ES'};
const valid=new Set(['POP_CULTURE','SPORTS','TCG','MUSIC','JEWELRY_APPAREL','GAMES','BUILT_BOTANY','MISC','AUTOMOTIVE','ART']);
const svc=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
async function readAll(){let rows=[];for(let offset=0;;offset+=1000){const {data,error}=await svc.from('collector_events').select('*').order('id').range(offset,offset+999);if(error)throw error;rows.push(...data);if(data.length<1000)return rows;}}
async function main(){
 const facts=['specialist-events.json','specialist-supplement.json'].flatMap(f=>JSON.parse(fs.readFileSync(`scripts/data/${f}`,'utf8')));
 const existing=await readAll(), seen=[...existing],inserts=[],updates=[],duplicates=[];
 for(const e of facts){
  assert(e.name&&e.source&&e.website&&e.universes.length);
  for(const u of e.universes)assert(valid.has(u),`Unknown universe ${u}`);
  for(const d of [e.start,e.end])assert.equal(new Date(d).toISOString().slice(0,10),d);
  assert(e.end>=e.start&&e.end>='2026-10-07'&&e.end<='2027-12-31',`Invalid dates: ${e.name}`);
  for(const u of [e.source,e.website])assert(['https:','http:'].includes(new URL(u).protocol));
  const country=countryMap[e.country]||e.country;assert(/^[A-Z]{2}$/.test(country)||['Online','Not listed'].includes(country),`Unknown country ${country}`);
  const hash=crypto.createHash('sha256').update(`${e.sourceId||e.source}|${e.name}|${e.start}`).digest('hex').slice(0,12);
  const slug=`specialist-${norm(e.name).slice(0,65)}-${hash}`;
  const match=seen.find(r=>r.slug===slug||(r.starts_at.slice(0,10)===e.start
   && (nameKey(r.name)===nameKey(e.name)||(e.city&&r.city&&norm(e.city)===norm(r.city)&&urlKey(r.website_url)===urlKey(e.website)))
   && (!r.city||!e.city||norm(r.city)===norm(e.city))));
  if(match){
   const tags=[...new Set([...(match.relevant_universes||[]),...e.universes])];
   if(match.id&&tags.length!==(match.relevant_universes||[]).length){updates.push({id:match.id,relevant_universes:tags});match.relevant_universes=tags;}
   duplicates.push(e.name);continue;
  }
  const row={slug,name:e.name,starts_at:`${e.start}T00:00:00.000Z`,ends_at:`${e.end}T23:59:59.000Z`,city:e.city||null,state_region:e.region||null,country,venue_name:e.venue||null,venue_address:e.address||null,event_type:country==='US'?'national':'international',website_url:e.website,short_desc:`${e.kind}${e.city&&e.city!=='Online'?` in ${e.city}`:''}.`,long_desc:`Source: ${e.source}\nDates checked October 7, 2026. Check the organizer for current hours, admission, eligibility and venue details.`,relevant_universes:e.universes,emoji:e.universes.includes('BUILT_BOTANY')?'🌿':e.universes.includes('MUSIC')?'🎸':'🎟️'};
  inserts.push(row);seen.push(row);
 }
 const report={facts:facts.length,inserts:inserts.length,tagUpdates:updates.length,duplicates,byUniverse:Object.fromEntries([...valid].map(u=>[u,inserts.filter(r=>r.relevant_universes.includes(u)).length])),rows:inserts};
 fs.writeFileSync('scripts/data/specialist-import-preview.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report,rows:undefined,duplicates:duplicates.length}));
 if(!process.argv.includes('--apply'))return;
 fs.writeFileSync(`scripts/data/events-backup-${Date.now()}.json`,JSON.stringify(existing,null,2));
 for(let i=0;i<inserts.length;i+=100){const {error}=await svc.from('collector_events').insert(inserts.slice(i,i+100));if(error)throw error;}
 for(const u of updates){const {error}=await svc.from('collector_events').update({relevant_universes:u.relevant_universes}).eq('id',u.id);if(error)throw error;}
 const after=await readAll();for(const row of inserts)assert(after.some(r=>r.slug===row.slug),`Missing ${row.name}`);
 console.log(`Verified ${inserts.length} new events; ${after.length} total listings.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
