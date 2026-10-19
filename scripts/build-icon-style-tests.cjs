// Small-size vector studies: preserve open interiors instead of blurring bright strokes.
const fs=require('node:fs');
const path=require('node:path');
const out=path.join(__dirname,'../public/ui/icon-themes/sharp-glass-test-v1');
const wrap=(defs,art)=>`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none"><defs>${defs}</defs>${art}</svg>\n`;
const home='<path d="M4 14 16 3 28 14M7 12v16h6v-8h6v8h6V12"/>';
const vault='<circle cx="17" cy="16" r="12"/><path d="M17 9v7l-5 4m5-4 5 4"/><circle cx="17" cy="16" r="2.5"/><path d="M3 9h4v4H3zm0 10h4v4H3z"/>';
for(const style of ['neon','duotone']){
 const defs=style==='duotone'?'<linearGradient id="ink" x1="3" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse"><stop stop-color="#27e3ff"/><stop offset=".45" stop-color="#4e85ff"/><stop offset=".72" stop-color="#a46bff"/><stop offset="1" stop-color="#fc46e3"/></linearGradient>':'';
 const color=style==='duotone'?'url(#ink)':'#37dafa';
 for(const [name,art] of [['dashboard',home],['vault',vault]]){
  const body=`<g stroke-linecap="round" stroke-linejoin="round"><g stroke="#08172c" stroke-width="3.5">${art}</g><g stroke="${color}" stroke-width="2">${art}</g><g stroke="${color}" stroke-width="4" opacity=".12">${art}</g></g>`;
  fs.writeFileSync(path.join(out,`${name}-${style}.svg`),wrap(defs,body));
 }
}
const defs='<linearGradient id="face" x1="5" y1="3" x2="25" y2="29" gradientUnits="userSpaceOnUse"><stop stop-color="#f184ff"/><stop offset=".3" stop-color="#9142f0"/><stop offset=".6" stop-color="#3f2cbd"/><stop offset="1" stop-color="#15c4f6"/></linearGradient><linearGradient id="rim" x1="4" y1="3" x2="25" y2="29" gradientUnits="userSpaceOnUse"><stop stop-color="#f4baff"/><stop offset=".5" stop-color="#6d67ff"/><stop offset="1" stop-color="#5be5ff"/></linearGradient>';
const glassHome='<path d="m3 14 13-12 13 12-3 3-10-9L6 17Z" fill="url(#face)" stroke="#392364" stroke-width=".7"/><path d="m4 14 12-11 12 11" stroke="url(#rim)" stroke-width="1"/><path d="M6 17h4v9h3v-8h6v8h3v-9h4v13H6Z" fill="url(#face)" stroke="#392364" stroke-width=".7"/><path d="M6.5 18v11h6M19 29h6.5V18" stroke="url(#rim)" stroke-width="1"/>';
const glassVault='<circle cx="17" cy="16" r="13" fill="url(#face)" stroke="#392364" stroke-width="1"/><circle cx="17" cy="16" r="11.5" stroke="url(#rim)" stroke-width="1"/><circle cx="17" cy="16" r="8" fill="#161236"/><path d="M17 9v7l-5 4m5-4 5 4" stroke="url(#rim)" stroke-width="2.5" stroke-linecap="round"/><circle cx="17" cy="16" r="3" fill="url(#face)" stroke="#c890ff" stroke-width=".8"/><rect x="2" y="8" width="5" height="5" rx="1" fill="url(#face)" stroke="url(#rim)" stroke-width=".8"/><rect x="2" y="19" width="5" height="5" rx="1" fill="url(#face)" stroke="url(#rim)" stroke-width=".8"/>';
fs.writeFileSync(path.join(out,'dashboard-violet.svg'),wrap(defs,glassHome));
fs.writeFileSync(path.join(out,'vault-violet.svg'),wrap(defs,glassVault));
console.log('Wrote six icon style studies.');
