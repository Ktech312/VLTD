"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Glyph, type GlyphName } from "@/components/ui/Glyph";
import { useRouter } from "next/navigation";
import { getCurrentUser, initAuthListener } from "@/lib/auth";
import { useTheme } from "@/lib/ThemeContext";

import {
  GALLERY_EVENT,
  loadAllGalleries,
  refreshGalleriesFromSupabase,
  type Gallery,
} from "@/lib/galleryModel";
import { getVaultImagePublicUrl, isDirectBrowserImageUrl } from "@/lib/vaultCloud";
import VltdVaultLogoAnimation from "@/components/VltdVaultLogoAnimation";

type PublicGalleryCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  image: string;
  itemCount: number;
  views: number;
  category: string;
};

type UniverseCard = {
  icon: GlyphName;
  title: string;
  meta: string;
  description: string;
};

const ICON_SVG = {
  common: {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  },
};

const FEATURE_CARDS: { icon: React.ReactNode; title: string; description: string }[] = [
  {
    title: "Private Vault",
    description: "Your data. Your control. Locked in, always.",
    icon: (
      <svg {...ICON_SVG.common}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    ),
  },
  {
    title: "Portfolio Intelligence",
    description: "Real-time values, analytics, and market insights.",
    icon: (
      <svg {...ICON_SVG.common}>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    title: "Insurance Ready",
    description: "Export complete, accurate records in seconds.",
    icon: (
      <svg {...ICON_SVG.common}>
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Museum Display",
    description: "Create stunning galleries. Share or keep private.",
    icon: (
      <svg {...ICON_SVG.common}>
        <path d="M3 21h18" />
        <path d="M5 21V9M10 21V9M14 21V9M19 21V9" />
        <path d="M3 9l9-5 9 5" />
      </svg>
    ),
  },
  {
    title: "Sell Anywhere",
    description: "Export anytime. List on any platform you want.",
    icon: (
      <svg {...ICON_SVG.common}>
        <path d="M4 15a4 4 0 0 1 1-7.9A5 5 0 0 1 19 8a4 4 0 0 1-.5 8" />
        <path d="M12 12v7" />
        <path d="M9 15l3-3 3 3" />
      </svg>
    ),
  },
  {
    title: "No Lock-In",
    description: "Your collection is yours. Take it anywhere.",
    icon: (
      <svg {...ICON_SVG.common}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 7-2.4" />
      </svg>
    ),
  },
];

const VAULT_UNIVERSES: UniverseCard[] = [
  {
    icon: "burst",
    title: "Pop Culture",
    meta: "Comics · Figures",
    description: "Marvel, DC, manga, figures, and entertainment collectibles.",
  },
  {
    icon: "trophy",
    title: "Sports",
    meta: "Cards · Autos",
    description: "Sports cards, jerseys, autographs, and game-used gear.",
  },
  {
    icon: "cards",
    title: "TCG",
    meta: "Singles · Slabs",
    description: "Pokemon, Magic, Yu-Gi-Oh!, and graded cards.",
  },
  {
    icon: "music",
    title: "Music",
    meta: "Vinyl · Albums",
    description: "Vinyl, signed records, instruments, and artist collectibles.",
  },
  {
    icon: "gem",
    title: "Jewelry",
    meta: "Watches · Drops",
    description: "Watches, luxury accessories, apparel, and limited drops.",
  },
  {
    icon: "game",
    title: "Games",
    meta: "Consoles · Sealed",
    description: "Video games, consoles, controllers, and arcade pieces.",
  },
  {
    icon: "star",
    title: "Misc",
    meta: "Unique · Mixed",
    description: "Coins, art, oddities, and anything unique.",
  },
];

const HOW_IT_WORKS = [
  { n: 1, title: "Capture", desc: "Take photos or scan. We handle the rest." },
  { n: 2, title: "We analyze", desc: "AI reads, values, and grades with precision." },
  { n: 3, title: "Secure in your vault", desc: "Everything organized, private, and backed up." },
  { n: 4, title: "Track & grow", desc: "Watch values, trends, and portfolio performance." },
  { n: 5, title: "Share or sell", desc: "Display in galleries or export anywhere." },
];

const COMPARISON_ROWS = [
  ["Multi-category vault", "One category", "All 7 universes"],
  ["Portfolio analytics", "Basic", "Full P&L tracking"],
  ["Public gallery", "No", "Museum view"],
  ["Insurance documentation", "No", "Printable packet"],
  ["AI identification & pricing", "Manual", "Smart Scan"],
  ["Offline capture queue", "No", "Built in"],
  ["Spreadsheet imports", "Limited", "CSV, Excel, eBay, Whatnot"],
  ["Public share link", "Partial", "Private by default"],
  ["Marketplace listing prep", "Manual", "Multi-channel drafts"],
  ["Team & multi-profile", "No", "Yes"],
];

const FALLBACK_GALLERIES: PublicGalleryCard[] = [
  {
    id: "sample-pop-culture",
    title: "Pop Culture Collection",
    description: "Public gallery display for comics, figures, and key collectibles.",
    href: "/signup",
    image: "/themes/classic-shelf-wall.webp",
    itemCount: 7,
    views: 24,
    category: "Pop Culture",
  },
  {
    id: "sample-tcg",
    title: "TCG Slabs",
    description: "A clean gallery for slabs, singles, grades, and cert details.",
    href: "/signup",
    image: "/themes/midnight-shelf-wall.webp",
    itemCount: 12,
    views: 18,
    category: "TCG",
  },
  {
    id: "sample-sports",
    title: "Sports Memorabilia",
    description: "A public showcase for cards, autos, jerseys, and signed gear.",
    href: "/signup",
    image: "/themes/walnut-shelf-wall.webp",
    itemCount: 5,
    views: 11,
    category: "Sports",
  },
];

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferCategory(gallery: Gallery) {
  const text = normalizeText(
    [
      gallery.title,
      gallery.description,
      gallery.themePack,
      ...(gallery.publicItemSnapshots ?? []).flatMap((item) => [
        item.title,
        item.subtitle,
        item.grade,
      ]),
    ]
      .filter(Boolean)
      .join(" "),
  );

  if (/pokemon|magic|yugioh|tcg|card|slab/.test(text)) return "TCG";
  if (/sports|rookie|jersey|autograph|memorabilia|baseball|basketball|football/.test(text)) return "Sports";
  if (/vinyl|album|music|record|artist/.test(text)) return "Music";
  if (/watch|jewelry|apparel|streetwear|luxury/.test(text)) return "Jewelry";
  if (/game|console|nintendo|playstation|xbox|arcade/.test(text)) return "Games";
  if (/comic|marvel|dc|figure|toy|manga|poster|prop/.test(text)) return "Pop Culture";

  return "Misc";
}

function resolveSnapshotImage(gallery: Gallery) {
  const snapshot = gallery.publicItemSnapshots?.find(
    (item) =>
      item.imageFrontUrl ||
      item.imageBackUrl ||
      item.imageFrontStoragePath ||
      item.primaryImageKey,
  );

  const directUrl = snapshot?.imageFrontUrl || snapshot?.imageBackUrl || "";
  if (directUrl && isDirectBrowserImageUrl(directUrl)) return directUrl;

  const storagePath =
    snapshot?.imageFrontStoragePath || snapshot?.primaryImageKey || "";
  if (storagePath) return getVaultImagePublicUrl(storagePath);

  return "";
}

function galleryImage(gallery: Gallery) {
  if (gallery.coverImage) return gallery.coverImage;
  const snapshotImage = resolveSnapshotImage(gallery);
  if (snapshotImage) return snapshotImage;
  if (gallery.themePack === "walnut") return "/themes/walnut-shelf-wall.webp";
  if (gallery.themePack === "midnight") return "/themes/midnight-shelf-wall.webp";
  if (gallery.themePack === "cold-blue") return "/themes/cold-blue-bg.png";
  return "/themes/classic-shelf-wall.webp";
}

function toPublicCard(gallery: Gallery): PublicGalleryCard {
  const token = gallery.share?.publicToken;

  return {
    id: gallery.id,
    title: gallery.title,
    description:
      gallery.description?.trim() ||
      `${gallery.itemIds.length || gallery.publicItemSnapshots?.length || 0} piece public collection.`,
    href: token
      ? `/museum/share/${encodeURIComponent(token)}`
      : `/gallery/${encodeURIComponent(gallery.id)}`,
    image: galleryImage(gallery),
    itemCount: gallery.itemIds.length || gallery.publicItemSnapshots?.length || 0,
    views: gallery.analytics?.views ?? 0,
    category: inferCategory(gallery),
  };
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2 font-black tracking-[0.08em] text-text-primary">
      <span className="vltd-brand-dot h-2.5 w-2.5" />
      <span>VLTD</span>
      <span className="text-[8px] text-[color:var(--muted2)]">TM</span>
    </div>
  );
}

function PublicGalleryTile({ gallery }: { gallery: PublicGalleryCard }) {
  return (
    <Link
      href={gallery.href}
      className="group overflow-hidden rounded-2xl transition hover:-translate-y-1"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.12),rgba(203,208,213,0.04)_34%,rgba(0,0,0,0.22)_100%)] p-3">
        <img
          src={gallery.image}
          alt={gallery.title}
          className="h-full w-full object-contain opacity-80 transition duration-500 group-hover:scale-[1.025] group-hover:opacity-95"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
      </div>
      <div className="p-4">
        <div className="text-sm font-black" style={{ color: 'var(--fg)' }}>{gallery.title}</div>
        <div className="mt-1 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
          {gallery.category} · {gallery.itemCount} pieces · {gallery.views} views
        </div>
      </div>
    </Link>
  );
}


