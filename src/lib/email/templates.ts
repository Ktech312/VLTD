// Branded account emails: new member welcome / confirm, confirmation reminder, existing member recovery.
// Plain functions only (no framework imports) so they can be rendered anywhere and tested on their own.
// Layout: dark VLTD background, centered card up to 600px, the approved logo (platinum) above the card text,
// one prominent button, subtle teal accents. Table based with inline styles because that is what mail apps render reliably.

export type EmailKind = "welcome" | "confirm_reminder" | "existing_member";

export type RenderedEmail = { subject: string; html: string; text: string };

export type EmailContext = {
  /** The person's saved first name, if any. Never used unescaped. */
  firstName?: string | null;
  /** Absolute site origin, e.g. https://vltd.app (no trailing slash needed). */
  siteUrl: string;
  /** Confirmation link (welcome / reminder) or password-reset link (existing member). */
  actionUrl: string;
  /** Only set when the sender's reply-to inbox is monitored; decides whether the copy invites replies. */
  replyInvite?: boolean;
};

const COLORS = {
  page: "#05080C",
  card: "#0E141B",
  border: "#1D2A35",
  text: "#E8EDF2",
  muted: "#9AA7B3",
  teal: "#41C6E4",
  tealLight: "#79E7FB",
  buttonText: "#06171D",
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** First word of a saved name, trimmed and length-capped. Empty when nothing usable is saved. */
export function firstNameOf(name?: string | null): string {
  const first = String(name ?? "").trim().split(/\s+/)[0] ?? "";
  return first.slice(0, 40);
}

function origin(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "");
}

function greeting(firstName: string, escape: boolean): string {
  return firstName ? `Hi ${escape ? escapeHtml(firstName) : firstName},` : "Hi there,";
}

type Block =
  | { kind: "p"; html: string; text: string }
  | { kind: "button"; label: string; href: string }
  | { kind: "small"; html: string; text: string };

function paragraph(text: string): Block {
  return { kind: "p", html: escapeHtml(text), text };
}

function linkedParagraph(before: string, label: string, href: string, after = ""): Block {
  return {
    kind: "p",
    html: `${escapeHtml(before)}<a href="${escapeHtml(href)}" style="color:${COLORS.teal};text-decoration:underline;">${escapeHtml(label)}</a>${escapeHtml(after)}`,
    text: `${before}${label}: ${href}${after}`,
  };
}

