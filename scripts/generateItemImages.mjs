/**
 * generateItemImages.mjs  v2
 *
 * Finds a UNIQUE, RELEVANT image for every one of the 880 seed vault items.
 *
 * Strategy per item (in order):
 *   1. Wikipedia API  — search by title → article's main photo.
 *      Gets the actual Gutenberg Bible, Action Comics #1 cover,
 *      Mickey Mantle photo, Charizard art, Holbein portrait, etc.
 *   2. Met Museum API — search by item title → public-domain museum photo.
 *   3. Met Museum category pool — broad fallback, never repeats.
 *
 * A global usedUrls Set = ZERO repeated URLs across all 880 items.
 *
 * Run:    node scripts/generateItemImages.mjs
 * Output: supabase/seed-item-images.sql   (~8-12 min, network-bound)
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Fetch with timeout + retry ────────────────────────────────────────────────
async function fetchJSON(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'VLTD-Seed/2.0 (contact@vltd.app)' },
      });
      clearTimeout(timer);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      if (attempt < retries) await sleep(1200 * (attempt + 1));
    }
  }
  return null;
}

// ── Global dedup ──────────────────────────────────────────────────────────────
const usedUrls = new Set();
function claimUrl(url) {
  if (!url || typeof url !== 'string' || url.length < 10) return false;
  if (usedUrls.has(url)) return false;
  usedUrls.add(url);
  return true;
}

// ── Title cleaning ────────────────────────────────────────────────────────────
function buildQuery(title, universe) {
  let t = title.trim();
  t = t.replace(/\s*[\[(][^\])\n]{1,40}[\])]/, '');

  const dashMatch = t.match(/^(.+?)\s+[—–]\s+(.+)$/);
  if (dashMatch) {
    const before = dashMatch[1].trim();
    const after  = dashMatch[2].trim();
    const likelyName = /^[A-Z][a-zA-Z\s\.]{1,35}$/.test(before) && before.split(' ').length <= 3;
    t = likelyName ? `${after} ${before}` : after;
  }

  t = t
    .replace(/\b(1st|2nd|first|second|third)\s+edition\b/gi, '')
    .replace(/\b(PSA|BGS|CGC|SGC)\s*\d+(\.\d+)?\b/gi, '')
    .replace(/#\s*(\d+)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const ctx = {
    'Sports Cards':        'athlete sports card',
    'Trading Cards':       'trading card game',
    'Comics':              'comic book cover',
    'Video Games':         'video game',
    'Sneakers':            'sneakers shoes',
    'Science & Technology':'invention device',
    'Natural History':     'natural history specimen',
  };
  for (const [key, suffix] of Object.entries(ctx)) {
    if (universe?.includes(key)) { t += ' ' + suffix; break; }
  }
  return t;
}

// ── Source 1: Wikipedia ───────────────────────────────────────────────────────
async function getWikipediaImage(query) {
  const searchUrl =
    `https://en.wikipedia.org/w/api.php?action=query&list=search` +
    `&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json`;
  const search = await fetchJSON(searchUrl);
  if (!search?.query?.search?.length) return null;

  for (const result of search.query.search.slice(0, 4)) {
    await sleep(60);
    const imgUrl =
      `https://en.wikipedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(result.title)}` +
      `&prop=pageimages&format=json&pithumbsize=640`;
    const imgData = await fetchJSON(imgUrl);
    const pages = imgData?.query?.pages;
    if (!pages) continue;
    const src = Object.values(pages)[0]?.thumbnail?.source;
    if (src && claimUrl(src)) return src;
  }
  return null;
}

// ── Source 2: Met by title ────────────────────────────────────────────────────
async function getMetByTitle(query) {
  const clean = query.replace(/(athlete sports card|trading card game|comic book cover|video game|sneakers shoes|invention device|natural history specimen)$/i, '').trim();
  const url =
    `https://collectionapi.metmuseum.org/public/collection/v1/search` +
    `?hasImages=true&isPublicDomain=true&q=${encodeURIComponent(clean)}`;
  const data = await fetchJSON(url);
  if (!data?.objectIDs?.length) return null;

  for (const id of data.objectIDs.slice(0, 10)) {
    await sleep(70);
    const obj = await fetchJSON(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
    const src = obj?.primaryImageSmall;
    if (src && src.includes('images.metmuseum.org') && claimUrl(src)) return src;
  }
  return null;
}

// ── Source 3: Met category pool ───────────────────────────────────────────────
const metPools = new Map();

const UNIVERSE_TERMS = {
  'Books & Manuscripts':   ['illuminated manuscript medieval', 'rare book printed early modern', 'letter autograph manuscript historical'],
  'Fine Art':              ['old master painting portrait oil canvas', 'renaissance painting italian', 'impressionist painting french'],
  'Antiquities':           ['ancient greek roman marble sculpture', 'ancient roman coin gold', 'egyptian ancient artifact'],
  'Decorative Arts':       ['french porcelain sevres 18th century', 'english silver decorative', 'japanese lacquer edo period'],
  'Historical Artifacts':  ['historical artifact 18th century', 'military arms weapon historical', 'americana artifact 19th century'],
  'Coins & Currency':      ['ancient coin gold silver roman', 'medal commemorative historical', 'coin numismatic historical'],
  'Music & Instruments':   ['violin string instrument baroque', 'piano keyboard fortepiano historical', 'musical instrument harp lute'],
  'Jewelry & Accessories': ['jewelry gold historical ring', 'brooch pendant gem historical', 'decorative accessory gold enamel'],
  'Science & Technology':  ['scientific instrument astrolabe', 'mechanical device clock 19th century', 'navigation instrument compass'],
  'Sports Memorabilia':    ['trophy silver cup award', 'athletic equipment historical american', 'sport artifact'],
  'Natural History':       ['natural history taxidermy specimen', 'shell botanical specimen', 'zoological specimen historical'],
  'Toys & Games':          ['toy game historical 19th century', 'playing card game historical', 'board game artifact'],
  'Comics':                ['illustration print american 20th century', 'vintage poster american graphic', 'pulp illustration print'],
  'Sports Cards':          ['photograph silver gelatin print portrait', 'american photography 20th century', 'portrait photograph historical'],
  'Trading Cards':         ['japanese woodblock print fantasy', 'illustration fantasy print', 'decorative print colorful'],
  'Video Games':           ['electronic technology artifact', 'american technology device 20th century', 'mechanical toy automaton'],
  'Sneakers':              ['american leather goods footwear', 'fashion accessory american 20th century', 'shoe leather historical'],
  'Film & Entertainment':  ['movie poster print vintage american', 'entertainment poster lithograph', 'photograph celebrity portrait'],
  'Architectural Antiques':['architectural fragment carved stone', 'architectural element medieval carved', 'stone architectural ornament'],
};

function getTerms(universe) {
  for (const [key, terms] of Object.entries(UNIVERSE_TERMS)) {
    if (universe?.includes(key)) return terms;
  }
  return ['decorative arts historical european', 'artifact historical museum', 'ancient artifact archaeological'];
}

async function getMetFromPool(universe) {
  const terms = getTerms(universe);
  const poolKey = terms[0];

  if (!metPools.has(poolKey)) {
    const ids = new Set();
    for (const term of terms) {
      const url =
        `https://collectionapi.metmuseum.org/public/collection/v1/search` +
        `?hasImages=true&isPublicDomain=true&q=${encodeURIComponent(term)}`;
      const data = await fetchJSON(url);
      if (data?.objectIDs) {
        for (const id of data.objectIDs.slice(0, 150)) ids.add(id);
      }
      await sleep(80);
    }
    metPools.set(poolKey, [...ids]);
  }

  const ids = metPools.get(poolKey);
  while (ids.length > 0) {
    const id = ids.shift();
    await sleep(70);
    const obj = await fetchJSON(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
    const src = obj?.primaryImageSmall;
    if (src && src.includes('images.metmuseum.org') && claimUrl(src)) return src;
  }
  return null;
}

// ── Parse items from seed SQL ─────────────────────────────────────────────────
function parseItems() {
  const sql = readFileSync(resolve(__dir, '../supabase/seed-characters.sql'), 'utf8');
  const blocks = sql.match(/INSERT INTO vault_items[^;]+;/gs) ?? [];
  const items = [];
  for (const block of blocks) {
    const rows = [...block.matchAll(
      /\('([0-9a-f-]{36})',\s*'([0-9a-f-]{36})',\s*'([^']+)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'/g
    )];
    for (const m of rows) {
      items.push({ id: m[1], profileId: m[2], title: m[3], subtitle: m[4], universe: m[5], category: m[6] });
    }
  }
  return items;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== VLTD Image Generator v2 ===');
  console.log('Wikipedia first -> Met by title -> Met by category');
  console.log('Zero repeated URLs guaranteed.\n');

  const items = parseItems();
  console.log(`Parsed ${items.length} items\n`);
  if (items.length === 0) { console.error('No items found. Check seed-characters.sql'); process.exit(1); }

  const sqlLines = [
    '-- VLTD Seed Item Images v2',
    '-- Wikipedia + Met Museum. Zero repeated URLs.',
    '-- Generated: ' + new Date().toISOString(),
    '',
  ];

  let wikiHits = 0, metTitleHits = 0, metPoolHits = 0, misses = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const query = buildQuery(item.title, item.universe);
    const label = `[${String(i+1).padStart(3)}/${items.length}] ${item.title.slice(0,50).padEnd(50)}`;
    process.stdout.write(label + ' ');

    let url = null;

    url = await getWikipediaImage(query);
    if (url) { wikiHits++; process.stdout.write('WIKI\n'); }

    if (!url) {
      await sleep(80);
      url = await getMetByTitle(query);
      if (url) { metTitleHits++; process.stdout.write('MET-TITLE\n'); }
    }

    if (!url) {
      url = await getMetFromPool(item.universe);
      if (url) { metPoolHits++; process.stdout.write('MET-POOL\n'); }
    }

    if (!url) { misses++; process.stdout.write('MISS\n'); }

    if (url) {
      sqlLines.push(`UPDATE vault_items SET image_front_url='${url.replace(/'/g, "''")}' WHERE id='${item.id}';`);
    }

    await sleep(120);
  }

  console.log('\n=== Summary ===');
  console.log(`  Wikipedia:   ${wikiHits}`);
  console.log(`  Met (title): ${metTitleHits}`);
  console.log(`  Met (pool):  ${metPoolHits}`);
  console.log(`  No image:    ${misses}`);
  console.log(`  Unique URLs: ${usedUrls.size}  (duplicates: 0)`);

  const out = resolve(__dir, '../supabase/seed-item-images.sql');
  writeFileSync(out, sqlLines.join('\n') + '\n');
  console.log('\nWritten -> supabase/seed-item-images.sql');
  console.log('Paste into Supabase SQL Editor and Run.');
}

main().catch(console.error);
