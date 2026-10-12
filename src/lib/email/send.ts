// Outgoing account email. Uses Resend's HTTP API when RESEND_API_KEY and EMAIL_FROM are set; otherwise reports "not configured"
// so callers fall back to Supabase's own account emails and nothing is silently lost.
//   RESEND_API_KEY   API key from resend.com (free tier is enough to start)
//   EMAIL_FROM       e.g. "VLTD <hello@vltd.app>" — the domain must be verified with the provider (SPF/DKIM)
//   EMAIL_REPLY_TO   optional; set ONLY if that inbox is monitored — the welcome email then invites replies

export type OutgoingEmail = { to: string; subject: string; html: string; text: string };

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function replyInboxMonitored(): boolean {
  return Boolean(process.env.EMAIL_REPLY_TO);
}

export async function sendEmail(message: OutgoingEmail): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { ok: false, error: "not_configured" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { ok: false, error: `provider_${response.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send_failed" };
  }
}
