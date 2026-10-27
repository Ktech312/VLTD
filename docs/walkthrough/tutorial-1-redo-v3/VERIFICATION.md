# Quick Add walkthrough v3 (corrected): verification

Edit of v2 (docs/walkthrough/tutorial-1-redo-v2). v1, v2 and the camera sample are unchanged. No app code changed. Nothing published to live Help.

## What was checked
- Every picture is one of v2's verified screenshots (v2 VERIFICATION.md: all Quick Add steps verified against the deployed app), except the phone "Name, then save" picture, which was recaptured (below).
- The only new measurement: the Save button rectangle on the Verify sheet ([466, 563, 508, 44] css px), read from the live page layout in one capture with a synthetic collector. The same button is visible in v2's verify-cost screenshot at the same position, which is the picture used.
- Video: 1920x1080, H.264, 12 fps, 2:25, ONE video stream and NO audio stream (checked with ffmpeg).
- Seeking: fast-seek and exact-seek return identical frames at 3, 20, 50, 90, 120 and 140 s (the file is re-encoded with regular keyframes).
- Frames checked by eye: Home with the ring on Quick Add, press ripple, camera ring 1 to 4 and the screen each produces, review ring on Remove, ring sliding between two name fields, Save ring, Vault, phone screens.
- One ring per picture: no beat has more than one highlighted control (the ring slides between controls on the same screen).
- Hold times: 3.2 to 6.7 s per screen, 4 to 8 s per card. Longest caption 15 words.

## Corrections after review (five)
1. Opens on Home at 0:00; the title shows over Home for about 3 s (checked frames at 0.2 s, 2.8 s and 4 s: nav tabs and the Quick Add button stay visible, the title fades out). The six-second opening card is gone.
2. Phone Verify picture replaced (capture-phone-verify.cjs, phone-size test browser, deployed app, synthetic collector). Same flow as v2's phone capture, plus the review category fix: item 3 is Pop Culture / Toys & Figures (checked from the page: selects read Pop Culture and Toys & Figures; the sheet header reads "ITEM 3 · POP CULTURE"). Nothing was saved to the Vault in this capture.
3. "Your photo is saved" is now "Photo captured".
4. The Identify with AI card is removed. No AI request was made at any point.
5. No production labels in any frame: the "phone-size test browser" tag, the screenshot footer and the phone card's "recorded in a phone-sized test browser" line are gone (the .srt/.vtt contain neither phrase). Frames carry only DESKTOP or PHONE.

## Not verified / limits
- Voice: none. I cannot listen, so I did not generate a voice I could not check.
- The browser's camera-permission prompt cannot be captured; shown as a card.
- Camera pictures come from a test camera playing fictional cards.
- Phone screens were recorded in a phone-sized test browser, not a physical phone.

## Cleanup
The synthetic collectors made for the Save measurement (tut5) and the phone Verify recapture (tut6) were removed by exact manifest ids. Baseline after the last cleanup: 3,477 vault items, 0 profiles and 0 auth users left from them.
