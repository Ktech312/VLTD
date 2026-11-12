import assert from "node:assert/strict";
import { configuredVideoIds, learnVideoResponse, youtubeVideoId } from "../src/lib/learnVideoAccess";
import { LEARN_VIDEOS } from "../src/lib/learnVideos";
import { learnVideoPreview } from "../src/lib/learnVideoSelection";

async function main() {
  const id = "Abc_123-xYz"; // Synthetic ID; never used for a provider request.
  assert.equal(new Set(LEARN_VIDEOS.map(video => video.id)).size, LEARN_VIDEOS.length);
  // Catalog metadata is complete and well-formed (public metadata only: no links or video ids live here).
  for (const video of LEARN_VIDEOS) {
    assert.match(video.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad catalog key ${video.id}`);
    assert.ok(video.title.trim().length > 3 && video.description.trim().length > 10, `thin metadata for ${video.id}`);
    assert.match(video.duration, /^[0-9]{1,2}:[0-9]{2}$/, `bad duration for ${video.id}`);
    assert.ok(["Desktop", "Phone", "Desktop + phone"].includes(video.device), `bad device for ${video.id}`);
    assert.ok(["Walkthroughs", "Quick tips", "About VLTD"].includes(video.collection), `bad collection for ${video.id}`);
    assert.ok(video.access === "public" || video.access === "account", `bad access for ${video.id}`);
    assert.equal(Boolean(video.portrait), video.device === "Phone", `portrait flag must match the Phone format for ${video.id}`);
  }
  assert.ok(!LEARN_VIDEOS.some(video => /(^|-)(bz3|bz4|ex7|s10)(-|$)/.test(video.id)), "held replacement videos must not be in the catalog");
  const readyPreview = learnVideoPreview(LEARN_VIDEOS, { "add-item-combined": true, "add-item-desktop": true, "add-item-promo-1": true });
  assert.deepEqual(readyPreview.map(video => video.id), ["add-item-combined", "add-item-desktop"], "Unavailable preferred guides must not displace uploaded videos");
  assert.deepEqual(learnVideoPreview(LEARN_VIDEOS, { "add-item-promo-1": true }).map(video => video.id), ["add-item-promo-1"], "One uploaded video must not be padded with an unavailable guide");
  assert.deepEqual(learnVideoPreview(LEARN_VIDEOS, { "quick-add-combined": true, "add-item-combined": true }).map(video => video.id), ["quick-add-combined", "add-item-combined"]);
  assert.equal(learnVideoPreview(LEARN_VIDEOS, {}).length, 2, "An unconfigured library keeps its compact coming-soon view");
  for (const link of [id, `https://youtu.be/${id}?si=abc`, `https://www.youtube.com/watch?v=${id}&list=abc`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube-nocookie.com/embed/${id}`]) assert.equal(youtubeVideoId(link), id);
  for (const link of [`http://youtube.com/watch?v=${id}`, `https://youtube.com.evil.test/watch?v=${id}`, `https://evil.test/${id}`, `javascript:alert(1)`, `https://evil@youtube.com/watch?v=${id}`, "bad", null, `https://youtube.com/watch?v=${id}/extra`]) assert.equal(youtubeVideoId(link), null);
  assert.deepEqual(configuredVideoIds(undefined), {});
  assert.throws(() => configuredVideoIds("[]"));
  assert.throws(() => configuredVideoIds('{"quick-add-combined":"bad"}'));
  const raw = JSON.stringify({ "quick-add-combined": id, "add-item-promo-1": `https://youtu.be/${id}` });
  let checks = 0;
  const verify = async (token: string) => { checks++; return token === "valid-session"; };
  const get = (query = "", token?: string) => learnVideoResponse(new Request(`https://vltd.test/api/learn/videos${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }), raw, verify);
  const listing = await get();
  const listingText = await listing.text();
  assert.equal(listing.status, 200);
  assert.equal(listingText.includes(id), false, "Listing must not expose unlisted IDs");
  assert.equal(checks, 0);
  assert.equal((await get("?id=quick-add-combined")).status, 401);
  assert.equal((await get("?id=quick-add-combined", "forged-session")).status, 401);
  const account = await get("?id=quick-add-combined", "valid-session");
  assert.equal(account.status, 200);
  assert.deepEqual(await account.json(), { youtubeId: id });
  assert.equal(account.headers.get("cache-control"), "private, no-store");
  assert.equal(account.headers.get("vary"), "Authorization");
  const beforePublic = checks;
  assert.equal((await get("?id=add-item-promo-1")).status, 200);
  assert.equal(checks, beforePublic, "Public video should not require account verification");
  assert.equal((await get("?id=add-item-short-1")).status, 404);
  assert.equal((await get("?id=unknown")).status, 404);
  assert.equal((await learnVideoResponse(new Request("https://vltd.test/api/learn/videos"), "bad json", verify)).status, 503);
  assert.equal((await learnVideoResponse(new Request("https://vltd.test/api/learn/videos?id=quick-add-combined", { headers: { Authorization: "Bearer valid-session" } }), raw, async () => { throw new Error("offline"); })).status, 503);
  console.log("Learn video checks passed: URL validation, no link leaks, public/account access, revoked/forged sessions, unavailable videos and account-service failure.");
}
void main();
