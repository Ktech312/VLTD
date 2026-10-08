// Synthetic records only: no account, production data, or paid AI calls.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const filename = path.join(__dirname, '..', 'src', 'lib', `${name}.ts`);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  cache.set(name, exports);
  vm.runInNewContext(code, {
    exports,
    require: (id) => {
      assert.match(id, /^@\/lib\/[\w-]+$/);
      return load(id.slice('@/lib/'.length));
    },
  }, { filename });
  return exports;
}
const { rowsToCsv } = load('exportCsv');
assert.equal(
  rowsToCsv([{ title: 'Card, "foil"', notes: 'line 1\nline 2', value: 0 }], ['title', 'notes', 'value']),
  'title,notes,value\n"Card, ""foil""","line 1\nline 2",0\n',
);
const { buildInsurancePdfHtml } = load('insurancePdf');
const html = buildInsurancePdfHtml([
  { id: 'synthetic-1', title: '<Sample & Card>', universe: 'TCG', currentValue: 125, notes: '<script>not markup</script>' },
  { id: 'synthetic-2', title: 'Sample comic', universe: 'POP_CULTURE', currentValue: 75 },
], { collectorName: 'Synthetic test', asOfDate: '2026-09-27', includeNotes: true });
assert.match(html, /&lt;Sample &amp; Card&gt;/);
assert.match(html, /\$200/);
assert.match(html, /not a certified appraisal/);
assert.doesNotMatch(html, /<script>not markup/);
// The Account button must use the shared exporter, not a retired storage key.
const account=fs.readFileSync(path.join(__dirname,'../src/app/account/page.tsx'),'utf8');
assert.match(account,/import \{ exportVaultJson \} from "@\/lib\/vaultExport"/);
assert.doesNotMatch(account,/getItem\("vltd_items_v2"\)/);
let exportedBlob,downloaded=false;
const exportModule={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/vaultExport.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports:exportModule,Blob,Date,JSON,
 require:id=>id==='@/lib/vaultModel'?{loadItems:options=>{assert.equal(options.includeAllProfiles,true);return [{id:'synthetic-export',title:'Export test'}];}}:{downloadCsv(){}},
 URL:{createObjectURL:blob=>{exportedBlob=blob;return 'blob:test';},revokeObjectURL(){}},
 document:{createElement:()=>({click(){downloaded=true;}})},
});
exportModule.exportVaultJson();
assert(downloaded);
exportedBlob.text().then(text=>{const payload=JSON.parse(text);assert.equal(payload.items.length,1);assert.equal(payload.items[0].id,'synthetic-export');console.log('PASS: Account JSON export uses current Vault data.');}).catch(error=>{console.error(error);process.exitCode=1;});
console.log('PASS: CSV special characters and zero values; insurance document stated totals, escaped content and appraisal qualification. Browser download/printing and insurer acceptance remain separate checks.');
