# Instagram Direct Posting — Scope & Feasibility

**Date:** July 2, 2026  
**Status:** Research complete — decision needed before building

---

## The Core Problem

Instagram's API only allows posting to **Business or Creator accounts**, never personal accounts. Most casual collectors use personal accounts. This is a hard wall Meta will never remove.

---

## What It Takes to Build

### User Side (what your users need)
- Switch their Instagram from Personal → Business or Creator in settings
- Connect a Facebook Page to that Instagram account
- Go through an OAuth flow inside VLTD to grant permission

**Friction level: HIGH.** Plenty of users will drop off at "connect a Facebook Page." This is the #1 reason most apps that try Instagram direct posting see low adoption.

### Your Side (what you need to build)

**Phase 1: Meta App Setup (weeks 1–2)**
- Create a Meta Developer app at developers.facebook.com
- Add "Instagram" product with Business Login
- Get a privacy policy page live (you have this)
- Submit for App Review for `instagram_business_content_publish` permission

**Phase 2: App Review (weeks 3–8)**
- Meta reviews your submission. Timeline: **4–8 weeks**, multiple rejection rounds are common
- They require: business verification, a screencast of the full OAuth + post flow, reproducible test instructions using a Business/Creator account
- **No API fees.** Cost is purely time.

**Phase 3: OAuth Integration**
- Build an OAuth flow (redirect to Meta → user grants permission → you get a long-lived access token)
- Store the access token securely (encrypted in Supabase, tied to the user's account)
- Handle token refresh (long-lived IG tokens last 60 days, need periodic refresh)

**Phase 4: Publishing Flow**
Two API calls per post:

```
Step 1: POST /me/media
  image_url: must be a PUBLIC URL (Supabase storage URLs qualify)
  caption: vault item title + grade + your app hashtag
  → returns container ID

Step 2: Wait for container status = FINISHED (poll /container_id?fields=status_code)

Step 3: POST /me/media_publish
  creation_id: container ID
  → returns Instagram media ID
```

Image requirements (Meta's rules):
- **JPEG only** — no PNG, no WebP
- Must be hosted on a public server at time of publish (Supabase public bucket ✓)
- Minimum 320px, maximum 1440px wide
- Aspect ratio: between 4:5 and 1.91:1

**Rate limit:** 100 posts per 24 hours per account. Not a real constraint for collectors.

---

## Effort Estimate

| Task | Time |
|------|------|
| Meta app setup + App Review submission | 1–2 days |
| App Review waiting period | 4–8 weeks |
| OAuth + token storage backend | 2–3 days |
| Publishing API + status polling | 1–2 days |
| JPEG conversion (Supabase images may be PNG) | 1 day |
| UI: connect Instagram button in settings | 1 day |
| UI: "Share to Instagram" button in vault item | 1 day |
| Error handling + token expiry re-auth | 1 day |
| **Total build time (after approval)** | **~8–10 dev days** |
| **Total calendar time** | **6–10 weeks** |

---

## The JPEG Problem

VLTD stores images in Supabase. Users upload JPEGs, PNGs, HEICs. Meta only accepts JPEG.

Two options:
1. **Convert on-the-fly in a serverless function** — convert the stored image to JPEG before passing the URL to Meta. Requires a `/api/ig-proxy` endpoint that fetches, converts, and re-serves the image.
2. **Store a JPEG copy at upload time** — add JPEG conversion when users upload. Cleaner long-term.

Option 1 is faster to ship. Option 2 is the right architecture.

---

## Recommendation

**Don't build this before you have traction.** Here's why:

1. The 6–10 week wait for App Review means you can't ship it fast
2. Most VLTD users likely have personal IG accounts → they can't use it at all
3. The current "copy link + open instagram.com" flow covers the real use case for now (posting a share image with the gold frame)

**What to build instead (today):**
- Add a "Download Card" button to the share page that downloads the `/api/og` branded image directly to the user's phone. Users can then post it to IG Stories or feed manually. **Zero friction, zero API review, works with personal accounts.** This is how most creator tools handle Instagram.

**When to revisit Instagram direct posting:**
- After you have 500+ active users
- When users are specifically asking for it
- When you have a dedicated engineer for the Meta review process

---

## If You Do Build It — Full Permission List Needed

```
instagram_business_basic
instagram_business_content_publish
```

Both require Advanced Access (App Review).

---

## Alternative: Meta Sharing to Feed (no review needed)

Meta has a "Sharing to Feed" feature that opens Instagram with a pre-filled post — no API review, no Business account required, works like a share sheet. **Works on mobile only.**

```
https://www.instagram.com/share?url=YOUR_SHARE_URL
```

This works right now. The user taps it, Instagram opens, they see your share page URL. They can then add their own photo to the post. Limited but instant.

