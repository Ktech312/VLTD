# Physical-device acceptance checklist

Status: **NOT VERIFIED.** Nothing below has been tested on a real phone. Browser emulation does not count; do not
mark any line done from a desktop browser.

Test on one real phone (note the model and browser) with a throwaway account. Tick a line only when you saw it happen.
Anything that fails: write what you saw next to the line (screenshot if possible) and stop; do not retry in a loop.

Device: ____________________  Browser/version: ____________________  Date: ____________  Tester: ____________

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
