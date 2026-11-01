# Learn video library: local verification

2026-10-31. Branch: `codex/learn-video-library`, based on the current app work at `94bc269`. Actual implementation, not a mockup. Nothing uploaded to YouTube, no paid service enabled, no production data modified, no real account/QA fixture created. No video files were copied into the app. The earlier app and media worktrees are untouched.

## Checked

- `npm run test:learn-videos`: passed. Exercises the real access-response helper with simulated account verification: valid YouTube URLs, rejected lookalike/non-HTTPS/injected URLs, no unlisted IDs in the availability listing, public access, account-only denial, valid/forged/revoked credentials, no-store/Vary headers, unconfigured entries and malformed configuration.
- TypeScript: passed.
- Production build: passed, including `/learn` and `/api/learn/videos`. Existing middleware deprecation and edge-runtime static-generation notices remain unrelated.
- Scoped lint: new modules pass; the existing LearnClient saved-article effect has its pre-existing warning.
- Actual local browser at desktop, 390 px and 320 px: compact initial view, no horizontal overflow at either phone width; expansion shows 15 catalog entries; Quick tips shows six entries; About VLTD shows three; resetting All videos returns to two featured entries. Written article content remains in place.
- Before Watch: zero YouTube iframes. No thumbnails or players fetched from YouTube on initial library load.
- Temporarily configured one synthetic YouTube ID in ignored local environment only. Actual browser Watch request while signed out returned a sign-in message, no iframe and no ID disclosure. Escape closed the native modal. The synthetic configuration was then removed; all entries are Coming soon again.
- Upload-sheet generator verifies that each of its eleven MP4 paths exists. Titles, descriptions, YouTube visibility and catalog keys are provided; no network or media mutation is performed by the generator.

## Not established

- Real YouTube playback: the owner has not supplied uploaded video links. No actual video was played or uploaded in this pass.
- Full signed-in Supabase-to-YouTube playback on the deployed site: not run. Account verification logic is present; access cases were tested with simulated verification, and the actual local signed-out path was exercised.
- Physical phone, native YouTube app, iOS Safari and installed-PWA behavior: not tested.
- Production deployment: not performed. Local preview: `http://localhost:3107/learn` while the task's local dev server is running.

Do not label the unlisted hosting as secure subscriber-only video access: a signed-in viewer can share the YouTube link. The current app gate is ordinary VLTD account sign-in, including free accounts.
