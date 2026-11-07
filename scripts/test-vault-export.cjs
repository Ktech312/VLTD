// Actual export modules with in-memory downloads; no outside requests.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function load(file,mocks){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;new Function('require','module','exports',code)(name=>{if(name in mocks)return mocks[name];throw Error('Unexpected import '+name);},m,m.exports);return m.exports;}
const original={window:global.window,document:global.document,fetch:global.fetch};
let csv,zip,downloads,messages,items,failed;
class Zip{constructor(){zip=new Map();}folder(name){return{file:(name2,blob)=>zip.set(name+'/'+name2,blob)};}async generateAsync(){return new Blob(['fixture ZIP']);}}
global.window={JSZip:Zip};global.document={createElement:()=>({click(){downloads.push(this.download);}})};
global.fetch=async url=>new Response('fixture-image',{status:failed.has(url)?404:200,headers:{'content-type':'image/png'}});
const exportModule=load('src/lib/vaultExport.ts',{
 '@/lib/exportCsv':{downloadCsv:(filename,rows,columns)=>{csv={filename,rows,columns};}},
 '@/lib/vaultModel':{loadItems:()=>items,syncVaultItemsFromSupabaseChecked:async()=>({ok:true,items})},
 '@/lib/toast':{showToast:message=>messages.push(message)},
});
const photos=load('src/components/VaultExportButton.tsx',{
 'react':{useState:()=>{}},'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},
 '@/components/InsurancePdfButton':{default:()=>null},
 '@/lib/vaultExport':exportModule,'@/lib/vaultModel':{loadItems:()=>items},
 '@/lib/vaultCloud':{getVaultImagePublicUrl:key=>'https://fixture.test/'+key},
 '@/lib/toast':{showToast:message=>messages.push(message)},
});
let pass=0,fail=0;
async function check(name,fn){csv=null;zip=null;downloads=[];messages=[];failed=new Set();items=[];try{await fn();console.log('PASS '+name);pass++;}catch(e){console.error('FAIL '+name+': '+e.message);fail++;}}
const pictured=(id,title='Duplicate')=>({id,title,universe:'MUSIC',imageFrontUrl:'https://fixture.test/'+id+'.png'});
(async()=>{try{
 await check('CSV preserves storage location, cents, blank and zero',async()=>{items=[{id:'a',title:'Spëcial "quote", title',storageLocation:'Room / Shelf 2',purchasePrice:12.34},{id:'b',purchasePrice:0},{id:'c'}];await exportModule.exportVaultCsv();assert.ok(csv.columns.includes('storageLocation'));assert.equal(csv.rows[0].storageLocation,'Room / Shelf 2');assert.equal(csv.rows[0].purchasePrice,12.34);assert.equal(csv.rows[1].purchasePrice,0);assert.equal(csv.rows[2].purchasePrice,undefined);});
 await check('Same-title, same-prefix item photos never overwrite one another',async()=>{items=[pictured('item_20261107_a'),pictured('item_20261107_b'),pictured('item_20261107_c')];await photos.downloadPhotosZip(items,message=>messages.push(message));assert.equal(zip.size,3);assert.equal(downloads.length,1);assert.equal(messages.at(-1),'Done');});
 await check('Only the main photo is exported, matching the menu promise',async()=>{items=[{...pictured('a'),images:[{role:'primary',url:'https://fixture.test/main.png'},{role:'secondary',url:'https://fixture.test/back.png'}]}];await photos.downloadPhotosZip(items,message=>messages.push(message));assert.equal(zip.size,1);});
 await check('Sanitized duplicate titles and IDs still have unique safe ZIP paths',async()=>{items=[pictured('../same','!!!'),pictured('../same','!!!')];await photos.downloadPhotosZip(items,message=>messages.push(message));assert.equal(zip.size,2);for(const name of zip.keys()){assert.ok(!name.includes('..'));assert.equal(name.split('/').length,2);}});
 await check('Partial photo failure reports the actual count, not Done',async()=>{items=[pictured('good'),pictured('bad')];failed.add(items[1].imageFrontUrl);await photos.downloadPhotosZip(items,message=>messages.push(message));assert.equal(zip.size,1);assert.match(messages.at(-1),/Downloaded 1 of 2/);assert.equal(downloads.length,1);});
 await check('Total photo failure does not download an empty success ZIP',async()=>{items=[pictured('bad')];failed.add(items[0].imageFrontUrl);await photos.downloadPhotosZip(items,message=>messages.push(message));assert.equal(downloads.length,0);assert.match(messages.at(-1),/No photos could be downloaded/);});
 await check('Items without photos do not create fake image entries',async()=>{items=[{id:'no-photo',title:'Unknown'}];await photos.downloadPhotosZip(items,message=>messages.push(message));assert.equal(downloads.length,0);assert.ok(messages.includes('No items with photos found.'));});
 }finally{for(const[key,value]of Object.entries(original)){if(value===undefined)delete global[key];else global[key]=value;}}
 console.log(JSON.stringify({passed:pass,failed:fail}));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
