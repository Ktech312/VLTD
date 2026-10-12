// Builds the VLTD email templates for Supabase Auth into docs/supabase-email-templates/.
// Supabase fills the {{ ... }} placeholders itself (Go template syntax); these files are pasted into
// Dashboard > Authentication > Emails (or applied by scripts/apply-supabase-auth-email-config.mjs).
// Run: node scripts/build-supabase-email-templates.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "supabase-email-templates");
mkdirSync(OUT, { recursive: true });

const SITE = "https://vltd.app";
const C = { page: "#05080C", card: "#0E141B", border: "#1D2A35", text: "#E8EDF2", muted: "#9AA7B3", teal: "#41C6E4", tealLight: "#79E7FB", buttonText: "#06171D" };
const GREETING = "{{ if .Data.first_name }}Hi {{ .Data.first_name }},{{ else }}Hi there,{{ end }}";
const HELP = `<a href="${SITE}/guide" style="color:${C.teal};text-decoration:underline;">We’re here to help</a>`;

const p = (html, small = false) =>
  `<tr><td style="padding:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:${small ? 14 : 16}px;line-height:24px;color:${small ? C.muted : C.text};">${html}</td></tr>`;

const button = (label, href) => `<tr><td align="center" style="padding:8px 0 24px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td align="center" bgcolor="${C.teal}" style="border-radius:8px;background:${C.teal};background-image:linear-gradient(180deg,${C.tealLight},${C.teal});">
<a href="${href}" target="_blank" style="display:inline-block;min-width:220px;padding:16px 28px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:20px;font-weight:700;color:${C.buttonText};text-decoration:none;border-radius:8px;text-align:center;">${label}</a>
</td></tr></table>
</td></tr>`;

function layout({ preheader, blocks }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>VLTD</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
<tr><td align="center" style="padding:28px 12px 40px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td align="center" style="padding:8px 0 24px 0;">
      <a href="${SITE}" target="_blank" style="text-decoration:none;"><img src="${SITE}/email/vltd-logo-platinum.png" width="168" alt="VLTD, pronounced Vaulted" style="display:block;border:0;outline:none;width:168px;max-width:100%;height:auto;color:${C.text};font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;"></a>
    </td></tr>
    <tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-top:3px solid ${C.teal};border-radius:12px;padding:32px 28px 20px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:28px;font-weight:700;color:${C.text};">${GREETING}</td></tr>
${blocks.join("\n")}
        <tr><td style="padding:8px 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${C.text};">— The VLTD Team</td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:20px 8px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${C.muted};">VLTD, pronounced &ldquo;Vaulted&rdquo; &middot; <a href="${SITE}" style="color:${C.muted};">vltd.app</a></td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;
}

const templates = {
  // New member / unconfirmed reminder (Supabase uses the same template when it re-sends a confirmation).
  confirmation: {
    subject: "Welcome to the VLTD Club — confirm your email",
    html: layout({
      preheader: "Confirm your email to get started.",
      blocks: [
        p("Welcome to the VLTD Club! Thanks for joining—we can’t wait to see what you collect and share with the community."),
        p("VLTD is built for collectors like you. Your ideas, questions and conversations help shape the community and make the experience better for everyone."),
        p("Confirm your email below to get started."),
        button("Confirm my email", "{{ .ConfirmationURL }}"),
        p("If you didn’t try to join, you can ignore this email."),
        p(`Need a hand? ${HELP}.`),
      ],
    }),
  },
  invite: {
    subject: "You’re invited to join VLTD",
    html: layout({
      preheader: "Accept your invitation and choose a password.",
      blocks: [
        p("You’ve been invited to join the VLTD Club—a home for collectors to catalog, show off and talk about what they collect."),
        p("Accept your invitation below to choose a password and get started."),
        button("Accept my invitation", "{{ .ConfirmationURL }}"),
        p("If you weren’t expecting this, you can ignore this email."),
        p(`Need a hand? ${HELP}.`),
      ],
    }),
  },
  // Used for every password reset, including the one sent when an existing member tries to sign up again.
  recovery: {
    subject: "Reset your VLTD password",
    html: layout({
      preheader: "Choose a new password for your VLTD account.",
      blocks: [
        p("We received a request to reset the password for your VLTD account. Use the button below to choose a new one."),
        button("Reset my password", "{{ .ConfirmationURL }}"),
        p(`Remember your password? <a href="${SITE}/login" style="color:${C.teal};text-decoration:underline;">Log in to VLTD</a>`),
        p("If you didn’t ask for this—or tried to join again when you already have an account—you can ignore this email. Your password hasn’t changed."),
        p(`Need a hand? ${HELP}.`),
      ],
    }),
  },
  magic_link: {
    subject: "Your VLTD sign-in link",
    html: layout({
      preheader: "Tap to log in to VLTD.",
      blocks: [
        p("Use the button below to log in to VLTD."),
        button("Log in to VLTD", "{{ .ConfirmationURL }}"),
        p("If you didn’t ask for this, you can ignore this email."),
        p(`Need a hand? ${HELP}.`),
      ],
    }),
  },
  email_change: {
    subject: "Confirm your new VLTD email",
    html: layout({
      preheader: "Confirm the change to your VLTD email address.",
      blocks: [
        p("Confirm that you’d like to change the email on your VLTD account to <strong>{{ .NewEmail }}</strong>."),
        button("Confirm my new email", "{{ .ConfirmationURL }}"),
        p("If you didn’t ask for this, you can ignore this email. Your email hasn’t changed."),
        p(`Need a hand? ${HELP}.`),
      ],
    }),
  },
  reauthentication: {
    subject: "Your VLTD verification code",
    html: layout({
      preheader: "Your one-time VLTD code.",
      blocks: [
        p("Enter this code in VLTD to continue:"),
        `<tr><td align="center" style="padding:4px 0 24px 0;font-family:Arial,Helvetica,sans-serif;font-size:32px;line-height:40px;font-weight:700;letter-spacing:6px;color:${C.tealLight};">{{ .Token }}</td></tr>`,
        p("If you didn’t ask for this, you can ignore this email.", true),
        p(`Need a hand? ${HELP}.`),
      ],
    }),
  },
};

const subjects = {};
for (const [name, t] of Object.entries(templates)) {
  writeFileSync(join(OUT, `${name}.html`), t.html);
  subjects[name] = t.subject;
}
writeFileSync(join(OUT, "subjects.json"), JSON.stringify(subjects, null, 2) + "\n");
console.log("Wrote", Object.keys(templates).length, "templates and subjects.json to", OUT);
