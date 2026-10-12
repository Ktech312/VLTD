// Hard stop for account email: nothing in the app may trigger an email from Supabase's Auth mailer unless the
// production project has been switched to VLTD's own sender (custom SMTP with the verified VLTD address, VLTD templates).
//
// Until then Supabase would send from its default "Supabase Auth <noreply@mail.app.supabase.io>" with its default wording,
// and a real person (Debi, 2026-10-12) received exactly that. This gate makes the app refuse instead.
//
// Status: VERIFIED on 2026-10-12. The production Supabase project sends as "VLTD <ehren@vltd.app>" through the existing IONOS mailbox,
// with the VLTD templates. Received emails were checked for sender, branding, greeting, and a working confirmation and reset link.
// So the gate is open by default. It stays as a kill switch: set AUTH_EMAIL_SENDER_VERIFIED=false in Vercel to pause every
// app-triggered account email (for example if the mailbox password is changed and the sender stops working).
//
// Limit worth knowing: this controls what THIS app triggers. Supabase's public Auth API can still be called directly with the
// public anon key, so the dashboard SMTP/template settings are the real fix; the gate is the app-side guarantee.

export function authEmailSenderVerified(): boolean {
  return process.env.AUTH_EMAIL_SENDER_VERIFIED !== "false";
}

export const SENDER_NOT_READY_MESSAGE =
  "Account email is paused right now, so nothing was sent. Please try again soon.";
