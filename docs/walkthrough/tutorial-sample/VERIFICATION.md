# Sample verification: Quick Add camera (29 seconds)

Technical details kept out of the video, as requested. The preview page carries only a short disclosure.

## What each narrated sentence was checked against (live app, https://vltd.app, 2026-10-26)
| Narration | Check run when the screenshot was taken | Result |
|---|---|---|
| (intro) Quick Add opens your camera | `/vault/quick` shows the camera with the toolbar Universe, Category, Frame, Camera, barcode, Finished (left to right) | passed |
| 1. Choose the type of collectible you're adding | Pressing Universe opens a list: Pop Culture, Sports, TCG & Non Sport Card, Music, Jewelry & Apparel, Games, Misc, Gears & Gasoline, Art | passed |
| 2. Choose a category if you want to narrow it further | Pressing Category then lists Sports Cards, Apparel, Memorabilia (for Sports). Category is optional: a photo was also taken in other runs without choosing one | passed |
| 3. Tap here to photograph your item. Repeat for each additional item | Pressing the round button makes the counter read 1 and the Finished label read "Finished (1)" (it read plain "Finished" before) | passed |
| 4. When you're done taking photos, select Finished to review them | Pressing Finished opens "Review your Drop" ("1 item ready to vault") | passed |
| (result) check your photos, and the choices you made | The review shows Item 1 as Sports / Sports Cards, the choices made before shooting | passed |

Evidence file: `claims.json` written by `_build/capture-sample.cjs`.

## One app behaviour the video works around
After a Universe or Category is chosen, the two toolbar buttons keep the names "Universe" and "Category" (checked: the text is unchanged). The choice is visible later, on the review screen. The sample therefore shows the list at the moment of choosing and the review screen as the result. Not changed in the app.

## What is simulated, and how it was made
- The camera is Chrome's test camera playing a looping picture of a fictional card. The browser's own camera permission prompt is not shown.
- The footage is screenshots of the deployed app (captured at 3x so a 640 x 360 point crop is 1920 x 1080 native pixels), with a dimmed spotlight, a numbered ring, a lower-third caption and 0.27-second crossfades. It is not a screen recording of a person.
- A synthetic collector account was used and removed afterwards. No AI request was made. No paid service was used.
- Narration: the free "Microsoft Zira Desktop" voice that ships with Windows (System.Speech), rendered locally to WAV, trimmed of silence, placed at each highlight, loudness-normalised and encoded with a local ffmpeg. Scene lengths are the spoken sentence plus 0.45 s (scenes that only show a result are 1.5 to 2 s).
- Captions are burned in and also supplied as `sample-quick-add-camera.srt` and `.vtt` (times match the audio).

## Timing
Total 29.1 s. Narrated scenes: intro 5.0, Universe 2.8, Category 3.3, shutter 5.0, Finished 4.3, review 3.8; result screens 1.5 to 2.0 s each. See `timeline.json`.
