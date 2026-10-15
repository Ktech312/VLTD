Scripts used to produce the videos (kept so they can be regenerated if the app changes).
Needs: Node, `sharp` (already in the repo), `npm i h264-mp4-encoder`, and a `shots/` folder of 1354x719 screenshots named as in `content.cjs`.
`node build.cjs <outDir> [id]` renders MP4 + VTT/SRT; `package.cjs` and `guide.cjs` assemble this folder. Paths inside are the original scratchpad paths: adjust before reuse.
