// Actual bookmark/activity modules, isolated simulated localStorage + account. No real account writes.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),results=[],sourceHashes={};
const original={window:global.window,localStorage:global.localStorage};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const memory=new Map(),db=new Map(),listeners=new Map(); let online=true,readGate=null,writeGate=null,writeFailure=false;
  const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
  global.window={localStorage:storage,addEventListener:(name,fn)=>listeners.set(name,fn)};global.localStorage=storage;
  storage.setItem('vltd_active_profile_id_v1','profile-A');
  storage.setItem('test-user','user-A');
  class Query{
    constructor(table){this.table=table;this.mode='select';this.filters=[];}
    select(){return this;}eq(k,v){this.filters.push([k,v]);return this;}order(){return this;}limit(){return this;}
    upsert(row){this.mode='upsert';this.row=row;return this;}delete(){this.mode='delete';return this;}
    async run(){
      if(!online)return{data:null,error:{message:'synthetic offline'}};
      if(this.mode==='select'&&readGate)await readGate;
      if(this.mode!=='select'&&writeGate)await writeGate;
      if(this.mode!=='select'&&writeFailure)return{data:null,error:{message:'synthetic write refusal'}};
      const rows=db.get(this.table)??[];const match=r=>this.filters.every(([k,v])=>r[k]===v);
      if(this.mode==='select')return{data:rows.filter(match).map(r=>({...r})),error:null};
      if(this.mode==='delete'){db.set(this.table,rows.filter(r=>!match(r)));return{data:null,error:null};}
      const identity=this.table==='saved_events'?'event_id':this.table==='saved_articles'?'slug':'id';
      db.set(this.table,[...rows.filter(r=>!(r.profile_id===this.row.profile_id&&r[identity]===this.row[identity])),{...this.row}]);
      return{data:null,error:null};
    }
    then(ok,bad){return this.run().then(ok,bad);}
  }
  const client={from:table=>new Query(table)};
  const mocks={
    './legacyKeys':{mayAdoptLegacyKey:()=>false},
    '@/lib/supabaseClient':{getSupabaseBrowserClient:()=>client},
    '@/lib/sessionGuard':{captureIdentity:()=>{const pid=storage.getItem('vltd_active_profile_id_v1'),user=storage.getItem('test-user');return()=>storage.getItem('vltd_active_profile_id_v1')===pid&&storage.getItem('test-user')===user;}},
  };
  const modules=new Map();
  function load(relative){if(modules.has(relative))return modules.get(relative);const source=fs.readFileSync(path.join(root,relative),'utf8');sourceHashes[relative]=crypto.createHash('sha256').update(source).digest('hex');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(name=>{if(name in mocks)return mocks[name];if(name.startsWith('@/'))return load('src/'+name.slice(2)+'.ts');throw Error('Unstubbed '+name);},m,m.exports);modules.set(relative,m.exports);return m.exports;}
  return{storage,db,load,clearModules:()=>modules.clear(),setOnline:v=>online=v,setGate:v=>readGate=v,setWriteGate:v=>writeGate=v,setWriteFailure:v=>writeFailure=v,reconnect:()=>{online=true;listeners.get('online')?.();}};
}
async function check(id,name,fn){try{const detail=await fn();results.push({id,name,result:'PASS',detail});}catch(e){results.push({id,name,result:'FAIL',detail:e.message});}}
async function bookmarks(kind){
  const event=kind==='event',prefix=event?'SE':'SA',table=event?'saved_events':'saved_articles',field=event?'event_id':'slug',base=event?'vltd_saved_event_ids_v1':'vltd_saved_articles';
  function setup(){const f=fixture(),file=event?'src/lib/savedEventsModel.ts':'src/lib/savedArticles.ts';let m=f.load(file);return{...f,toggle:id=>(event?m.toggleSavedEvent:m.toggleSavedArticle)(id),load:()=>(event?m.loadSavedEventIds:m.loadSavedArticles)(),sync:()=>(event?m.syncSavedEventIdsFromSupabase:m.syncSavedArticlesFromSupabase)(),reload:()=>{f.clearModules();m=f.load(file);}};}
  const row=(id,pid='profile-A')=>({profile_id:pid,[field]:id});
  await check(prefix+'-01','Online '+kind+' save persists locally and in account',async()=>{const f=setup();f.toggle('first');await tick();assert.deepEqual(f.load(),['first']);assert.equal(f.db.get(table)[0][field],'first');assert.deepEqual(await f.sync(),['first']);});
  await check(prefix+'-02','Online '+kind+' removal deletes account row',async()=>{const f=setup();f.toggle('first');await tick();f.toggle('first');await tick();assert.deepEqual(f.load(),[]);assert.equal(f.db.get(table).length,0);});
  await check(prefix+'-03','Offline '+kind+' add reaches an account that already has another bookmark',async()=>{
    const f=setup();f.db.set(table,[row('existing')]);f.setOnline(false);f.toggle('new-offline');await tick();f.setOnline(true);const synced=await f.sync();await tick();
    assert.ok(synced.includes('new-offline'),'New offline bookmark disappeared from the returned saved list');
    assert.ok(f.db.get(table).some(r=>r[field]==='new-offline'),'New offline bookmark remains device-only after successful account sync');
  });
  await check(prefix+'-04','Offline '+kind+' removal stays removed after reconnection',async()=>{
    const f=setup();f.db.set(table,[row('remove-me'),row('keep')]);f.storage.setItem(base+':profile-A',JSON.stringify(['remove-me','keep']));f.setOnline(false);f.toggle('remove-me');await tick();f.setOnline(true);const synced=await f.sync();await tick();
    assert.equal(synced.includes('remove-me'),false,'Removed offline bookmark returned from the account');assert.equal(f.db.get(table).some(r=>r[field]==='remove-me'),false);
  });
  await check(prefix+'-05','Last '+kind+' bookmark removed on another device is not recreated',async()=>{
    const f=setup();f.db.set(table,[row('old')]);await f.sync(); // Browser A has seen the account row.
    f.db.set(table,[]); // Browser B successfully removes it.
    const synced=await f.sync();await tick();assert.deepEqual(synced,[],'Stale browser keeps the remotely deleted bookmark');assert.equal((f.db.get(table)??[]).length,0,'Stale browser re-created deleted account row');
  });
  await check(prefix+'-06','Failed '+kind+' read preserves device saves',async()=>{const f=setup();f.storage.setItem(base+':profile-A',JSON.stringify(['local']));f.setOnline(false);assert.deepEqual(await f.sync(),['local']);});
  await check(prefix+'-07','Profile switch during '+kind+' read cannot overwrite the next profile cache',async()=>{
    const f=setup();f.db.set(table,[row('from-A')]);let release;f.setGate(new Promise(r=>release=r));const pending=f.sync();await tick();f.storage.setItem('vltd_active_profile_id_v1','profile-B');f.storage.setItem(base+':profile-B',JSON.stringify(['from-B']));release();await pending;await tick();assert.deepEqual(f.load(),['from-B']);assert.equal((f.db.get(table)??[]).some(r=>r.profile_id==='profile-B'),false);
  });
  await check(prefix+'-08','First migration of unsynced '+kind+' saves into an empty account works',async()=>{const f=setup();f.storage.setItem(base+':profile-A',JSON.stringify(['legacy']));await f.sync();await tick();assert.equal(f.db.get(table)[0][field],'legacy');});
  await check(prefix+'-09','Offline '+kind+' removal survives a module reload',async()=>{const f=setup();f.db.set(table,[row('old')]);await f.sync();f.setOnline(false);f.toggle('old');await tick();f.reload();f.setOnline(true);assert.deepEqual(await f.sync(),[]);assert.equal(f.db.get(table).length,0);});
  await check(prefix+'-10','Offline '+kind+' addition survives a module reload',async()=>{const f=setup();f.setOnline(false);f.toggle('new');await tick();f.reload();f.setOnline(true);assert.deepEqual(await f.sync(),['new']);assert.equal(f.db.get(table).length,1);});
  await check(prefix+'-11','Failed '+kind+' write stays pending and retries',async()=>{const f=setup();f.setWriteFailure(true);f.toggle('new');await tick();await f.sync();assert.deepEqual(f.load(),['new']);assert.equal((f.db.get(table)??[]).length,0);f.setWriteFailure(false);await f.sync();assert.equal(f.db.get(table).length,1);});
  await check(prefix+'-12','Remote '+kind+' removal with other rows does not return',async()=>{const f=setup();f.db.set(table,[row('old'),row('keep')]);await f.sync();f.db.set(table,[row('keep')]);assert.deepEqual(await f.sync(),['keep']);});
  await check(prefix+'-13','Rapid '+kind+' on then off respects the newest choice',async()=>{const f=setup();let release;f.setWriteGate(new Promise(r=>release=r));f.toggle('rapid');await tick();f.toggle('rapid');release();await tick();await f.sync();assert.deepEqual(f.load(),[]);assert.equal(f.db.get(table).length,0);});
  await check(prefix+'-14','Reconnect automatically flushes pending '+kind+' saves',async()=>{const f=setup();f.setOnline(false);f.toggle('new');await tick();f.reconnect();await tick();assert.equal(f.db.get(table).length,1);});
  await check(prefix+'-15','User switch during '+kind+' read cannot upload stale data',async()=>{const f=setup();f.storage.setItem(base+':profile-A',JSON.stringify(['local']));let release;f.setGate(new Promise(r=>release=r));const pending=f.sync();await tick();f.storage.setItem('test-user','user-B');release();await pending;assert.equal((f.db.get(table)??[]).length,0);});
}
async function activity(){
  await check('AE-01','Activity writes a normal event locally and to account',async()=>{const f=fixture(),m=f.load('src/lib/activityEvents.ts');await m.addActivityEvent({id:'event-1',kind:'share',title:'Shared QA exhibition',timestamp:1});assert.equal(m.loadActivityEvents().length,1);assert.equal(f.db.get('activity_events').length,1);});
  await check('AE-02','Failed Activity read preserves the local timeline',async()=>{const f=fixture(),m=f.load('src/lib/activityEvents.ts');f.setOnline(false);await m.addActivityEvent({id:'event-1',kind:'share',title:'Shared QA exhibition',timestamp:1});assert.equal((await m.syncActivityEventsFromSupabase()).length,1);});
  await check('AE-03','An offline Activity entry survives successful reconnection',async()=>{
    const f=fixture(),m=f.load('src/lib/activityEvents.ts');f.setOnline(false);await m.addActivityEvent({id:'event-1',kind:'share',title:'Shared QA exhibition',timestamp:1});assert.equal(m.loadActivityEvents().length,1);f.setOnline(true);const synced=await m.syncActivityEventsFromSupabase();assert.equal(synced.some(r=>r.id==='event-1'),true,'Successful empty cloud read deleted the unsent local Activity event');assert.equal(m.loadActivityEvents().some(r=>r.id==='event-1'),true);
  });
  await check('AE-04','Activity read stays profile-scoped',async()=>{const f=fixture(),m=f.load('src/lib/activityEvents.ts');f.db.set('activity_events',[{id:'A',profile_id:'profile-A',title:'Own',kind:'share',created_at:'2026-01-01'},{id:'B',profile_id:'profile-B',title:'Other',kind:'share',created_at:'2026-01-01'}]);const rows=await m.syncActivityEventsFromSupabase();assert.deepEqual(rows.map(r=>r.id),['A']);});
  await check('AE-05','Activity queue survives reload and uploads once',async()=>{const f=fixture();let m=f.load('src/lib/activityEvents.ts');f.setOnline(false);await m.addActivityEvent({id:'offline',kind:'share',title:'QA',timestamp:1});f.clearModules();m=f.load('src/lib/activityEvents.ts');f.setOnline(true);await m.syncActivityEventsFromSupabase();await m.syncActivityEventsFromSupabase();assert.equal(f.db.get('activity_events').length,1);assert.equal(m.loadActivityEvents().length,1);});
  await check('AE-06','Activity write refusal preserves the entry for retry',async()=>{const f=fixture(),m=f.load('src/lib/activityEvents.ts');f.setWriteFailure(true);await m.addActivityEvent({id:'retry',kind:'share',title:'QA',timestamp:1});assert.equal((await m.syncActivityEventsFromSupabase()).length,1);f.setWriteFailure(false);await m.syncActivityEventsFromSupabase();assert.equal(f.db.get('activity_events').length,1);});
  await check('AE-07','Activity reconnect automatically retries the outbox',async()=>{const f=fixture(),m=f.load('src/lib/activityEvents.ts');f.setOnline(false);await m.addActivityEvent({id:'online',kind:'share',title:'QA',timestamp:1});f.reconnect();await tick();assert.equal(f.db.get('activity_events').length,1);});
  await check('AE-08','Activity profile switch cannot write the next profile cache',async()=>{const f=fixture(),m=f.load('src/lib/activityEvents.ts');f.db.set('activity_events',[{id:'A',profile_id:'profile-A',title:'Own',kind:'share',created_at:'2026-01-01'}]);let release;f.setGate(new Promise(r=>release=r));const pending=m.syncActivityEventsFromSupabase();await tick();f.storage.setItem('vltd_active_profile_id_v1','profile-B');release();await pending;assert.deepEqual(m.loadActivityEvents(),[]);});
}
async function main(){try{await bookmarks('event');await bookmarks('article');await activity();}finally{for(const[k,v]of Object.entries(original)){if(v===undefined)delete global[k];else global[k]=v;}}
  const output={date:'2026-11-06',scope:'Actual savedEventsModel, savedArticles and activityEvents modules; simulated browser/account only; no UI, production mutations or network',sourceHashes,passed:results.filter(r=>r.result==='PASS').length,failed:results.filter(r=>r.result==='FAIL').length,results};
  if(process.env.SAVED_SYNC_RESULT_FILE)fs.writeFileSync(process.env.SAVED_SYNC_RESULT_FILE,JSON.stringify(output,null,2)+'\n');results.forEach(r=>console.log(`${r.result} ${r.id} ${r.name}${r.result==='FAIL'?': '+r.detail:''}`));console.log(JSON.stringify({passed:output.passed,failed:output.failed}));process.exitCode=output.failed?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
