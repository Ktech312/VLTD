import assert from 'node:assert/strict';

// Run against a production build or deployment. Checks the actual HTTP body,
// not the hydrated DOM, so client-only regressions cannot hide behind JS.
const base = process.argv[2] || 'http://localhost:3100';
async function html(path) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, `${path} must return 200`);
  return response.text();
}
const [home, learn, guide, robots, sitemap] = await Promise.all(
  ['/', '/learn', '/learn/getting-started', '/robots.txt', '/sitemap.xml'].map(html),
);
const bodyText = home.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
assert.match(bodyText, /<h1\b[^>]*>\s*Your collection, <span[^>]*>VauLTeD\./);
assert.match(home, /<title>VLTD \(Vaulted\) \| Collection Tracker/);
assert.match(home, /"@type":"FAQPage"/);
assert.match(robots, /Disallow: \/dashboard/);
assert.match(bodyText, /Founding Access/);
assert.match(bodyText, /Registration closes at 50 accounts/);
assert.match(bodyText, /href="\/signup"/);
assert.doesNotMatch(bodyText, /Start free|Free forever|under 60 seconds|50 items in one sitting|Real-time values|grades with precision|Every other app/);
assert.match(home, /<script[^>]*type="application\/ld\+json"[^>]*>/);
assert.match(learn, /<h1\b[^>]*>Learn<\/h1>/);
assert.match(learn, /rel="canonical" href="https?:\/\/[^"/]+\/learn"/);
assert.match(guide, /<h1\b[^>]*>Getting Started<\/h1>/);
assert.match(guide, /rel="canonical" href="https?:\/\/[^"/]+\/learn\/getting-started"/);
assert.match(robots, /Sitemap: https?:\/\/.+\/sitemap.xml/);
assert.match(sitemap, /\/learn\/getting-started<\/loc>/);
assert.doesNotMatch(sitemap, /\/vault|\/admin|\/museum\/share/);
console.log(`PASS: server-rendered homepage and Learn content, beta copy, schema, canonicals, robots and sitemap (${base})`);
