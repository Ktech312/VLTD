// Hard stop for account email: nothing in the app may trigger an email from Supabase's Auth mailer unless the
// production project has been switched to VLTD's own sender (custom SMTP with the verified VLTD address, VLTD templates).
//
// Until then Supabase would send from its default "Supabase Auth <noreply@mail.app.supabase.io>" with its default wording,
// and a real person (Debi, 2026-10-12) received exactly that. This gate makes the app refuse instead.
//
// How it is opened: after the Supabase Auth email settings are applied (see docs/supabase-auth-email-setup.md) and a
// test email to an authorized inbox shows the VLTD sender and branding, set AUTH_EMAIL_SENDER_VERIFIED=true in Vercel.
//
// Limit worth knowing: this controls what THIS app triggers. Supabase's public Auth API can still be called directly with the
// public anon key, so the dashboard SMTP/template settings are the real fix; the gate is the app-side guarantee.

export function authEmailSenderVerified(): boolean {
  return process.env.AUTH_EMAIL_SENDER_VERIFIED === "true";
}

export const SENDER_NOT_READY_MESSAGE =
  "Email from VLTD isn’t switched on yet, so this is paused. Nothing was sent. Please try again soon.";
