// One-shot factual import. Preview by default; --apply writes the reviewed batch.
const fs = require('node:fs');
const assert = require('node:assert/strict');
require('@next/env').loadEnvConfig(process.cwd());
const { createClient } = require('@supabase/supabase-js');
const dir = 'scripts/data';
const decode = s => s.replace(/<[^>]*>/g, '').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&apos;/g, "'").trim();
const us = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '));
const ca = new Set('AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' '));
const countries = { Inverness:'GB', London:'GB', Newbridge:'GB', Glasgow:'GB', Mitcham:'GB', Epsom:'NZ', Bruxelles:'BE', Derendingen:'CH', Basel:'CH', 'Brno-střed':'CZ', Wien:'AT', Dornbirn:'AT', 'Kuala Lumpur':'MY', 'North Wall':'IE' };
function date(s) {
  const m = s.match(/^([A-Za-z]+)\.? (\d{1,2}), (\d{4})$/);
  assert(m, `Invalid date: ${s}`);
  const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].slice(0,3).toLowerCase()) + 1;
  assert(month > 0);
  const iso = `${m[3]}-${String(month).padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  assert.equal(new Date(iso).toISOString().slice(0,10), iso);
  return iso;
}
function urlKey(s) { if (!s) return ''; const u = new URL(s); return u.hostname.replace(/^www\./,'') + u.pathname.replace(/\/en-us\.html$|\/$/g,''); }
async function main() {
  const html = fs.readFileSync(`${dir}/freshcomics-2026-10-07.html`,'utf8').split('<h3')[0];
  const chunks = html.split('<div class="row border-top m-0 py-3">').slice(1);
  const rows = chunks.map(chunk => {
    const heading = chunk.match(/<h6><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h6>/);
    const dates = chunk.match(/([A-Za-z]+\.? \d{1,2}, \d{4}(?: to [A-Za-z]+\.? \d{1,2}, \d{4})?)\s*<a href="\/convention\/([^\"]+)\.ics"/);
    const loc = chunk.match(/bi-geo-alt-fill[^>]*><\/i>\s*([^<]+)/);
    const website = chunk.match(/href="([^"]+)"[^>]*><i class="bi bi-globe-americas-fill/);
    assert(heading && dates && loc && website, 'Incomplete source row');
    const [start, end = start] = dates[1].split(' to ').map(date);
    const location = decode(loc[1]); const split = location.lastIndexOf(',');
    const city = location.slice(0,split).trim(); const region = location.slice(split+1).trim();
    const country = us.has(region) ? 'US' : ca.has(region) ? 'CA' : countries[city];
    assert(country, `Unknown country: ${location}`);
    assert(end >= start && end >= '2026-10-07');
    return {slug:`freshcomics-${dates[2]}`,name:decode(heading[2]),starts_at:`${start}T00:00:00.000Z`,ends_at:`${end}T23:59:59.000Z`,city,state_region:region==='None'?null:region,country,event_type:country==='US'?'national':'international',website_url:decode(website[1]),short_desc:`${decode(heading[2])} in ${[city,region==='None'?null:region,country].filter(Boolean).join(', ')}.`,long_desc:`Listed by Fresh Comics: https://freshcomics.us${heading[1]}\nCheck the official event website for current hours, admission and venue details.`,relevant_universes:['comics'],emoji:'🎪'};
  });
  assert.equal(rows.length,115,'Source count changed: review before import');
  assert.equal(new Set(rows.map(r=>r.slug)).size, rows.length);
  const svc=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
  const {data:existing,error}=await svc.from('collector_events').select('*'); if(error)throw error;
  const inserts=[],updates=[];
  for(const r of rows){
    const matches=existing.filter(e=>e.slug===r.slug || (e.starts_at.slice(0,10)===r.starts_at.slice(0,10) && (urlKey(e.website_url)===urlKey(r.website_url) || e.name.toLowerCase()===r.name.toLowerCase())));
    assert(matches.length<2,`Ambiguous match ${r.name}`);
    if(matches.length) updates.push({id:matches[0].id,row:{...r,slug:matches[0].slug}}); else inserts.push(r);
  }
  fs.writeFileSync(`${dir}/freshcomics-import-preview.json`,JSON.stringify({source:'https://freshcomics.us/conventions',rows,inserts:inserts.length,updates:updates.map(u=>({id:u.id,name:u.row.name}))},null,2));
  console.log(JSON.stringify({total:rows.length,inserts:inserts.length,updates:updates.map(u=>u.row.name),countries:[...new Set(rows.map(r=>r.country))]}));
  if(!process.argv.includes('--apply'))return;
  fs.writeFileSync(`${dir}/events-before-apply.json`,JSON.stringify(existing,null,2));
  if(inserts.length){const {error}=await svc.from('collector_events').insert(inserts);if(error)throw error;}
  for(const u of updates){const {error}=await svc.from('collector_events').update(u.row).eq('id',u.id);if(error)throw error;}
  const {data:after,error:verifyError}=await svc.from('collector_events').select('*');if(verifyError)throw verifyError;
  for(const r of rows)assert(after.some(e=>e.name===r.name&&e.starts_at.slice(0,10)===r.starts_at.slice(0,10)),`Missing ${r.name}`);
  console.log(`Verified ${rows.length} source conventions; ${after.length} total events.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
