"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";
import { useDialogA11y } from "@/components/ui/useDialogA11y";
import { FacebookIcon, InstagramIcon, RedditIcon, TelegramIcon, WhatsAppIcon, XIcon } from "@/components/share/socialIcons";

/** Copies text. Resolves false when the browser refused, so the person is never told "copied" when it was not. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the older way */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

type Destination = {
  id: string;
  label: string;
  /** Tile background. */
  tile: string;
  icon: ReactNode;
  /** Plain link (opens another site or app) or an action. */
  href?: string;
  newTab?: boolean;
  onActivate?: () => void;
  /** What actually happens, in plain words, for the title tooltip. */
  how: string;
};

export default function ShareDialog({
  open,
  onClose,
  kind,
  title,
  previewUrl,
  url,
  canShare,
  restriction,
  onExport,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  kind: "item" | "exhibition";
  title: string;
  previewUrl?: string;
  /** The public link. Empty when there is none. */
  url: string;
  /** False for private content: no link and no destinations are offered, the restriction is explained instead. */
  canShare: boolean;
  restriction?: string;
  /** The existing "Export for social" action (owners). */
  onExport?: () => void;
  /** Owner extras, for example regenerating the link. */
  footer?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) {
      setCopy("idle");
      setNote("");
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open]);

  if (!open || !mounted || typeof document === "undefined") return null;

  const hasLink = canShare && Boolean(url);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const kindWord = kind === "item" ? "item" : "exhibition";

  async function handleCopy() {
    const ok = await copyText(url);
    if (ok) {
      setCopy("copied");
      timer.current = setTimeout(() => setCopy("idle"), 2500);
    } else {
      setCopy("failed");
      // The browser would not copy for us: select the link so Ctrl+C / Cmd+C finishes the job.
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }

  async function handleInstagram() {
    const phone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (phone && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* cancelled: fall through to the copy */
      }
    }
    const ok = await copyText(url);
    if (ok) {
      window.open("https://www.instagram.com/", "_blank", "noopener");
      setNote("Link copied. Instagram has no post button for links, so paste it into a new post or message yourself.");
    } else {
      setNote("Could not copy the link. Copy it from the box above, then open Instagram yourself.");
    }
  }

  const destinations: Destination[] = hasLink
    ? [
        { id: "messages", label: "Messages", tile: "linear-gradient(160deg,#4ADE80,#16A34A)", icon: <AppIcon name="sms" size={26} strokeWidth={1.9} />, href: `sms:?body=${encodeURIComponent(`${title} — ${url}`)}`, how: "Opens your messaging app with the link ready to send" },
        { id: "facebook", label: "Facebook", tile: "linear-gradient(160deg,#3B82F6,#1D4ED8)", icon: <FacebookIcon size={28} />, href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, newTab: true, how: "Opens Facebook's share page in a new tab; you press Post there" },
        { id: "whatsapp", label: "WhatsApp", tile: "linear-gradient(160deg,#34D399,#059669)", icon: <WhatsAppIcon size={28} />, href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} — ${url}`)}`, newTab: true, how: "Opens WhatsApp with the message ready; you press Send there" },
        { id: "x", label: "X", tile: "linear-gradient(160deg,#27272A,#000000)", icon: <XIcon size={24} />, href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}&via=vltdapp`, newTab: true, how: "Opens X with the post drafted; you press Post there" },
        { id: "email", label: "Email", tile: "linear-gradient(160deg,#9CA3AF,#4B5563)", icon: <AppIcon name="email" size={26} strokeWidth={1.9} />, href: `mailto:?subject=${encodeURIComponent(`Check out: ${title}`)}&body=${encodeURIComponent(`${title}\n${url}`)}`, how: "Opens your email app with a draft; you press Send there" },
        { id: "reddit", label: "Reddit", tile: "linear-gradient(160deg,#FB923C,#EA580C)", icon: <RedditIcon size={28} />, href: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`, newTab: true, how: "Opens Reddit's submit page in a new tab; you press Post there" },
        { id: "telegram", label: "Telegram", tile: "linear-gradient(160deg,#38BDF8,#0284C7)", icon: <TelegramIcon size={28} />, href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`, newTab: true, how: "Opens Telegram with the message ready; you press Send there" },
        { id: "instagram", label: "Instagram", tile: "linear-gradient(160deg,#F59E0B,#DB2777 55%,#7C3AED)", icon: <InstagramIcon size={28} />, onActivate: () => void handleInstagram(), how: "Copies the link and opens Instagram; you paste it into a post yourself" },
      ]
    : [];

  const tileProps = (d: Destination) =>
    ({
      className: "vltd-glass-destination flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 text-center text-[11.5px] font-medium text-white/90 focus:outline-none",
      title: d.how,
      "aria-label": `${d.label}: ${d.how}`,
    }) as const;

  const panel = (
    <div className="fixed inset-0 z-[10001] flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${kindWord}`}
        onClick={(event) => event.stopPropagation()}
        className="vltd-dark-surface relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[26px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white shadow-2xl ring-1 ring-white/10 sm:max-w-[520px] sm:rounded-[26px]"
        style={{ background: "linear-gradient(180deg, rgba(26,31,39,0.98), rgba(13,16,21,0.99))" }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Share</h2>
          <PillButton onClick={onClose} ariaLabel="Close" title="Close" className="w-11 px-0! md:w-9">
            <AppIcon name="close" size={16} />
          </PillButton>
        </div>

        {/* what is being shared */}
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/5 p-2.5 ring-1 ring-white/10">
          <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/10">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              <div className="grid h-full w-full place-items-center text-white/40">
                <AppIcon name={kind === "item" ? "key" : "exhibition"} size={20} />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="line-clamp-2 text-sm font-semibold leading-snug">{title}</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-white/50">{kind === "item" ? "Item" : "Exhibition"}</div>
          </div>
        </div>

        {hasLink ? (
          <>
            <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Send it with</div>
            <div className="vltd-glass-dock mt-2 grid grid-cols-4 gap-x-1 gap-y-3 p-3">
              {destinations.map((d) =>
                d.href ? (
                  <a key={d.id} href={d.href} {...(d.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} {...tileProps(d)}>
                    <span className="vltd-glass-tile" style={{ background: d.tile }}>{d.icon}</span>
                    <span className="w-full truncate">{d.label}</span>
                  </a>
                ) : (
                  <button key={d.id} type="button" onClick={d.onActivate} {...tileProps(d)}>
                    <span className="vltd-glass-tile" style={{ background: d.tile }}>{d.icon}</span>
                    <span className="w-full truncate">{d.label}</span>
                  </button>
                )
              )}
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-white/55">
              These open the app or website with your link ready. Nothing is posted until you confirm it there.
            </p>
            {note ? (
              <p role="status" className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-[12px] leading-snug text-white/80 ring-1 ring-white/10">
                {note}
              </p>
            ) : null}

            <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">Link</div>
            <div className="mt-2 flex items-center gap-2 rounded-2xl bg-black/50 p-1.5 pl-3 ring-1 ring-white/10">
              <input
                ref={inputRef}
                readOnly
                value={url}
                aria-label={`Link to this ${kindWord}`}
                onFocus={(event) => event.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-white/90 focus:outline-none"
                style={{ background: "transparent", color: "rgba(255,255,255,0.92)" }}
              />
              <PillButton variant={copy === "copied" ? "success" : "default"} onClick={() => void handleCopy()} className="shrink-0">
                {copy === "copied" ? (
                  <>
                    <AppIcon name="checkmark" size={16} strokeWidth={2.4} />
                    Copied
                  </>
                ) : (
                  <>
                    <AppIcon name="copy" size={16} />
                    Copy link
                  </>
                )}
              </PillButton>
            </div>
            <div role="status" aria-live="polite" className="mt-1.5 min-h-[18px] text-[12px]">
              {copy === "copied" ? <span className="text-emerald-300">Link copied to your clipboard.</span> : null}
              {copy === "failed" ? (
                <span className="text-amber-300">Your browser would not copy it. The link is selected: press Ctrl+C (Cmd+C on a Mac).</span>
              ) : null}
            </div>
          </>
        ) : (
          <div role="status" className="mt-4 rounded-2xl bg-amber-400/10 p-3 text-[13px] leading-relaxed text-amber-100 ring-1 ring-amber-300/30">
            {restriction || `This ${kindWord} has no public link, so there is nothing to share.`}
          </div>
        )}

        {onExport ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <PillButton
              onClick={() => {
                onClose();
                onExport();
              }}
            >
              <AppIcon name="share" size={16} /> Export for social
            </PillButton>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/55">Makes a picture or video you can save and post yourself. It does not post anything.</p>
          </div>
        ) : null}

        {footer ? <div className="mt-4 border-t border-white/10 pt-4">{footer}</div> : null}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
