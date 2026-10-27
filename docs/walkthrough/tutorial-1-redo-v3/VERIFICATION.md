# Quick Add walkthrough v3: verification

Edit of v2 (docs/walkthrough/tutorial-1-redo-v2). v1, v2 and the camera sample are unchanged. No app code changed. Nothing published to live Help.

## What was checked
- Every picture is one of v2's verified screenshots (v2 VERIFICATION.md: all Quick Add steps verified against the deployed app). No screen was recaptured for this video.
- The only new measurement: the Save button rectangle on the Verify sheet ([466, 563, 508, 44] css px), read from the live page layout in one capture with a synthetic collector. The same button is visible in v2's verify-cost screenshot at the same position, which is the picture used.
- Video: 1920x1080, H.264, 12 fps, 2:39, ONE video stream and NO audio stream (checked with ffmpeg).
- Seeking: fast-seek and exact-seek return identical frames at 3, 8, 10, 20, 45, 55, 100, 120 and 150 s (the first encoder's keyframe table was wrong, so the file was re-encoded with regular keyframes).
- Frames checked by eye: Home with the ring on Quick Add, press ripple, camera ring 1 to 4 and the screen each produces, review ring on Remove, ring sliding between two name fields, Save ring, Vault, phone screens.
- One ring per picture: no beat has more than one highlighted control (the ring slides between controls on the same screen).
- Hold times: 3.2 to 6.7 s per screen, 4.5 to 8 s per card. Longest caption 15 words.

## Not verified / limits
- Voice: none. I cannot listen, so I did not generate a voice I could not check.
- The browser's camera-permission prompt cannot be captured; shown as a card.
- Camera pictures come from a test camera playing fictional cards.
- Phone screens were recorded in a phone-sized test browser, not a physical phone.

## Cleanup
The synthetic collector made for the Save measurement (tut5) was removed by exact manifest ids. Baseline after cleanup: 3,477 vault items, no profiles/auth users left from it.
