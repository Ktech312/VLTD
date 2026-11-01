import assert from "node:assert/strict";
import { configuredVideoIds, learnVideoResponse, youtubeVideoId } from "../src/lib/learnVideoAccess";
import { LEARN_VIDEOS } from "../src/lib/learnVideos";

async function main() {
  const id = "Abc_123-xYz"; // Synthetic ID; never used for a provider request.
  assert.equal(new Set(LEARN_VIDEOS.map(video => video.id)).size, LEARN_VIDEOS.length);
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
