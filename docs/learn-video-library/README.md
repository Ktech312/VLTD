# Learn video library

This adds a compact video section to `/learn` without removing articles or changing global navigation. Video files are not included in the app or repository. The owner uploads to YouTube; no uploads, publication, paid services, SQL or subscription changes are performed by this implementation.

## Upload and return links

Open `upload-sheet.html` for each exact file, suggested YouTube title, copyable description, visibility and its Learn catalog key. The current upload batch is the eleven Add Item exports (three guides, six short tips, two approved promos). Do not upload voice samples or old renders. Public = approved promos; Unlisted = detailed guides/tips. Use YouTube Studio > Create > Upload videos for every file, including vertical Shorts. Make a deliberate audience declaration matching the actual content; do not guess it from the subject being collectibles.

Return `catalog key = YouTube link` for each uploaded file. Captions are already burned in; optional caption sidecars are beside the MP4s. The latest approved promos must not be re-edited for pronunciation or captions under this task.

## Link configuration (only after owner supplies links)

Set server-only `LEARN_VIDEO_LINKS_JSON` to a JSON object mapping catalog keys to YouTube watch/share links or 11-character video IDs. Omitted entries remain Coming soon. Example shape only (no real upload):

```json
{"add-item-desktop":"<YouTube link supplied by owner>"}
```

Do not prefix the variable with `NEXT_PUBLIC`; do not commit actual unlisted IDs to this public repository. Route `/api/learn/videos` exposes availability but no IDs. Its `?id=<catalog-key>` playback request returns an ID only when public or after Supabase verifies the signed-in user's bearer token. Responses are private/no-store. No provider calls are made by the playback route other than normal account verification. The client embeds the official privacy-enhanced YouTube player only after a Watch action. Closing the player removes the iframe; Escape and outside-click dismiss the dialog.

Account access means any existing signed-in VLTD account, including free accounts. This is not a paid video benefit or a YouTube channel-subscription check. No new entitlement scheme is added.

YouTube Unlisted does not prevent link sharing: an authorized viewer can extract/share the YouTube link. The sign-in gate limits discovery within VLTD, not viewing on YouTube. Never describe this as secure subscriber-only hosting. YouTube may show branding, recommendations or ads; the app must not obstruct the official player. Nothing auto-plays.

## Validation

`npm run test:learn-videos` checks accepted/rejected URLs, availability without IDs, server authorization, forged/revoked sessions, public playback, cache headers and failure states without requesting YouTube or creating real data. Also run TypeScript, scoped lint and the production build. Browser checks should cover mobile/desktop, category filters, expansion, absent links, request failure, unauthorized playback and modal dismissal. Do not use a real video or make fixture uploads without need.

The owner must supply actual YouTube links before real playback can be verified. This implementation is a local review build until explicitly delivered to production; record its deployment state honestly.
