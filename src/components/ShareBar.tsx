"use client";

import { useState } from "react";

// ── Social icon SVGs ──────────────────────────────────────────────────────────
function CopyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function SmsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="9" y1="10" x2="9" y2="10" strokeWidth="3" />
      <line x1="12" y1="10" x2="12" y2="10" strokeWidth="3" />
      <line x1="15" y1="10" x2="15" y2="10" strokeWidth="3" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

type ShareBarProps = {
  title: string;
  shareUrl?: string;
  /** When true, renders just the icon row with no container or heading */
  compact?: boolean;
};

export default function ShareBar({ title, shareUrl, compact = false }: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  const url = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}&via=vltdapp`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} — ${url}`)}`;
  const tgUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
  const smsUrl = `sms:?body=${encodeURIComponent(`${title} — ${url}`)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(`Check out: ${title}`)}&body=${encodeURIComponent(`${title}\n${url}`)}`;

  const iconBtn = [
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ring-1 transition-all",
    "hover:brightness-125 active:scale-90",
  ].join(" ");

  const iconStyle = {
    background: "rgba(245,181,72,0.12)",
    borderColor: "rgba(245,181,72,0.28)",
    color: "var(--theme-gold, #F5B548)",
  };

  const icons = (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void handleCopy()} className={iconBtn} style={iconStyle} title="Copy link">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className={iconBtn} style={iconStyle} title="Post on X">
        <XIcon />
      </a>
      <a href={fbUrl} target="_blank" rel="noopener noreferrer" className={iconBtn} style={iconStyle} title="Share on Facebook">
        <FacebookIcon />
      </a>
      <a href={waUrl} target="_blank" rel="noopener noreferrer" className={iconBtn} style={iconStyle} title="Share on WhatsApp">
        <WhatsAppIcon />
      </a>
      <a href={tgUrl} target="_blank" rel="noopener noreferrer" className={iconBtn} style={iconStyle} title="Share on Telegram">
        <TelegramIcon />
      </a>
      <a href={smsUrl} className={iconBtn} style={iconStyle} title="Share via SMS">
        <SmsIcon />
      </a>
      <a href={emailUrl} className={iconBtn} style={iconStyle} title="Share via Email">
        <EmailIcon />
      </a>
    </div>
  );

  if (compact) return icons;

  return (
    <div className="rounded-[22px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="mb-3 text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">SHARE THIS ITEM</div>
      {icons}
    </div>
  );
}
