// Dated facts checked against the linked organizers on 2026-10-07.
const fs = require('node:fs');
const rows=[];
function add(name,start,end,city,region,country,venue,universes,kind,source){rows.push({name,start,end,city,region,country,venue,universes,kind,source,website:source});}
const plant='https://www.plantcon.org/';
add('PlantCon Houston','2026-10-17','2026-10-18','Houston','TX','US','Reliant Center, Hall D',['BUILT_BOTANY'],'Plant convention',plant);
add('PlantCon Dallas','2026-10-24','2026-10-25','Dallas','TX','US','Kay Bailey Hutchison Convention Center',['BUILT_BOTANY'],'Plant convention',plant+'dallas');
add('PlantCon Atlanta','2026-12-05','2026-12-06','Atlanta','GA','US','Atlanta Convention Center at AmericasMart',['BUILT_BOTANY'],'Plant convention',plant);
const art='https://www.artbasel.com/about/application';
add('Art Basel Paris','2026-10-23','2026-10-25','Paris',null,'FR',null,['ART'],'Art fair',art);
add('Art Basel Miami Beach','2026-12-04','2026-12-06','Miami Beach','FL','US',null,['ART'],'Art fair',art);
add('Art Basel Qatar','2027-01-28','2027-01-30',null,null,'QA',null,['ART'],'Art fair',art);
add('Art Basel Hong Kong','2027-03-25','2027-03-27','Hong Kong',null,'HK',null,['ART'],'Art fair',art);
add('Art Basel Basel','2027-06-17','2027-06-20','Basel',null,'CH',null,['ART'],'Art fair',art);
const prop='https://www.propstore.com/auctions.action';
add('Propstore: Blade Runner 2049 Final Online Auction','2026-09-15','2026-10-14','Online',null,'Online',null,['POP_CULTURE'],'Movie memorabilia auction',prop);
add('Propstore: James Bond Online Auction – London','2026-10-06','2026-10-27','London',null,'GB','Online',['POP_CULTURE'],'Movie memorabilia auction',prop);
add('Propstore: Collectible Posters Live Auction – Los Angeles','2026-10-09','2026-10-11','Los Angeles','CA','US',null,['POP_CULTURE','ART'],'Collectible poster auction',prop);
add('Propstore: The Wheel of Time Online Auction','2026-10-12','2026-10-28','Online',null,'Online',null,['POP_CULTURE'],'TV memorabilia auction',prop);
add('Propstore: Entertainment Memorabilia Live Auction – London Winter','2026-12-04','2026-12-06','London',null,'GB',null,['POP_CULTURE'],'Movie memorabilia auction',prop);
const sneakers='https://sneakercon.com/';
add('Sneaker Con Macau','2026-10-10','2026-10-11','Macau',null,'MO','Grand Lisboa Palace Resort, Great Hall',['JEWELRY_APPAREL'],'Sneaker convention',sneakers);
add('Sneaker Con Los Angeles','2026-10-17','2026-10-18','Anaheim','CA','US','Anaheim Convention Center',['JEWELRY_APPAREL'],'Sneaker convention',sneakers);
add('Sneaker Con Bay Area','2026-11-07','2026-11-08','Santa Clara','CA','US','Santa Clara Convention Center',['JEWELRY_APPAREL'],'Sneaker convention',sneakers);
add('Sneaker Con Osaka','2026-12-19','2026-12-19','Osaka',null,'JP','MYDOME Osaka',['JEWELRY_APPAREL'],'Sneaker convention',sneakers);
add('Windup Watch Fair New York','2026-10-16','2026-10-18','New York','NY','US','Center415',['JEWELRY_APPAREL'],'Watch fair','https://windupwatchfair.com/news/windup-watch-fair-nyc-2026-the-biggest-watch-fair-around-just-got-bigger');
const money='https://www.money.org/events/future-conventions/';
add('ANA National Money Show','2027-03-04','2027-03-06','Virginia Beach','VA','US',null,['MISC'],'Coin convention',money);
add('ANA World’s Fair of Money','2027-08-10','2027-08-14','Rosemont','IL','US','Donald E. Stephens Convention Center',['MISC'],'Coin convention',money);
add('World Money Fair','2027-01-28','2027-01-30','Berlin',null,'DE','Estrel Congress Center',['MISC'],'Coin convention','https://worldmoneyfair.de/en/exhibit-2027/');
add('Great American Stamp Show','2027-08-19','2027-08-22','Albuquerque','NM','US',null,['MISC'],'Stamp convention','https://stamps.org/news/c/news/cat/aps-news/post/aps-announces-location-of-gass-2027');
add('Gen Con','2027-08-05','2027-08-08','Indianapolis','IN','US','Indiana Convention Center and Lucas Oil Stadium',['GAMES','TCG'],'Tabletop gaming convention','https://www.gencon.com/attend/futuredates');
add('PAX Unplugged','2026-12-04','2026-12-06','Philadelphia','PA','US',null,['GAMES','TCG'],'Tabletop gaming convention','https://unplugged.paxsite.com/');
add('Pinball Expo','2026-10-14','2026-10-17',null,'IL','US',null,['GAMES'],'Pinball convention','https://pinballexpo.com/');
add('SEMA Show','2026-11-03','2026-11-06','Las Vegas','NV','US','Las Vegas Convention Center',['AUTOMOTIVE'],'Automotive trade show','https://semashow.com/');
add('The NAMM Show','2027-01-26','2027-01-30','Anaheim','CA','US','Anaheim Convention Center',['MUSIC'],'Music equipment show','https://www.namm.org/thenammshow/show-information-policies');
const countries={'United States':'US',Canada:'CA',Peru:'PE',Mexico:'MX',Ecuador:'EC',Colombia:'CO',Taiwan:'TW',Guatemala:'GT'};
const iso=s=>{const [m,d,y]=s.split('/');return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`};
for(const e of JSON.parse(fs.readFileSync('scripts/data/orchid-shows.json','utf8'))){
 const start=iso(e.StartDate),end=iso(e.EndDate);if(end<'2026-10-07'||end>'2027-12-31')continue;
 if(!countries[e.Country])throw Error(`Unmapped country ${e.Country}`);
 rows.push({name:e.LocationName,start,end,city:null,region:e.StateProvince,country:countries[e.Country],venue:null,address:e.Location,universes:['BUILT_BOTANY'],kind:'Orchid show',source:'https://www.aos.org/community-events/calendar',website:'https://www.aos.org/community-events/calendar',sourceId:`aos-${e.ID}`});
}
fs.writeFileSync('scripts/data/specialist-supplement.json',JSON.stringify(rows,null,2));
console.log(`Prepared ${rows.length} organizer listings`);
