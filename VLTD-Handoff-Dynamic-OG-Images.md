# Coder Handoff: Dynamic OG Images for Item & Gallery Shares

## What This Does

When a user shares a VLTD link on Facebook, X, iMessage, etc., the social platform fetches the page's `og:image` tag to generate a link preview. Right now every page returns the same generic branded image (`/og-image.png`).

This task makes those previews dynamic:

- Sharing `/vault/item/[id]` → shows the item's primary photo with title overlay
- Sharing `/gallery/[galleryId]` → shows the gallery cover image (or a grid of item photos)

---

## How Next.js Dynamic OG Images Work

Next.js App Router supports a special file convention: placing an `opengraph-image.tsx` file inside any route folder. Next.js automatically:

1. Serves it at `GET /vault/item/[id]/opengraph-image`
2. Injects the correct `og:image` meta tag pointing to that URL
3. Renders the file server-side using `@vercel/og` (Edge Runtime)

No manual meta tag changes needed — Next.js wires it up automatically.

---

## The Core Challenge: Data Access

Both the item page and gallery page are `"use client"` components that read from **localStorage**. Server-side OG image routes cannot access localStorage.

**Solution:** Read data from **Supabase** directly in the OG image route.

- Items are synced to Supabase via `upsertVaultItemToSupabase()` — they're already there
- Galleries will need the same treatment (see notes below)
- The OG route fetches by ID from Supabase, returns the item's primary image URL
- If item is private, not found, or Supabase is unavailable → fall back to `/og-image.png`

---

## Implementation Plan

### 1. Install dependency

```bash
npm install @vercel/og
```

---

### 2. Item OG Image — `src/app/vault/item/[id]/opengraph-image.tsx`

```tsx
import { ImageResponse } from "@vercel/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vltd.vercel.app";

export default async function OgImage({ params }: { params: { id: string } }) {
  const { id } = params;

  let imageUrl: string | null = null;
  let title = "VLTD Item";
  let subtitle = "Collectible Vaults & Museum";

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data } = await supabase
      .from("vault_items")
      .select("title, category_label, image_front_url, status")
      .eq("id", id)
      .single();

    if (data && data.status !== "PRIVATE") {
      title = data.title ?? title;
      subtitle = data.category_label ?? subtitle;
      imageUrl = data.image_front_url ?? null;
    }
  } catch {
    // Fall through to default
  }

  // If no item image, use the branded OG image as background
  const bgImage = imageUrl ?? `${SITE_URL}/og-image.png`;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#000",
          position: "relative",
        }}
      >
        {/* Item photo fills the frame */}
        <img
          src={bgImage}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: imageUrl ? "contain" : "cover",
            objectPosition: "center",
          }}
        />

        {/* Dark gradient overlay at bottom */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)",
          }}
        />

        {/* Text overlay */}
        <div
          style={{
            position: "relative",
            padding: "0 56px 48px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 14, color: "#d4a03c", letterSpacing: "0.2em", fontFamily: "sans-serif" }}>
            VLTD
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, color: "#fff", fontFamily: "sans-serif", lineHeight: 1.1 }}>
            {title}
          </div>
          <div style={{ fontSize: 20, color: "rgba(255,255,255,0.6)", fontFamily: "sans-serif" }}>
            {subtitle}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
```

---

### 3. Gallery OG Image — `src/app/gallery/[galleryId]/opengraph-image.tsx`

```tsx
import { ImageResponse } from "@vercel/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://vltd.vercel.app";

export default async function OgImage({ params }: { params: { galleryId: string } }) {
  const { galleryId } = params;

  let coverUrl: string | null = null;
  let galleryName = "VLTD Gallery";
  let itemCount = 0;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Fetch gallery record (needs galleries table in Supabase — see notes)
    const { data: gallery } = await supabase
      .from("galleries")
      .select("name, cover_image_url, item_count, is_public")
      .eq("id", galleryId)
      .single();

    if (gallery && gallery.is_public) {
      galleryName = gallery.name ?? galleryName;
      coverUrl = gallery.cover_image_url ?? null;
      itemCount = gallery.item_count ?? 0;
    }
  } catch {
    // Fall through to default
  }

  const bgImage = coverUrl ?? `${SITE_URL}/og-image.png`;

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", position: "relative", background: "#000" }}>
        <img
          src={bgImage}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 80%)",
          }}
        />
        <div style={{ position: "relative", marginTop: "auto", padding: "0 56px 48px", display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 14, color: "#d4a03c", letterSpacing: "0.2em", fontFamily: "sans-serif" }}>
            VLTD GALLERY
          </div>
          <div style={{ fontSize: 48, fontWeight: 700, color: "#fff", fontFamily: "sans-serif" }}>
            {galleryName}
          </div>
          {itemCount > 0 && (
            <div style={{ fontSize: 18, color: "rgba(255,255,255,0.55)", fontFamily: "sans-serif" }}>
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
```

---

## Supabase Column Names to Verify

The OG routes assume these column names in Supabase. Verify against the actual schema:

| Table        | Column used            | Notes                                      |
|--------------|------------------------|--------------------------------------------|
| `vault_items` | `id`                  | Item ID (matches the URL param)            |
| `vault_items` | `title`               | Item title                                 |
| `vault_items` | `category_label`      | Used as subtitle                           |
| `vault_items` | `image_front_url`     | Primary image URL (public Supabase storage)|
| `vault_items` | `status`              | Skip if `PRIVATE`                          |
| `galleries`   | `id`                  | Gallery ID                                 |
| `galleries`   | `name`                | Gallery display name                       |
| `galleries`   | `cover_image_url`     | Cover photo                                |
| `galleries`   | `item_count`          | Shown in subtitle                          |
| `galleries`   | `is_public`           | Skip if false                              |

**Note:** The `galleries` table may not exist in Supabase yet — galleries are currently localStorage-only. The gallery OG image route needs the gallery sync feature to be built first (or at minimum a Supabase read path). The item route should work immediately since items already sync.

---

## Privacy Rules

| Scenario                        | OG Image Result                  |
|---------------------------------|----------------------------------|
| Item found, status != PRIVATE   | Item's primary photo             |
| Item is PRIVATE or not found    | Generic `/og-image.png`          |
| Gallery is public               | Gallery cover image              |
| Gallery is private or not found | Generic `/og-image.png`          |
| Supabase unavailable            | Generic `/og-image.png`          |

---

## Environment Variables Required

These must be set in Vercel (they should already be there):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL=https://vltd.vercel.app
```

---

## Testing

1. Deploy to Vercel
2. Visit `https://vltd.vercel.app/vault/item/[real-item-id]/opengraph-image` directly in browser — should render the image
3. Paste the item URL into https://developers.facebook.com/tools/debug/ and hit Scrape Again
4. Check X/Twitter card validator: https://cards-dev.twitter.com/validator

---

## Files to Create

```
src/app/vault/item/[id]/opengraph-image.tsx       ← item photo OG
src/app/gallery/[galleryId]/opengraph-image.tsx   ← gallery cover OG
```

No changes needed to `layout.tsx` or any existing meta tags — Next.js handles it automatically.
