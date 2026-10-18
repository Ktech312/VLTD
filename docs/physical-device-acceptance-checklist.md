# Physical-device acceptance checklist

Status: **NOT VERIFIED.** Nothing below has been tested on a real phone. Browser emulation does not count; do not
mark any line done from a desktop browser.

Test on one real phone (note the model and browser) with a throwaway account. Tick a line only when you saw it happen.
Anything that fails: write what you saw next to the line (screenshot if possible) and stop; do not retry in a loop.

Device: ____________________  Browser/version: ____________________  Date: ____________  Tester: ____________

## SHORT PHONE PASS: the five checks only your phone can close (about 15 minutes)

Desktop and browser-resize testing cannot close these: they need a real camera, a real share sheet, a real Home Screen, a real finger and a real push service. Everything else on this page (sign-in, Add Item, Vault, Home figures, exhibition build, share link, visitor view, phone layouts and tap sizes at 320 to 414px) was already run in a headless browser on the live site, so you do not need to repeat it. Use a throwaway or your own account on the live site; tick a line only when you saw it happen; if something fails, write what you saw and stop.

Device: ____________  Browser: ____________  Date: ____________

1. **Camera.** Add Item, then take a photo with the phone camera (the camera, not "choose a file").
   - [ ] The camera opens, the photo shows in the form, and after Save the item appears in the Vault with that photo.
2. **Native photo sharing.** Open an item that has a photo, tap Share, find "Share photos", tap one picture, tap "Share 1 photo".
   - [ ] The phone's own share sheet opens with the picture attached (choose "Cancel" or send it to yourself; nothing is posted by VLTD).
   - [ ] On a browser with no share sheet the button reads "Download to device" and the picture lands in Downloads instead.
3. **Installation.** Android Chrome: tap Install on the "Add to Home Screen" banner (or the browser menu). iPhone Safari: Share, then Add to Home Screen.
   - [ ] A VLTD icon appears on the Home Screen and opens VLTD full-screen (no browser bar), still signed in.
   - [ ] The bottom navigation is not covered by the phone's own bar or the home indicator.
4. **Touch arranging.** Open an exhibition with at least 3 items. Tap Organize (if it says it needs an exhibit page, tap "Create first exhibit"). Press and hold one item, drag it onto another slot, let go.
   - [ ] The two items swap, the page does not scroll while you drag, and Done turns arranging off.
   - [ ] Close and reopen the exhibition: the new order is kept.
   - [ ] With Organize off, a finger swipe scrolls the page normally.
5. **Push notifications.** Account, then Preferences, then turn on "New message alerts" and allow the browser prompt (iPhone: only works from the installed Home Screen icon).
   - [ ] From a second account (or another device) send this account a message: a notification arrives on the phone while VLTD is closed.
   - [ ] Sign out on the phone, send another message to that account: nothing arrives. (This is the existing line in section 6.)

Result of the short pass: PASS / FAIL / NOT RUN        Notes: ______________________________________________

Sections 1 to 6 below are the full list. The short pass above overlaps sections 4 (camera), 5 (bottom navigation) and 6 (push), and adds three checks the full list did not have: native photo sharing, installation and touch arranging. Sign-up emails, onboarding and keyboard-open forms (sections 1 to 3) stay unverified and are not part of the short pass.

## 1. Sign-up and email links
- [ ] Sign up with a fresh address you can read on this phone. The confirmation email arrives (check spam).
- [ ] The email looks like VLTD (logo, "Hello,", one button) and fits the screen without sideways scrolling.
- [ ] Tapping the button opens the VLTD "email confirmed" page and then onboarding (no blank page, no error).
- [ ] Request a password reset. The email arrives; the link opens "Set your password"; the new password works to sign in.
- [ ] An invitation email: the link opens "Set your password", then onboarding.

## 2. Onboarding
- [ ] Pick an avatar, type a name and username, tap Save and continue. Nothing is hidden behind the keyboard.
- [ ] Close the browser tab mid-way and come back: you are on the same step with your answers kept.
- [ ] Add a business profile during setup: the form has no tax-ID field; finishing creates both profiles.
- [ ] Finish setup and land on Home.

## 3. Keyboard-open forms
- [ ] On each of: onboarding, Add Business Profile, Add Item, Exhibition title: with the keyboard open, the field you are
      typing in and the main button stay visible, and the page does not jump or zoom.
- [ ] Closing the keyboard returns the page to normal (no leftover gap at the bottom).

## 4. Add Item
- [ ] Add Item opens; take a photo with the camera (or choose one) and it shows in the form.
- [ ] Fill the title, save; the item appears in the Vault with its photo.
- [ ] Turn on airplane mode, add another item, save: the "waiting to save" message shows and the item stays.
      Turn airplane mode off: it finishes saving once (no duplicate in the Vault).

## 5. Bottom navigation
- [ ] Home, Vault, Exhibitions, Lounge, Discover each open the right page; the current one is highlighted.
- [ ] The bar is not covered by the browser's own toolbar, and nothing important sits underneath it.
- [ ] Rotate the phone and back: the layout recovers.

## 6. Push notifications, sign-out and account switching
- [ ] Turn notifications on for this account; allow the browser prompt; a test notification arrives.
- [ ] Sign out. Trigger a notification for that account from another device: **nothing** arrives on this phone.
- [ ] Sign in as a second account on the same phone. Notifications for the first account do not arrive; the second's do.
- [ ] Sign back in as the first account: its notifications work again, and nothing from the second account shows.
- [ ] After each switch, Home and the Vault show only that account's own items and name.

## Result
Overall: PASS / FAIL / NOT RUN        Notes: ______________________________________________