function layout(opts: { siteUrl: string; preheader: string; blocks: Block[]; greetingHtml: string; signoff: string }): string {
  const base = origin(opts.siteUrl);
  const body = opts.blocks
    .map((block) => {
      if (block.kind === "button") {
        return `<tr><td align="center" style="padding:8px 0 24px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
<td align="center" bgcolor="${COLORS.teal}" style="border-radius:8px;background:${COLORS.teal};background-image:linear-gradient(180deg,${COLORS.tealLight},${COLORS.teal});">
<a href="${escapeHtml(block.href)}" target="_blank" style="display:inline-block;min-width:220px;padding:16px 28px;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:20px;font-weight:700;color:${COLORS.buttonText};text-decoration:none;border-radius:8px;text-align:center;">${escapeHtml(block.label)}</a>
</td></tr></table>
</td></tr>`;
      }
      const size = block.kind === "small" ? "14px" : "16px";
      const color = block.kind === "small" ? COLORS.muted : COLORS.text;
      return `<tr><td style="padding:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:${size};line-height:24px;color:${color};">${block.html}</td></tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>VLTD</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.page}" style="background:${COLORS.page};">
<tr><td align="center" style="padding:28px 12px 40px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td align="center" style="padding:8px 0 24px 0;">
      <a href="${escapeHtml(base)}" target="_blank" style="text-decoration:none;"><img src="${escapeHtml(base)}/email/vltd-logo-platinum.png" width="168" alt="VLTD, pronounced Vaulted" style="display:block;border:0;outline:none;width:168px;max-width:100%;height:auto;color:${COLORS.text};font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;"></a>
    </td></tr>
    <tr><td bgcolor="${COLORS.card}" style="background:${COLORS.card};border:1px solid ${COLORS.border};border-top:3px solid ${COLORS.teal};border-radius:12px;padding:32px 28px 20px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:28px;font-weight:700;color:${COLORS.text};">${opts.greetingHtml}</td></tr>
${body}
        <tr><td style="padding:8px 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;color:${COLORS.text};">${escapeHtml(opts.signoff)}</td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:20px 8px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${COLORS.muted};">VLTD, pronounced &ldquo;Vaulted&rdquo; &middot; <a href="${escapeHtml(base)}" style="color:${COLORS.muted};">vltd.app</a></td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

function plain(greetingText: string, blocks: Block[], signoff: string, siteUrl: string): string {
  const lines: string[] = [greetingText, ""];
  for (const block of blocks) {
    if (block.kind === "button") lines.push(`${block.label}: ${block.href}`, "");
    else lines.push(block.text, "");
  }
  lines.push(signoff, "", `VLTD, pronounced "Vaulted" - ${origin(siteUrl)}`);
  return lines.join("\n");
}

const SIGNOFF = "— The VLTD Team";

export function renderEmail(kind: EmailKind, ctx: EmailContext): RenderedEmail {
  const first = firstNameOf(ctx.firstName);
  const base = origin(ctx.siteUrl);
  const help = linkedParagraph("Need a hand? ", "We’re here to help", `${base}/guide`, ".");

  if (kind === "welcome") {
    const blocks: Block[] = [
      paragraph("Welcome to the VLTD Club! Thanks for joining—we can’t wait to see what you collect and share with the community."),
      paragraph("VLTD is built for collectors like you. Your ideas, questions and conversations help shape the community and make the experience better for everyone."),
      paragraph("Confirm your email below to get started."),
      { kind: "button", label: "Confirm my email", href: ctx.actionUrl },
      // Only invite replies when the reply-to inbox is monitored; otherwise point to the help center.
      ctx.replyInvite ? paragraph("Have a question or an idea? We’d love to hear from you.") : help,
    ];
    return {
      subject: "Welcome to the VLTD Club",
      html: layout({ siteUrl: ctx.siteUrl, preheader: "Confirm your email to get started.", blocks, greetingHtml: greeting(first, true), signoff: SIGNOFF }),
      text: plain(greeting(first, false), blocks, SIGNOFF, ctx.siteUrl),
    };
  }

  if (kind === "confirm_reminder") {
    const blocks: Block[] = [
      paragraph("Thanks for joining the VLTD Club! You’re almost in—confirm your email below to get started."),
      { kind: "button", label: "Confirm my email", href: ctx.actionUrl },
      paragraph("If you didn’t try to join, you can ignore this email."),
      help,
    ];
    return {
      subject: "Confirm your email to join the VLTD Club",
      html: layout({ siteUrl: ctx.siteUrl, preheader: "One tap to confirm your email.", blocks, greetingHtml: greeting(first, true), signoff: SIGNOFF }),
      text: plain(greeting(first, false), blocks, SIGNOFF, ctx.siteUrl),
    };
  }

  const blocks: Block[] = [
    paragraph("You’re already part of the VLTD Club! An account exists with this email, so you can pick up where you left off."),
    paragraph("Forgotten your password? Use the button below to choose a new one."),
    { kind: "button", label: "Reset my password", href: ctx.actionUrl },
    linkedParagraph("Remember your password? ", "Log in to VLTD", `${base}/login`),
    paragraph("If you didn’t try to join again, you can ignore this email. Your password hasn’t changed."),
    help,
  ];
  return {
    subject: first ? `${first}, you’re already part of the VLTD Club` : "You’re already part of the VLTD Club",
    html: layout({ siteUrl: ctx.siteUrl, preheader: "Pick up where you left off.", blocks, greetingHtml: greeting(first, true), signoff: SIGNOFF }),
    text: plain(greeting(first, false), blocks, SIGNOFF, ctx.siteUrl),
  };
}
