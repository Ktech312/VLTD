// Run the actual Add Item handlers with controlled storage/network failures.
// No camera, browser UI, account, provider or production data is used.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync(process.env.CAPTURE_TEST_SOURCE || 'src/app/capture/page.tsx', 'utf8');
const ast = ts.createSourceFile('capture.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name) {
  let found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer)) found = node.initializer.arguments[0]?.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!found) throw new Error(`Missing real handler ${name}`);
  return ts.transpileModule(`globalThis.handler = ${found}`, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
}
function context() {
  const c = {
    console:{error(){}}, savingRef:{current:false}, pendingSaveIdRef:{current:null},
    fields:{title:'Phone test',subtitle:'Alternate name',brand:'',certCompany:'',grade:'',storageLocation:'',purchasePrice:'',currentValue:''},
    capturedImages:[], identified:false, rows:[], navigations:[], messages:[], ids:0, cleared:0, uploads:0,
    draftScopeRef:{current:'qa:profile'}, navigator:{onLine:true}, window:{setTimeout},
    parseMoneyInput:()=>({ok:true,value:undefined}), newId:()=>`test-${++c.ids}`,
    setSaveError:message=>c.messages.push(message), setSaving:value=>{c.saving=value;},
    persistCapturedImages:async()=>{c.uploads++;if(c.photoFailure)throw Error('Could not decode image.');return {images:[{id:'photo'}]};},
    loadItems:()=>c.rows, saveItem:item=>{c.rows=c.rows.map(row=>row.id===item.id?{...item,profile_id:'qa'}:row);},
    appendItems:items=>{if(c.itemFailure)throw Error('Item write failed'); c.rows.push(...items.map(i=>({...i,profile_id:'qa'})));},
    suggestAutoTags:()=>[],emitVaultUpdate(){},
    enqueueVaultItemSync(){if(c.queueFailure)throw new DOMException('Full','QuotaExceededError');},
    processVaultSyncQueue:async()=>{},hasSupabaseEnv:()=>true,
    upsertVaultItemToSupabase:async item=>{if(c.cloudFailure)throw Error('offline');assert.equal(item.profile_id,'qa');c.sent=item;},
    clearCaptureDraft:async()=>{c.cleared++;},router:{push:path=>c.navigations.push(path)},
  };
  vm.createContext(c);vm.runInContext(handler('handleSave'),c);return c;
}
let passed=0;
async function test(name,fn){if(process.env.CAPTURE_TEST_FILTER && !name.includes(process.env.CAPTURE_TEST_FILTER))return;await fn();console.log('PASS',name);passed++;}
(async()=>{
  await test('Name and alternate name save unchanged',async()=>{const c=context();await c.handler();assert.equal(c.rows.length,1);assert.equal(c.rows[0].subtitle,'Alternate name');assert.equal(c.cleared,1);assert.deepEqual(c.navigations,['/vault']);});
  await test('Uploaded photo is persisted before saving and keeps both names',async()=>{const c=context();c.capturedImages=[{}];await c.handler();assert.equal(c.uploads,1);assert.equal(c.rows[0].images.length,1);assert.equal(c.rows[0].title,'Phone test');assert.equal(c.rows[0].subtitle,'Alternate name');});
  await test('Photo failure keeps fields and draft and identifies the photo step',async()=>{const c=context();c.capturedImages=[{}];c.photoFailure=true;await c.handler();assert.equal(c.rows.length,0);assert.equal(c.cleared,0);assert.match(c.messages.at(-1),/photo/i);assert.equal(c.fields.subtitle,'Alternate name');assert.equal(c.savingRef.current,false);});
  await test('Photo failure can be retried',async()=>{const c=context();c.capturedImages=[{}];c.photoFailure=true;await c.handler();c.photoFailure=false;await c.handler();assert.equal(c.rows.length,1);assert.equal(c.rows[0].id,'test-1');});
  await test('Queue storage failure sends saved profile-scoped row directly',async()=>{const c=context();c.queueFailure=true;await c.handler();assert.equal(c.rows.length,1);assert.equal(c.sent.id,c.rows[0].id);assert.deepEqual(c.navigations,['/vault']);assert.equal(c.cleared,1);});
  await test('Failed account fallback never claims nothing was added',async()=>{const c=context();c.queueFailure=true;c.cloudFailure=true;await c.handler();assert.equal(c.rows.length,1);assert.equal(c.cleared,0);assert.match(c.messages.at(-1),/on this device/);assert.doesNotMatch(c.messages.at(-1),/nothing was added/i);});
  await test('Retry after partial save updates same item instead of adding a duplicate',async()=>{const c=context();c.queueFailure=true;c.cloudFailure=true;await c.handler();c.cloudFailure=false;await c.handler();assert.equal(c.rows.length,1);assert.equal(c.ids,1);assert.equal(c.cleared,1);});
  await test('Item write failure keeps the draft and does not navigate',async()=>{const c=context();c.itemFailure=true;await c.handler();assert.equal(c.rows.length,0);assert.equal(c.cleared,0);assert.equal(c.navigations.length,0);assert.match(c.messages.at(-1),/details are still here/);});
  await test('Rapid repeated Save cannot create two rows',async()=>{const c=context();await Promise.all([c.handler(),c.handler()]);assert.equal(c.rows.length,1);});
  await test('Photo editing replaces selected angle without changing cover or appending',async()=>{
    const c={pendingPhotoIndex:1,capturedImages:['cover','angle'],identified:true,closed:0,
      setCapturedImages(fn){c.capturedImages=fn(c.capturedImages);},setIdentified(value){c.identified=value;},
      handleCapture(){throw Error('Editing must not append');},closeNativeCropEditor(){c.closed++;}};
    vm.createContext(c);vm.runInContext(handler('acceptAdjustedPhoto'),c);c.handler('cropped');assert.deepEqual(c.capturedImages,['cover','cropped']);assert.equal(c.identified,true);assert.equal(c.closed,1);
    c.pendingPhotoIndex=0;c.handler('new-cover');assert.deepEqual(c.capturedImages,['new-cover','cropped']);assert.equal(c.identified,false);
  });
  await test('Cancel closes editor without touching attached photos',async()=>{
    const c={pendingNativeUrl:'blob:test',capturedImages:['cover'],pendingPhotoIndex:0,pendingNativeFile:{},URL:{revokeObjectURL(){}},DEFAULT_NATIVE_CROP:{left:0,top:0,right:0,bottom:0},setPendingNativeFile(v){c.pendingNativeFile=v;},setPendingPhotoIndex(v){c.pendingPhotoIndex=v;},setPendingNativeUrl(v){c.pendingNativeUrl=v;},setPendingNativeCrop(){}};
    vm.createContext(c);vm.runInContext(handler('closeNativeCropEditor'),c);c.handler();assert.deepEqual(c.capturedImages,['cover']);assert.equal(c.pendingPhotoIndex,null);
  });
  console.log(`${passed}/${passed} handler checks passed. These are controlled tests, not physical-phone verification.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
