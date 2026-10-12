# VLTD account email: sender and templates

## What was wrong (2026-10-12)
A password-reset email sent to a real user arrived as **"Supabase Auth <noreply@mail.app.supabase.io>"**, subject "Reset Your Password", Supabase's default body and the footer "powered by Supabase". That is what the production project does today: no custom SMTP and the default templates are in use. Code alone cannot change that; the sender and the templates live in the Supabase project's Auth settings.

## What the code now guarantees
- Nothing in the app can make Supabase send an account email unless `AUTH_EMAIL_SENDER_VERIFIED=true` is set (Vercel env). Unset or anything else = the app refuses and sends nothing (`src/lib/email/senderGate.ts`).
- Every place that triggers an account email goes through that gate: sign-up (`/api/auth/signup`), password reset (`/api/auth/password-reset`, used by Forgot password and Account > Security), email change (`/api/auth/change-email`), admin invitations (`/api/admin/waitlist`). The browser no longer calls Supabase's mailer directly.
- `npm run check:auth-email` fails if any file can trigger an account email without the gate.
- The website's answer to a sign-up is the same for a new, unconfirmed or existing address. Existing accounts get a reset email, unconfirmed accounts get the confirmation again, with a 60-second cooldown per account and IP/address rate limits.

Limit: Supabase's public Auth API can still be called directly with the public key, so the dashboard settings below are the real fix. The gate is the app-side guarantee.

## Dashboard / provider work still required (not code)
1. **Sender (custom SMTP).** Supabase Dashboard > Authentication > Emails > SMTP Settings: connect VLTD's existing email provider's SMTP login, with the verified VLTD sending address as the From address and "VLTD" as the sender name. The sending domain must have SPF and DKIM set at the provider.
2. **Reply-To.** Supabase's SMTP settings have no Reply-To field. Set the monitored support address as the reply-to (or as a mailbox/alias for the From address) at the provider.
3. **Templates and subjects.** Paste `docs/supabase-email-templates/*.html` and the subjects in `subjects.json` into Authentication > Emails (Confirm signup, Invite user, Magic link, Change email, Reset password, Reauthentication). Or run `node scripts/apply-supabase-auth-email-config.mjs --check` and then `--apply` with a Supabase personal access token and the SMTP login in the environment; it prints the sender and subjects before changing anything and asks for the word APPLY.
4. **Logo.** The templates load `https://vltd.app/email/vltd-logo-platinum.png`, which ships with this branch; it must be live on vltd.app before the emails are sent.
5. **Verify with a real email**, then set `AUTH_EMAIL_SENDER_VERIFIED=true`:
   - send a password reset to an authorized test inbox;
   - confirm the From name and address read VLTD, not Supabase; the subject is "Reset your VLTD password"; there is no Supabase wording or footer;
   - open it on a phone and check the layout and that the button works and lands on the reset page;
   - repeat for a confirmation email (sign-up) with an authorized test address.

A template preview or code deployment does not prove the production configuration changed. Only a received email does.

## VLTD's existing provider: IONOS Mail
Found from vltd.app's DNS: mail (MX) is IONOS (`mx00.ionos.com`, `mx01.ionos.com`), SPF already includes IONOS (`include:_spf-us.ionos.com`), and DMARC is published (`p=none`). So account email is sent through the existing IONOS mailbox, not a new service.

### Entering the credentials (never in chat)
Two places, both private to you. Use whichever you prefer; the first is simplest.

**A. Supabase dashboard (nothing touches this computer)**
1. supabase.com/dashboard > the VLTD project > Authentication > Emails > SMTP Settings > Enable custom SMTP.
2. Sender email: the VLTD mailbox address. Sender name: `VLTD`.
3. Host `smtp.ionos.com`, port `587`, username = the full mailbox address, password = that mailbox's password. Save.
4. Authentication > Emails > Templates: for each of Confirm signup, Invite user, Magic link, Change email address, Reset password, Reauthentication, paste the matching file from `docs/supabase-email-templates/` and the subject from `subjects.json`.

**B. Let the script do steps 1-4 (credentials stay in a git-ignored file on this computer)**
1. Create a Supabase access token: supabase.com/dashboard/account/tokens > Generate new token.
2. Open `C:\Users\EK\VLTD\.env.local` and add these lines at the bottom, then save (the file is git-ignored):
   ```
   SUPABASE_ACCESS_TOKEN=<the token>
   SMTP_USER=<the full VLTD mailbox address>
   SMTP_PASS=<that mailbox's password>
   SMTP_ADMIN_EMAIL=<the same VLTD mailbox address>
   ```
3. Tell Claude "credentials are in .env.local". Claude runs `--check`, then `--apply`, and does not print the values.
4. Afterwards, delete the SMTP_PASS and SUPABASE_ACCESS_TOKEN lines from `.env.local` and revoke the token on the Supabase tokens page.

### IONOS notes
- The From address must be the authenticated mailbox itself; IONOS rejects other From addresses.
- Reply-To cannot be set in Supabase. Use the monitored support address as the mailbox, or set a reply-to rule/alias in IONOS.
- IONOS signs outgoing mail with its own keys; the SPF record already covers it. If receivers show "via ionos" or the message lands in spam, add DKIM for the domain in IONOS (Email > the domain > DKIM) and then raise DMARC from `p=none` later.
