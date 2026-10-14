# Workflows verified 2026-10-14 (production, commit `e83adc7`)

Viewport labels: **desktop** = the app's browser pane at ~1280 px; **emulated 390 / 320** = viewport emulation, not a physical phone.

## 1. Log in and finish onboarding (desktop)
**Prerequisites:** an account with a password (a QA account was used).
**Steps**
1. Open `/login`. Type the email and password, press **Log in**.
2. A new account lands on **Set up your personal account**. Pick an avatar, type a display name and a username, press **Save and continue**.
3. **Add a business?** — choose **Personal only**, press **Continue**.
4. **Pick your look** — keep the default, press **Continue**.
5. **Review and finish** — press **Finish setup**.
**Expected:** the dashboard opens; going to `/onboarding` again returns to the dashboard.
**Next:** add your first item (workflow 2).
**Narration:** "Log in, give your profile a name and picture, keep it personal for now, pick a look, and finish. You land on your dashboard."

## 2. Add an item and read the save status (emulated 390 and 320)
**Steps**
1. Open **Vault → Add**. If the camera panel opens, close it (a browser without camera permission shows "Camera access is blocked", which is expected).
2. Type the item name, press **Save**.
3. Open the item from the Vault.
**Expected:** "✓ Saved!". If your account cannot be reached the pill reads **"Saved on this device — sync pending"** with **Retry now**, and a toast says the change is saved on this device and will keep trying; the toast wraps inside the screen and sits above the bottom navigation.
**Narration:** "Name it and save. VLTD tells you honestly whether it is only on this device or already in your account."

## 3. Create and delete an exhibition (desktop)
**Steps**
1. **Exhibitions → Create First Exhibition**.
2. Type a title and a short description, press **Create Exhibition**.
3. Back on **Exhibitions** the new card is listed at once. Use **Delete exhibition …**, confirm **Yes Delete FOREVER** (the dialog traps keyboard focus; **Cancel** is the first button).
**Expected:** the card disappears immediately and stays gone after waiting and after a reload.
**Note:** new exhibitions default to **Public**; change visibility before sharing.
**Narration:** "Name your exhibition, create it, and it appears straight away. Deleting asks you to confirm first."

## 4. Reset a forgotten password (desktop)
**Steps**
1. On `/login` choose **Forgot password?**, enter the email, press **Send reset link**. The page says "If … has a VLTD account, you'll receive a password reset link" (same wording whether or not the account exists).
2. Open the email "Reset your VLTD password" and press **Reset my password**.
3. **Choose a new password** — type it twice, press **Update password**. You are sent to the login page.
4. Log in with the **new** password. The old password is refused ("Invalid login credentials").
5. Using the same emailed button again shows **This link has expired**, with **Send me a new link** and **Log in**.
**Expected:** only the new password works; other sessions for that account are signed out; the used link cannot be reused.
**Narration:** "Ask for a link, tap the button in the email, choose a new password, and log in. An old link simply tells you it has expired and offers a fresh one."

## 5. Spreadsheet import (not recorded live)
Verified with a synthetic CSV/XLSX by the automated tests (`npm run test:import`, 32 checks): leading zeros kept, thousands separators read, missing vs zero cost distinct, notes with line breaks kept, invalid dates/amounts flagged and not guessed, totals row ignored, same description with different serial numbers kept, unreadable files explained. A live walkthrough with footage is still to be recorded.

## Outlines
**Social (30–45 s):** hook "Your collection, on the record" → add an item (2) → create an exhibition (3) → end card.
**Help video (~4 min):** log in & set up (1) → add an item (2) → exhibition (3) → reset a password (4) → where to get help.