export default function PublicHomeClient() {
  const { theme } = useTheme();
  const cardBg = theme.bgCard;
  const router = useRouter();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Beta waitlist state
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "loading" | "success" | "already" | "error">("idle");
  const [waitlistMessage, setWaitlistMessage] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);

  // Redirect logged-in users to dashboard
  useEffect(() => {
    initAuthListener();
    getCurrentUser().then(({ data: { user } }) => {
      if (user) {
        setSignedIn(true);
        router.replace("/dashboard");
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  useEffect(() => {
    function loadPublicGalleries() {
      setGalleries(
        loadAllGalleries()
          .filter(
            (gallery) =>
              gallery.state === "ACTIVE" && gallery.visibility === "PUBLIC",
          )
          .sort((a, b) => Number(b.updatedAt ?? 0) - Number(a.updatedAt ?? 0)),
      );
    }

    loadPublicGalleries();
    void refreshGalleriesFromSupabase(true).then(loadPublicGalleries);

    window.addEventListener(GALLERY_EVENT, loadPublicGalleries);
    return () => window.removeEventListener(GALLERY_EVENT, loadPublicGalleries);
  }, []);

  const galleryCards = useMemo(() => {
    const live = galleries.slice(0, 6).map(toPublicCard);
    return live.length ? live : FALLBACK_GALLERIES;
  }, [galleries]);

  // Opening the form submit no longer sends immediately — it gates the request
  // behind the beta consent agreement (checkbox required before we submit).
  function handleWaitlistSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!waitlistEmail || waitlistStatus === "loading") return;
    setConsentAgreed(false);
    setShowConsent(true);
  }

  async function submitWaitlist() {
    if (!waitlistEmail || !consentAgreed || waitlistStatus === "loading") return;
    setShowConsent(false);
    setWaitlistStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: waitlistEmail,
          source: "landing",
          consented_at: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.already) {
        setWaitlistStatus("already");
        setWaitlistMessage(data.message);
      } else if (res.ok) {
        setWaitlistStatus("success");
        setWaitlistMessage(data.message);
        setWaitlistEmail("");
      } else {
        setWaitlistStatus("error");
        setWaitlistMessage(data.message || "Something went wrong. Try again.");
      }
    } catch {
      setWaitlistStatus("error");
      setWaitlistMessage("Couldn't connect. Check your internet and try again.");
    }
  }

  // Show nothing while checking auth (prevents flash of marketing page for logged-in users)
  if (!authChecked) {
    return <div className="bg-[color:var(--bg)]" />;
  }

  return (
    <main className="text-[color:var(--fg)]">
      <section className="border-b border-[color:var(--border)]">
        {/* ── Top nav ───────────────────────────────────────────── */}
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <BrandMark />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/learn"
              className="hidden sm:inline-flex rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap text-[color:var(--muted)] transition hover:text-text-primary"
            >
              Learn
            </Link>
            {!signedIn && (
              <>
                <Link
                  href="/login"
                  className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-semibold whitespace-nowrap text-[color:var(--muted)] transition hover:text-text-primary"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="vltd-primary-button rounded-full px-4 py-2 text-sm font-black whitespace-nowrap transition"
                >
                  <span className="md:hidden">Start free</span>
                  <span className="hidden md:inline">Start your vault</span>
                </Link>
              </>
            )}
            {signedIn && (
              <Link
                href="/dashboard"
                className="vltd-primary-button rounded-full px-4 py-2 text-sm font-black whitespace-nowrap transition"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>

        {/* ── Hero — two-column: copy + CTAs left, vault visual right ─ */}
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-12 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            {/* Left — copy + calls to action */}
            <div className="text-center lg:text-left">
              <h1 className="mx-auto max-w-2xl text-4xl font-black leading-[0.96] tracking-[-0.06em] text-text-primary sm:text-5xl lg:mx-0 lg:text-6xl">
                Your collection deserves a <span className="text-[color:var(--accent)]">real home.</span>
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[color:var(--muted)] lg:mx-0">
                Private vault. Museum display. Portfolio intelligence. Insurance
                records. One home for every card, comic, record, slab, game, and
                piece you collect.
              </p>

              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href="/signup"
                  className="vltd-primary-button inline-flex h-12 items-center justify-center rounded-full px-7 text-sm font-black transition"
                >
                  Start your vault — it&apos;s free →
                </Link>
                <Link
                  href="#public-galleries"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-[color:var(--border)] px-7 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
                  style={{ background: cardBg }}
                >
                  View public galleries
                </Link>
              </div>

              {/* Trust row */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start">
                {["No credit card", "No ads", "No lock-in"].map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--muted2)]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — vault visual */}
            <div className="flex flex-col items-center">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">
                Your Digital Vault
              </div>
              <VltdVaultLogoAnimation className="vltd-hero-vault-center" defaultOpen />
            </div>
          </div>
        </div>
      </section>

      {/* ── Beta invite / early access ────────────────────────── */}
      <section id="early-access" className="scroll-mt-24 border-b" style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg, rgba(203,208,213,0.06) 0%, var(--bg) 60%)' }}>
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(203,208,213,0.32)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: '#C8CDD2', background: 'rgba(203,208,213,0.07)' }}>
            Beta Access
          </div>
          <h2 className="text-2xl font-black tracking-[-0.04em] text-text-primary sm:text-3xl">
            Join the early access list.
          </h2>
          <p className="mt-2 text-base leading-7" style={{ color: 'var(--muted)' }}>
            VLTD is invite-only during beta. Drop your email and we&apos;ll reach out when your spot is ready.
          </p>
          {waitlistStatus === "success" || waitlistStatus === "already" ? (
            <div className="mt-6 rounded-2xl border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.06)] px-6 py-5 text-center">
              <div className="mb-2 flex justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12.5l2.5 2.5 5-6" />
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>{waitlistMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleWaitlistSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <input
                type="email"
                required
                placeholder="your@email.com"
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                className="h-12 flex-1 max-w-sm rounded-full border px-5 text-sm outline-none transition focus:ring-2 focus:ring-[rgba(203,208,213,0.4)]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--fg)' }}
                disabled={waitlistStatus === "loading"}
              />
              <button
                type="submit"
                disabled={waitlistStatus === "loading"}
                className="vltd-primary-button h-12 rounded-full px-6 text-sm font-black transition disabled:opacity-60 whitespace-nowrap"
              >
                {waitlistStatus === "loading" ? "Sending…" : "Request early access →"}
              </button>
            </form>
          )}
          {waitlistStatus === "error" && (
            <p className="mt-3 text-xs" style={{ color: '#f87171' }}>{waitlistMessage}</p>
          )}
          <p className="mt-3 text-xs" style={{ color: 'var(--muted2)' }}>No spam. Invite-only slots are limited.</p>
        </div>
      </section>

      {/* ── Beta consent gate ─────────────────────────────────────── */}
      {showConsent && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Beta access agreement"
        >
          <div
            className="w-full max-w-md rounded-[26px] p-6 sm:p-7"
            style={{
              background: 'var(--theme-elevated, rgba(12,18,30,0.98))',
              border: '1px solid var(--theme-gold-border, rgba(203,208,213,0.28))',
              boxShadow: '0 28px 90px rgba(0,0,0,0.5)',
            }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: '#C8CDD2', borderColor: 'rgba(203,208,213,0.32)', background: 'rgba(203,208,213,0.07)' }}>
              Beta Access
            </div>
            <h3 className="mt-4 text-xl font-black tracking-[-0.02em] text-text-primary">VLTD Beta Access</h3>
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>
              VLTD is currently in private beta. This is pre-release software offered for evaluation, and you may
              occasionally encounter bugs or features that change as we improve the experience. Your feedback directly
              shapes the product.
            </p>
            <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>
              By requesting access, you acknowledge that the app is provided &quot;as is&quot; during beta, that VLTD is not
              liable for interruptions or data loss while in testing, and you agree to be contacted regarding your
              invitation and for product feedback.
            </p>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <input
                type="checkbox"
                checked={consentAgreed}
                onChange={(e) => setConsentAgreed(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[#C8CDD2]"
              />
              <span className="text-sm font-semibold text-text-primary">
                I have read and agree to the Beta Testing Terms.
              </span>
            </label>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse">
              <button
                type="button"
                disabled={!consentAgreed}
                onClick={() => void submitWaitlist()}
                className="vltd-primary-button h-12 flex-1 rounded-full px-6 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45"
              >
                Agree &amp; request access →
              </button>
              <button
                type="button"
                onClick={() => setShowConsent(false)}
                className="h-12 rounded-[8px] border px-6 text-sm font-semibold transition"
                style={{ borderColor: 'var(--border)', background: 'var(--pill)', color: 'var(--muted)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="mx-auto grid max-w-7xl divide-y divide-[color:var(--border)] px-4 sm:px-6 sm:grid-cols-2 sm:divide-x sm:divide-y-0 md:grid-cols-3 lg:grid-cols-6 lg:divide-x lg:divide-y-0 lg:px-8">
          {FEATURE_CARDS.map((feature) => (
            <div key={feature.title} className="px-2 py-7 md:px-6">
              <div
                className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border"
                style={{ borderColor: 'var(--theme-gold-border, rgba(203,208,213,0.3))', background: 'rgba(203,208,213,0.08)', color: 'var(--theme-gold, #C8CDD2)' }}
              >
                {feature.icon}
              </div>
              <div className="text-[13px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--theme-gold, #C8CDD2)' }}>
                {feature.title}
              </div>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works — 5 numbered steps ──────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">
            How it works
          </div>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-text-primary">
            From shoebox to vault in five steps.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {HOW_IT_WORKS.map((step, i) => (
            <div
              key={step.n}
              className="relative rounded-2xl p-5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black"
                style={{ borderColor: 'var(--theme-gold-border, rgba(203,208,213,0.4))', color: 'var(--theme-gold, #C8CDD2)' }}
              >
                {step.n}
              </div>
              <div className="mt-4 text-sm font-black text-text-primary">{step.title}</div>
              <p className="mt-1.5 text-sm leading-6 text-[color:var(--muted)]">{step.desc}</p>
              {i < HOW_IT_WORKS.length - 1 && (
                <span className="pointer-events-none absolute right-[-13px] top-1/2 hidden -translate-y-1/2 text-lg text-[color:var(--muted2)] lg:block">
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">
            Vault Universes
          </div>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-text-primary">
            Every category. One vault.
          </h2>
          <p className="mt-3 text-base leading-7 text-[color:var(--muted)]">
            Most apps handle one category. VLTD handles all of them — with the same
            financial tracking, gallery tools, and AI scanning across every collectible
            type.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VAULT_UNIVERSES.map((universe) => (
            <div
              key={universe.title}
              className="rounded-2xl p-5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black" style={{ color: 'var(--fg)' }}>
                    <span className="mr-2 inline-flex" style={{ color: "var(--theme-gold, #C8CDD2)" }}><Glyph name={universe.icon} size={20} /></span>
                    {universe.title}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--muted)' }}>
                    {universe.meta}
                  </div>
                </div>
                <span style={{ color: 'var(--muted)' }}>→</span>
              </div>
              <p className="mt-4 text-sm leading-6" style={{ color: 'var(--muted)' }}>
                {universe.description}
              </p>
            </div>
          ))}
          <Link
            href="/signup"
            className="flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(203,208,213,0.34)] p-5 text-center text-[color:var(--accent)] transition hover:bg-[rgba(203,208,213,0.06)]"
            style={{ background: 'var(--surface)' }}
          >
            <span className="text-2xl">+</span>
            <span className="mt-2 text-sm font-black">Start your vault</span>
            <span className="text-xs text-[color:var(--muted2)]">Free to join</span>
          </Link>
        </div>
      </section>

      {/* ── Scanner callout — Drop Mode ──────────────────────────── */}
      <section className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl" style={{ background: 'linear-gradient(135deg, rgba(139,105,20,0.18) 0%, rgba(15,25,45,0.92) 50%, rgba(10,18,38,0.98) 100%)', border: '1px solid rgba(203,208,213,0.22)', boxShadow: '0 0 60px rgba(203,208,213,0.06)' }}>
            <div className="grid gap-0 lg:grid-cols-2">
              {/* Left — copy */}
              <div className="flex flex-col justify-center px-8 py-10 lg:py-14">
                <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-[rgba(203,208,213,0.28)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: '#C8CDD2', background: 'rgba(203,208,213,0.07)' }}>
                  ⟳ Drop Mode
                </div>
                <h2 className="text-3xl font-black tracking-[-0.04em] text-text-primary sm:text-4xl">
                  50 items in one sitting.
                </h2>
                <p className="mt-4 max-w-md text-base leading-7 text-[color:var(--muted)]">
                  Stream Mode keeps the scanner live between items — point, lock, done. Auto-Lock detects the sharpest frame so you never tap the screen. Bulk drops that used to take hours now take minutes.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/signup" className="vltd-primary-button inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-black transition">
                    Start scanning — free
                  </Link>
                  <Link href="/learn" className="inline-flex h-11 items-center justify-center rounded-full border border-[rgba(203,208,213,0.28)] px-6 text-sm font-semibold transition hover:bg-[rgba(203,208,213,0.06)]" style={{ color: '#C8CDD2' }}>
                    Learn more →
                  </Link>
                </div>
              </div>
              {/* Right — feature list */}
              <div className="flex flex-col justify-center gap-4 border-t border-[rgba(203,208,213,0.12)] px-8 py-10 lg:border-l lg:border-t-0 lg:py-14">
                {[
                  { icon: "◎", title: "Auto-Lock Scanner", desc: "Captures the sharpest frame automatically. No tapping, no blur, no retakes." },
                  { icon: "⟳", title: "Stream Mode", desc: "Scanner stays live between items. Continuous flow for large drops." },
                  { icon: "▣", title: "AI Identification", desc: "Name, category, estimated value — filled in the moment it locks." },
                  { icon: "↗", title: "Instant Portfolio Update", desc: "Every scanned item updates your P&L in real time." },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(203,208,213,0.22)] bg-[rgba(203,208,213,0.08)] text-base" style={{ color: '#C8CDD2' }}>
                      {icon}
                    </div>
                    <div>
                      <div className="text-sm font-black text-text-primary">{title}</div>
                      <p className="mt-0.5 text-sm leading-5 text-[color:var(--muted)]">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="public-galleries" className="border-y" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: 'var(--muted)' }}>
              Public Galleries
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]" style={{ color: 'var(--fg)' }}>
              Your collection, displayed like it deserves.
            </h2>
            <p className="mt-3 text-base leading-7" style={{ color: 'var(--muted)' }}>
              Build a museum-style gallery inside VLTD. Share it with one link. Your
              vault stays completely private.
            </p>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {galleryCards.slice(0, 3).map((gallery) => (
              <PublicGalleryTile key={gallery.id} gallery={gallery} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof — 3 stats ────────────────────────────────── */}
      <section className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-px overflow-hidden rounded-2xl sm:grid-cols-3" style={{ background: 'var(--border)' }}>
            {[
              { stat: "7", label: "Collecting universes", sub: "Every category, one vault" },
              { stat: "∞", label: "Items supported", sub: "No limits on vault size" },
              { stat: "1 link", label: "To share your gallery", sub: "Private vault, public showcase" },
            ].map(({ stat, label, sub }) => (
              <div key={label} className="flex flex-col items-center justify-center py-10 text-center" style={{ background: cardBg }}>
                <div className="text-5xl font-black tracking-[-0.05em]" style={{ color: '#C8CDD2' }}>{stat}</div>
                <div className="mt-2 text-sm font-black text-text-primary">{label}</div>
                <div className="mt-1 text-xs text-[color:var(--muted2)]">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison table ──────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">
          Why VLTD
        </div>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-text-primary">
          Every other app does one thing.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-[color:var(--muted)]">
          CLZ. Shiny. CollX. Misprint. Every competitor solves one category. VLTD
          solves all of them — together, in one vault.
        </p>

        <div className="mx-auto mt-8 max-w-3xl overflow-hidden rounded-2xl border border-[color:var(--border)] text-left" style={{ background: cardBg }}>
          {/* Header row */}
          <div className="grid grid-cols-[1fr_110px_110px] border-b border-[color:var(--border)] bg-[rgba(203,208,213,0.06)]">
            <div className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Feature</div>
            <div className="px-5 py-3 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Others</div>
            <div className="bg-[rgba(203,208,213,0.10)] px-5 py-3 text-center text-[11px] font-black uppercase tracking-[0.22em] text-[color:var(--accent)]">
              VLTD
            </div>
          </div>
          {COMPARISON_ROWS.map(([feature, others, vltd]) => (
            <div
              key={feature}
              className="grid grid-cols-[1fr_110px_110px] border-b border-[color:var(--border)] last:border-b-0"
            >
              <div className="px-5 py-3.5 text-sm font-medium text-[color:var(--muted)]">{feature}</div>
              <div className="px-5 py-3.5 text-center text-sm text-[color:var(--muted2)]">
                {others}
              </div>
              <div className="bg-[rgba(203,208,213,0.04)] px-5 py-3.5 text-center text-sm font-semibold text-[color:var(--vltd-green)]">
                {vltd}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-[color:var(--border)] px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">
          Get Started
        </div>
        <h2 className="mx-auto mt-2 max-w-2xl text-2xl font-black leading-tight tracking-[-0.05em] text-text-primary sm:text-4xl">
          Your collection is worth tracking properly.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[color:var(--muted)]">
          Scan your first item in under 60 seconds. Free to start — no credit card,
          no category limit, no cap on vault size.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="vltd-primary-button inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-black transition"
          >
            Vault your collection — free
          </Link>
          <Link
            href="/login"
            className="inline-flex h-14 items-center justify-center rounded-full border border-[color:var(--border)] px-8 text-base font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
          >
            Sign in →
          </Link>
        </div>
        <p className="mt-4 text-xs text-[color:var(--muted2)]">
          Free forever · No credit card · All 7 universes included
        </p>
      </section>

      <footer className="border-t border-[color:var(--border)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <BrandMark />
              <p className="mt-1 max-w-xs text-xs text-[color:var(--muted2)]">
                The collector&apos;s operating system. Every category. One vault.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Product</div>
                <div className="flex flex-col gap-1.5">
                  <Link href="/signup" className="text-[color:var(--muted)] hover:text-text-primary transition">Sign up</Link>
                  <Link href="/login" className="text-[color:var(--muted)] hover:text-text-primary transition">Log in</Link>
                  <Link href="/learn" className="text-[color:var(--muted)] hover:text-text-primary transition">Learn</Link>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Explore</div>
                <div className="flex flex-col gap-1.5">
                  <Link href="#public-galleries" className="text-[color:var(--muted)] hover:text-text-primary transition">Galleries</Link>
                  <Link href="/discover" className="text-[color:var(--muted)] hover:text-text-primary transition">Discover</Link>
                  <Link href="/museum" className="text-[color:var(--muted)] hover:text-text-primary transition">Galleries</Link>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Universes</div>
                <div className="flex flex-col gap-1.5">
                  <Link href="/signup" className="text-[color:var(--muted)] hover:text-text-primary transition">TCG</Link>
                  <Link href="/signup" className="text-[color:var(--muted)] hover:text-text-primary transition">Sports</Link>
                  <Link href="/signup" className="text-[color:var(--muted)] hover:text-text-primary transition">Pop Culture</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-[color:var(--border)] pt-4 text-xs text-[color:var(--muted2)]">
            © 2026 VLTD. Pronounced “Vaulted.” — free to start · no credit card required
          </div>
        </div>
      </footer>
    </main>
  );
}
