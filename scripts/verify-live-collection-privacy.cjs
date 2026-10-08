// Read-only: verify anonymous boundaries against the authorized test profile.
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
const assert=require('node:assert/strict');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY);
const anon=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function query(q){const {data,error}=await q;if(error)throw error;return data;}
async function main(){
 const profiles=await query(svc.from('profiles').select('id').eq('username','clerk'));
 assert.equal(profiles.length,1,'Expected the signed-in test profile');const id=profiles[0].id;
 const privateItems=await query(svc.from('vault_items').select('id').eq('profile_id',id).eq('is_public',false).limit(20));
 if(privateItems.length){const exposed=await query(anon.from('vault_items').select('id').in('id',privateItems.map(r=>r.id)));assert.equal(exposed.length,0,'Private Vault item exposed');}
 const galleries=await query(svc.from('galleries').select('id,visibility,state').eq('profile_id',id));
 const privateGalleries=galleries.filter(g=>g.visibility!=='PUBLIC'||g.state!=='ACTIVE');
 const publicGalleries=galleries.filter(g=>g.visibility==='PUBLIC'&&g.state==='ACTIVE');
 if(privateGalleries.length){const ids=privateGalleries.map(g=>g.id);assert.equal((await query(anon.from('galleries').select('id').in('id',ids))).length,0,'Private exhibit exposed');assert.equal((await query(anon.from('gallery_items').select('id').in('gallery_id',ids))).length,0,'Private exhibit items exposed');}
 if(publicGalleries.length)assert.equal((await query(anon.from('galleries').select('id').in('id',publicGalleries.map(g=>g.id)))).length,publicGalleries.length,'Public exhibit missing');
 assert.equal((await query(anon.rpc('get_gallery_by_share_token',{p_token:'invalid-privacy-test-token'}))).length,0,'Invalid share token accepted');
 console.log(JSON.stringify({pass:true,privateVaultItemsChecked:privateItems.length,privateExhibitsChecked:privateGalleries.length,publicExhibitsChecked:publicGalleries.length,invalidShareTokenRejected:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
