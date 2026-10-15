Scripts used to produce the videos (kept so they can be regenerated if the app changes).
Needs: Node, `sharp` (already in the repo), `npm i h264-mp4-encoder`, and a `shots/` folder of 1354x719 screenshots named as in `content.cjs`.
`node build.cjs <outDir> [id]` renders MP4 + VTT/SRT; `package.cjs` and `guide.cjs` assemble this folder. Paths inside are the original scratchpad paths: adjust before reuse.

Revision 2 (polish pass): content.cjs now carries focus shots (f1-* to f4-*), highlight rings (marks), explicit zoom regions (roi), banner callouts (strip) and per-step durations. build.cjs adds padded focus-shot framing, rings drawn at panel resolution, adaptive vertical panels and clean caption cuts between steps. package.cjs renders the Help screenshots from the same zoomed view.
