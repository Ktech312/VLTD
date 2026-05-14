"use client";

import { useState } from "react";
import { Copy, Check, Mail, MessageSquare } from "lucide-react";

// Simple inline SVGs for X (Twitter) and Facebook since lucide doesn't include brand icons
function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

type ShareBarProps = {
  title: string;
  shareUrl?: string;
};

export default function ShareBar({ title, shareUrl }: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  const url = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}&via=vltdapp`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const smsBody = encodeURIComponent(`${title} — ${url}`);
  const smsUrl = `sms:?body=${smsBody}`;
  const emailSubject = encodeURIComponent(`Check out this item: ${title}`);
  const emailBody = encodeURIComponent(`I found this on VLTD:\n\n${title}\n${url}`);
  const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  const btnBase =
    "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ring-1 transition hover:opacity-80 active:scale-95";
  const btnMuted =
    `${btnBase} bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--border)]`;

  return (
    <div className="rounded-[22px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="mb-3 text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">SHARE THIS ITEM</div>
      <div className="flex flex-wrap gap-2">
        {/* Copy Link */}
        <button
          type="button"
          onClick={() => void handleCopy()}
          className={btnMuted}
          style={copied ? { color: "var(--theme-gold, #F5B548)", borderColor: "rgba(245,181,72,0.4)" } : {}}
        >
          {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={2} />}
          {copied ? "Copied!" : "Copy link"}
        </button>

        {/* X (Twitter) */}
        <a
          href={tweetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={btnMuted}
        >
          <XIcon size={13} />
          Post on X
        </a>

        {/* Facebook */}
        <a
          href={fbUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={btnMuted}
        >
          <FacebookIcon size={14} />
          Facebook
        </a>

        {/* SMS */}
        <a
          href={smsUrl}
          className={btnMuted}
        >
          <MessageSquare size={14} strokeWidth={2} />
          SMS
        </a>

        {/* Email */}
        <a
          href={emailUrl}
          className={btnMuted}
        >
          <Mail size={14} strokeWidth={2} />
          Email
        </a>
      </div>
    </div>
  );
}
