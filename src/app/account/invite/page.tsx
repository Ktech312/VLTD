"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  getOrCreateReferralCode,
  getReferralStats,
  getUserBonusGalleries,
  REFERRAL_BONUS_GALLERIES,
  REFERRED_BONUS_GALLERIES,
} from "@/lib/referral";

function CopyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ExhibitIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

export default function InvitePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [bonusEarned, setBonusEarned] = useState(0);
  const [totalBonus, setTotalBonus] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralUrl = code ? `${origin}/?ref=${code}` : "";

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setLoading(false); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      setUserId(user.id);

      const [myCode, stats, bonus] = await Promise.all([
        getOrCreateReferralCode(user.id),
        getReferralStats(user.id),
        getUserBonusGalleries(user.id),
      ]);

      setCode(myCode);
      setReferralCount(stats.referralCount);
      setBonusEarned(stats.bonusEarned);
      setTotalBonus(bonus);
      setLoading(false);
    }
    void load();
  }, []);

  async function handleCopy() {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = referralUrl;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (!referralUrl) return;
    const text = `Join me on VLTD — the collector's vault app. Use my invite link to get ${REFERRED_BONUS_GALLERIES} bonus Exhibition${REFERRED_BONUS_GALLERIES !== 1 ? "s" : ""} free:`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      void navigator.share({ title: "Join me on VLTD", text, url: referralUrl });
    } else {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text} ${referralUrl}`)}`;
      window.open(waUrl, "_blank");
    }
  }

  const goldBtn = "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition active:scale-95";

  const shareMessage = `Join me on VLTD — the collector's vault app. Grab ${REFERRED_BONUS_GALLERIES} free Exhibition${REFERRED_BONUS_GALLERIES !== 1 ? "s" : ""} with my invite:`;
  const enc = encodeURIComponent;
  const shareTargets = referralUrl
    ? [
        { label: "Text", href: `sms:?&body=${enc(`${shareMessage} ${referralUrl}`)}`, external: false },
        { label: "WhatsApp", href: `https://api.whatsapp.com/send?text=${enc(`${shareMessage} ${referralUrl}`)}`, external: true },
        { label: "X", href: `https://twitter.com/intent/tweet?text=${enc(shareMessage)}&url=${enc(referralUrl)}`, external: true },
        { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(referralUrl)}`, external: true },
        { label: "Reddit", href: `https://www.reddit.com/submit?url=${enc(referralUrl)}&title=${enc(shareMessage)}`, external: true },
        { label: "Email", href: `mailto:?subject=${enc("Join me on VLTD")}&body=${enc(`${shareMessage}\n\n${referralUrl}`)}`, external: false },
      ]
    : [];

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-[color:var(--border)]" style={{ background: "rgba(245,181,72,0.10)", color: "#F5B548" }}>
          <GiftIcon />
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--fg)" }}>Invite &amp; Earn</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Share VLTD, unlock more Exhibitions</p>
        </div>
      </div>

      {/* How it works */}
      <div className="mb-6 rounded-2xl p-4 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <p className="mb-3 text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>HOW IT WORKS</p>
        <div className="flex flex-col gap-3">
          {[
            {
              icon: <GiftIcon />,
              label: "Share your invite link",
              desc: "Send your personal link to friends and collectors.",
            },
            {
              icon: <UsersIcon />,
              label: "They join VLTD",
              desc: `Your friend signs up and gets +${REFERRED_BONUS_GALLERIES} free Exhibition${REFERRED_BONUS_GALLERIES !== 1 ? "s" : ""} instantly.`,
            },
            {
              icon: <ExhibitIcon />,
              label: `You earn +${REFERRAL_BONUS_GALLERIES} Exhibition`,
              desc: "For every friend who joins, your Exhibition limit grows.",
            },
          ].map(({ icon, label, desc }, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(245,181,72,0.10)", color: "#F5B548" }}>
                {icon}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{label}</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Your link */}
      <div className="mb-6 rounded-2xl p-4 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <p className="mb-2 text-xs font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>YOUR INVITE LINK</p>

        {loading ? (
          <div className="h-10 animate-pulse rounded-xl" style={{ background: "var(--pill)" }} />
        ) : code ? (
          <>
            <div
              className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-mono ring-1 ring-[color:var(--border)]"
              style={{ background: "var(--pill)", color: "var(--fg)" }}
            >
              <span className="flex-1 truncate text-xs">{referralUrl}</span>
              <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: "rgba(245,181,72,0.15)", color: "#F5B548" }}>
                {code}
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className={`${goldBtn} flex-1`}
                style={
                  copied
                    ? { background: "rgba(74,222,128,0.15)", color: "#4ade80" }
                    : { background: "rgba(245,181,72,0.15)", color: "#F5B548" }
                }
              >
                {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className={`${goldBtn} flex-1`}
                style={{ background: "rgba(245,181,72,0.15)", color: "#F5B548" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share
              </button>
            </div>

            {/* Share to specific apps — works on desktop where the native sheet isn't available */}
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold tracking-widest" style={{ color: "var(--muted2)" }}>SHARE TO</p>
              <div className="grid grid-cols-3 gap-2">
                {shareTargets.map((t) => (
                  <a
                    key={t.label}
                    href={t.href}
                    target={t.external ? "_blank" : undefined}
                    rel={t.external ? "noopener noreferrer" : undefined}
                    className="flex items-center justify-center rounded-xl px-2 py-2.5 text-xs font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
                    style={{ color: "var(--fg)" }}
                  >
                    {t.label}
                  </a>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--muted)" }}>Sign in to get your invite link.</p>
        )}
      </div>

      {/* Stats */}
      {userId && !loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Friends Invited", value: referralCount },
            { label: "Bonus Earned", value: `+${bonusEarned}` },
            { label: "Total Bonus", value: `+${totalBonus}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl p-3 ring-1 ring-[color:var(--border)] text-center" style={{ background: "var(--surface)" }}>
              <p className="text-2xl font-bold" style={{ color: "#F5B548" }}>{value}</p>
              <p className="mt-0.5 text-[10px] leading-tight" style={{ color: "var(--muted)" }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Fine print */}
      <p className="mt-6 text-center text-xs leading-relaxed" style={{ color: "var(--muted2)" }}>
        Bonus Exhibitions apply to your Free account. Each friend who joins adds +{REFERRAL_BONUS_GALLERIES} Exhibition to your limit. No cap.
      </p>
    </main>
  );
}
