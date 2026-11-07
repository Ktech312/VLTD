// Real webhook handler; simulated Stripe and database. No provider calls or credentials.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
const root=path.resolve(__dirname,'..');
let event,current,rows,profile,failTier,failLog,badSignature,missingCustomerColumn,updates;
let passed=0,failed=0;
const defaultSub=()=>({id:'sub_fixture',metadata:{profile_id:'qa-profile'},status:'active',current_period_end:1800000000,customer:'cus_fixture',items:{data:[{price:{id:'price_pro'}}]}});
function reset(){current=defaultSub();event={id:'evt_fixture',created:1794000000,type:'customer.subscription.updated',data:{object:current}};rows=new Map();profile={tier:'FREE'};failTier=false;failLog=false;badSignature=false;missingCustomerColumn=0;updates=0;}
const db={from:table=>({
  select(){return this;},eq(){return this;},limit(){return this;},
  update(value){this.op='update';this.value=value;return this;},
  upsert(value,options){assert.equal(options.onConflict,'id');this.op='upsert';this.value=value;return this;},
  then(ok,bad){
    let error=null,data=null;
    if(this.op==='update'){
      updates++;
      if(missingCustomerColumn>0&&this.value.stripe_customer_id){missingCustomerColumn--;error={message:'stripe_customer_id column is missing'};}
      else if(failTier)error={message:'fixture tier write failed'};
      else profile={...profile,...this.value};
    }else if(this.op==='upsert'){
      assert.equal(table,'tier_changes');
      if(failLog)error={message:'fixture history write failed'};
      else {assert.match(this.value.id,/^[\da-f]{8}-[\da-f]{4}-8[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);rows.set(this.value.id,{...this.value});}
    }else data=[profile];
    return Promise.resolve({data,error}).then(ok,bad);
  },
})};
const stripe={webhooks:{constructEvent(){if(badSignature)throw Error('bad signature');return event;}},subscriptions:{retrieve:async()=>current}};
const source=fs.readFileSync(path.join(root,'src/app/api/billing/webhook/route.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleObject={exports:{}};
new Function('require','module','exports',code)(name=>{
  if(name==='next/server')return{NextResponse};
  if(name==='@/lib/stripe')return{isStripeConfigured:()=>true,getStripeClient:()=>stripe,tierForPriceId:id=>id==='price_pro'?'MID':id==='price_business'?'FULL':null};
  if(name==='@supabase/supabase-js')return{createClient:()=>db};
  if(name==='node:crypto')return require('node:crypto');
  throw Error('Unexpected import '+name);
},moduleObject,moduleObject.exports);
const post=()=>moduleObject.exports.POST(new NextRequest('https://vltd.test/api/billing/webhook',{method:'POST',body:'{}'}));
async function check(name,fn){reset();try{await fn();passed++;console.log('PASS',name);}catch(e){failed++;console.log('FAIL',name,e.message);}}
async function main(){
  const previous=Object.fromEntries(['STRIPE_WEBHOOK_SECRET','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'].map(k=>[k,process.env[k]]));
  Object.assign(process.env,{STRIPE_WEBHOOK_SECRET:'fixture',NEXT_PUBLIC_SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'});
  const originalFetch=global.fetch;global.fetch=async()=>{throw Error('Network forbidden in billing test');};
  try{
    await check('invalid signature writes nothing',async()=>{badSignature=true;assert.equal((await post()).status,400);assert.equal(updates,0);assert.equal(rows.size,0);});
    await check('missing event identity is refused',async()=>{delete event.id;assert.equal((await post()).status,400);assert.equal(updates,0);});
    await check('active checkout applies its paid tier',async()=>{event.type='checkout.session.completed';event.data.object={metadata:{profile_id:'qa-profile'},subscription:'sub_fixture',customer:'cus_fixture'};assert.equal((await post()).status,200);assert.equal(profile.tier,'MID');});
    await check('trialing checkout retains its existing paid-tier policy',async()=>{event.type='checkout.session.completed';event.data.object={metadata:{profile_id:'qa-profile'},subscription:'sub_fixture'};current.status='trialing';current.items.data[0].price.id='price_business';assert.equal((await post()).status,200);assert.equal(profile.tier,'FULL');});
    for(const status of ['canceled','unpaid','incomplete','incomplete_expired','past_due','paused'])await check('delayed checkout cannot activate '+status,async()=>{event.type='checkout.session.completed';event.data.object={metadata:{profile_id:'qa-profile'},subscription:'sub_fixture'};current.status=status;assert.equal((await post()).status,200);assert.equal(profile.tier,'FREE');});
    await check('tier write failure returns retryable error',async()=>{failTier=true;assert.equal((await post()).status,500);assert.equal(rows.size,0);});
    await check('failed audit write is completed on retry',async()=>{failLog=true;assert.equal((await post()).status,500);assert.equal(profile.tier,'MID');assert.equal(rows.size,0);failLog=false;assert.equal((await post()).status,200);assert.equal(rows.size,1);});
    await check('sequential duplicate delivery has one stable audit row',async()=>{await post();const first=[...rows.values()][0];await post();await post();assert.equal(rows.size,1);assert.deepEqual([...rows.values()][0],first);});
    await check('concurrent duplicate deliveries have one audit row',async()=>{const responses=await Promise.all(Array.from({length:8},()=>post()));assert.ok(responses.every(r=>r.status===200));assert.equal(rows.size,1);});
    await check('different event identities retain distinct synchronization records',async()=>{await post();event.id='evt_second';await post();assert.equal(rows.size,2);assert.ok([...rows.values()].every(r=>r.reason.includes('synchronized')));});
    await check('updated event uses current subscription rather than old active payload',async()=>{event.data.object={...defaultSub(),status:'active'};current={...defaultSub(),status:'canceled'};assert.equal((await post()).status,200);assert.equal(profile.tier,'FREE');});
    await check('missing customer column fallback remains supported',async()=>{missingCustomerColumn=1;assert.equal((await post()).status,200);assert.equal(profile.tier,'MID');assert.equal(updates,2);assert.equal(rows.size,1);});
    await check('failed fallback is not acknowledged',async()=>{missingCustomerColumn=1;failTier=true;assert.equal((await post()).status,500);assert.equal(rows.size,0);});
    await check('audit timestamp comes from stable event time',async()=>{await post();assert.equal([...rows.values()][0].changed_at,new Date(event.created*1000).toISOString());});
  }finally{global.fetch=originalFetch;for(const[k,v]of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
  console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
