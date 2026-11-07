// Real sharing helper, controlled database completion order; no network or public data.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const m = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name];
    throw Error('Unexpected dependency ' + name);
  }, m, m.exports);
  return m.exports;
}
const core = load('src/lib/wantsCore.ts');
let profile, user, rows, pending, delayed, failure, writes;
function reset() {
  profile = 'profile-a'; user = 'user-a';
  rows = new Map(['profile-a', 'profile-b'].map(id => [id, { profile_id: id, token: 'fictional-' + id, fields: { ...core.DEFAULT_SHARE_FIELDS } }]));
  pending = []; delayed = false; failure = null; writes = [];
}
const client = { from: () => ({
  mode: 'read', id: null, payload: null,
  select() { return this; },
  eq(key, id) { assert.equal(key, 'profile_id'); this.id = id; return this; },
  maybeSingle() { return this; },
  update(value) { this.mode = 'update'; this.payload = structuredClone(value); return this; },
  delete() { this.mode = 'delete'; return this; },
  then(resolve, reject) {
    const run = () => {
      if (failure === 'throw') throw Error('offline');
      if (failure) return { data: null, error: { message: 'refused' } };
      const row = rows.get(this.id);
      if (this.mode === 'update') {
        writes.push(this.id);
        if (row) row.fields = this.payload.fields;
        return { data: row ? [{ profile_id: this.id }] : [], error: null };
      }
      if (this.mode === 'delete') rows.delete(this.id);
      return { data: this.mode === 'read' ? structuredClone(rows.get(this.id) ?? null) : null, error: null };
    };
    const promise = delayed && this.mode === 'update'
      ? new Promise((ok, bad) => pending.push(() => { try { ok(run()); } catch (e) { bad(e); } }))
      : Promise.resolve().then(run);
    return promise.then(resolve, reject);
  },
}) };
const share = load('src/lib/wishlistShare.ts', {
  '@/lib/supabaseClient': { getSupabaseBrowserClient: () => client },
  '@/lib/auth': { getStoredActiveProfileId: () => profile },
  '@/lib/sessionGuard': { captureIdentity: () => { const p = profile, u = user; return () => p === profile && u === user; } },
  '@/lib/wantsCore': core,
});
const tick = () => new Promise(resolve => setImmediate(resolve));
const settings = prices => ({ ...core.DEFAULT_SHARE_FIELDS, prices });
let passed = 0, failed = 0;
async function check(name, fn) {
  reset();
  try { await fn(); console.log('PASS ' + name); passed++; }
  catch (e) { console.error('FAIL ' + name + ': ' + e.message); failed++; }
}
(async () => {
  await check('Optional fields start private', async () => {
    const r = await share.loadWishlistShareFields();
    for (const key of ['notes', 'prices', 'shops', 'dates', 'quantities']) assert.equal(r.fields[key], false);
  });
  await check('Saved fields read back', async () => {
    assert.equal((await share.saveWishlistShareFields(settings(true))).ok, true);
    assert.equal((await share.loadWishlistShareFields()).fields.prices, true);
  });
  await check('Only one field write is in flight and the final choice wins', async () => {
    delayed = true;
    const first = share.saveWishlistShareFields(settings(true));
    const last = share.saveWishlistShareFields(settings(false));
    await tick(); assert.equal(pending.length, 1);
    pending.shift()(); await first; await tick(); assert.equal(pending.length, 1);
    pending.shift()(); assert.equal((await last).ok, true);
    assert.equal(rows.get(profile).fields.prices, false);
  });
  await check('A refused write does not block a later correction', async () => {
    failure = 'refused'; assert.equal((await share.saveWishlistShareFields(settings(true))).ok, false);
    failure = null; assert.equal((await share.saveWishlistShareFields(settings(false))).ok, true);
  });
  await check('Network failure is reported without changing saved privacy', async () => {
    failure = 'throw'; assert.equal((await share.saveWishlistShareFields(settings(true))).ok, false);
    assert.equal(rows.get(profile).fields.prices, false);
  });
  await check('Missing share row is not reported as a successful save', async () => {
    rows.delete(profile); assert.equal((await share.saveWishlistShareFields(settings(true))).ok, false);
  });
  await check('Read waits for the pending settings change', async () => {
    delayed = true;
    const save = share.saveWishlistShareFields(settings(true));
    let done = false; const read = share.loadWishlistShareFields().then(r => { done = true; return r; });
    await tick(); assert.equal(done, false); pending.shift()(); await save;
    assert.equal((await read).fields.prices, true);
  });
  await check('Revocation follows the pending change and removes the link', async () => {
    delayed = true;
    const save = share.saveWishlistShareFields(settings(true)); const revoke = share.disableWishlistShare();
    await tick(); assert.equal(rows.has(profile), true); pending.shift()(); await save;
    assert.equal((await revoke).ok, true); assert.equal((await share.loadWishlistShareToken()).token, null);
  });
  for (const identity of ['profile', 'user']) await check('Queued write refuses a changed ' + identity, async () => {
    delayed = true;
    const first = share.saveWishlistShareFields(settings(true));
    const second = share.saveWishlistShareFields(settings(false));
    await tick(); if (identity === 'profile') profile = 'profile-b'; else user = 'user-b';
    pending.shift()(); await first;
    assert.equal((await second).ok, false); assert.deepEqual(writes, ['profile-a']);
    assert.equal(rows.get('profile-b').fields.prices, false);
  });
  await check('Different profiles do not share a write queue', async () => {
    delayed = true;
    const first = share.saveWishlistShareFields(settings(true)); await tick();
    profile = 'profile-b'; const second = share.saveWishlistShareFields(settings(false)); await tick();
    assert.equal(pending.length, 2); pending[1](); await second; pending[0](); await first;
    assert.equal(rows.get('profile-a').fields.prices, true); assert.equal(rows.get('profile-b').fields.prices, false);
  });
  console.log(JSON.stringify({ passed, failed })); process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
