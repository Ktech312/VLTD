"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { PillButton } from "@/components/ui/PillButton";
import { AppIcon } from "@/components/ui/AppIcon";
import {
  getOrCreateReferralCode,
  getReferralStats,
  getUserBonusGalleries,
  REFERRAL_BONUS_GALLERIES,
  REFERRED_BONUS_GALLERIES,
} from "@/lib/referral";

function CopyIcon({ size = 16 }: { size?: number }) {
  return <AppIcon name="copy" size={size} strokeWidth={2} />;
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return <AppIcon name="checkmark" size={size} strokeWidth={2.5} />;
}

function GiftIcon() {
  return <AppIcon name="gift" size={22} strokeWidth={1.75} />;
}

function UsersIcon() {
  return <AppIcon name="users" size={22} strokeWidth={1.75} />;
}

function ExhibitIcon() {
  return <AppIcon name="organize" size={22} strokeWidth={1.75} />;
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
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-[color:var(--border)]" style={{ background: "rgba(203,208,213,0.10)", color: "#C8CDD2" }}>
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
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(203,208,213,0.10)", color: "#C8CDD2" }}>
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
              <span className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold" style={{ background: "rgba(203,208,213,0.15)", color: "#C8CDD2" }}>
                {code}
              </span>
            </div>

            <div className="flex gap-2">
              <PillButton
                onClick={() => void handleCopy()}
                className="flex-1"
                style={
                  copied
                    ? { background: "rgba(74,222,128,0.15)", color: "#4ade80" }
                    : { background: "rgba(203,208,213,0.15)", color: "#C8CDD2" }
                }
              >
                {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
                {copied ? "Copied!" : "Copy link"}
              </PillButton>
              <PillButton
                onClick={handleShare}
                className="flex-1"
                style={{ background: "rgba(203,208,213,0.15)", color: "#C8CDD2" }}
              >
                <AppIcon name="share" size={15} strokeWidth={2} />
                Share
              </PillButton>
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
              <p className="text-2xl font-bold" style={{ color: "#C8CDD2" }}>{value}</p>
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
