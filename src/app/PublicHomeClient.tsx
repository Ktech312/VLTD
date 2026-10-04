"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Glyph, type GlyphName } from "@/components/ui/Glyph";
import { useRouter } from "next/navigation";
import { getCurrentUser, initAuthListener } from "@/lib/auth";
import { HOME_FAQ } from "@/lib/homeFaq";

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

type LaunchAccessStatus = {
  capacity: number;
  claimed: number;
  remaining: number;
  isOpen: boolean;
};

const FEATURE_CARDS: { icon: React.ReactNode; title: string; description: string }[] = [
  { title: "Organize", description: "Keep photos, descriptions, and condition notes with each collectible.", icon: <Glyph name="vault" size={20} /> },
  { title: "Track", description: "Record purchase prices and estimated values as your collection grows.", icon: <Glyph name="insights" size={20} /> },
  { title: "Showcase", description: "Bring selected pieces together in a public exhibition you can share.", icon: <Glyph name="exhibitions" size={20} /> },
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
  { n: 1, title: "Catalog your collection", desc: "Add photos and item details. Review AI-assisted suggestions before saving." },
  { n: 2, title: "Keep your records together", desc: "Record condition, purchase prices, and the estimated values you use." },
  { n: 3, title: "Create an exhibition", desc: "Choose pieces to display and share your public exhibition with a link." },
];

// Deliberate editorial selection, not the most recently changed user records.
// Recheck the guest experience before adding another token here.
const FEATURED_GALLERY_TOKENS = ["pub_mr6nb8k6_vp2iwm7i"];

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
    category: "Collector showcase",
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
          {gallery.category}
        </div>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Open the exhibition and explore the individual pieces.</p>
      </div>
    </Link>
  );
}


export default function PublicHomeClient() {
  const router = useRouter();
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [launchAccess, setLaunchAccess] = useState<LaunchAccessStatus | null>(null);

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
      }
    }).catch(() => { /* Public content remains available if auth is unavailable. */ });
  }, [router]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/launch-access", { cache: "no-store" });
        if (!response.ok) return;
        const status = (await response.json()) as LaunchAccessStatus;
        if (alive) setLaunchAccess(status);
      } catch {
        // The rest of the public homepage remains useful if the counter is
        // temporarily unavailable. We never invent a number as a fallback.
      }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

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
    return FEATURED_GALLERY_TOKENS.flatMap((token) => {
      const gallery = galleries.find((candidate) => candidate.share?.publicToken === token);
      if (!gallery || gallery.state !== "ACTIVE" || gallery.visibility !== "PUBLIC") return [];
      if (!(gallery.itemIds.length || gallery.publicItemSnapshots?.length)) return [];
      if (!gallery.coverImage && !resolveSnapshotImage(gallery)) return [];
      return [toPublicCard(gallery)];
    });
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
                  href={launchAccess?.isOpen === false ? "#early-access" : "/signup"}
                  className="vltd-primary-button rounded-full px-4 py-2 text-sm font-black whitespace-nowrap transition"
                >
                  {launchAccess?.isOpen === false ? "Join the waitlist" : "Claim a free spot"}
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
                Your collection, <span className="text-[color:var(--accent)]">VauLTeD.</span>
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-[color:var(--muted)] lg:mx-0">
                VLTD (pronounced &ldquo;Vaulted&rdquo;) is the collection tracker for cards,
                comics, records, games, and other collectibles. Catalog every piece, keep
                purchase prices and estimated values, and share public exhibitions of the
                pieces you want to showcase.
              </p>

              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href={launchAccess?.isOpen === false ? "#early-access" : "/signup"}
                  className="vltd-primary-button inline-flex h-12 items-center justify-center rounded-full px-7 text-sm font-black transition"
                >
                  {launchAccess?.isOpen === false ? "Join the waitlist →" : "Claim a free spot →"}
                </Link>
                <Link
                  href="#public-galleries"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-[color:var(--border)] px-7 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
                  style={{ background: 'var(--surface)' }}
                >
                  View public exhibitions
                </Link>
              </div>

              {launchAccess ? (
                <div className="mx-auto mt-5 max-w-lg rounded-2xl border p-4 text-left lg:mx-0" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-black text-text-primary">First 50 collector accounts are free</div>
                      <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                        {launchAccess.claimed} of {launchAccess.capacity} claimed · {launchAccess.remaining} remaining
                      </div>
                    </div>
                    <span className="shrink-0 text-2xl font-black text-[color:var(--accent)]">{launchAccess.claimed}/{launchAccess.capacity}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--pill)]" role="progressbar" aria-label="Founding collector spots claimed" aria-valuemin={0} aria-valuemax={launchAccess.capacity} aria-valuenow={launchAccess.claimed}>
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, (launchAccess.claimed / launchAccess.capacity) * 100)}%`, background: "var(--accent)", boxShadow: "0 0 12px color-mix(in srgb, var(--accent) 65%, transparent)" }} />
                  </div>
                </div>
              ) : null}

              {/* Trust row */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start">
                {["Free founding account", "Private by default", "Explore exhibitions now"].map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--muted2)]"
                  >
                    <Glyph name="checkmark" size={14} strokeWidth={2.5} style={{ color: "var(--accent)" }} />
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
      <section id="public-galleries" className="border-y" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: 'var(--muted)' }}>
              Public Exhibitions
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]" style={{ color: 'var(--fg)' }}>
              Your collection, displayed like it deserves.
            </h2>
            <p className="mt-3 text-base leading-7" style={{ color: 'var(--muted)' }}>
              Explore a public collection, open individual pieces, and see how an
              exhibition brings them together. No account needed to browse.
            </p>
          </div>

          <div className="mt-8 grid max-w-xl gap-5">
            {galleryCards.map((gallery) => (
              <PublicGalleryTile key={gallery.id} gallery={gallery} />
            ))}
            {galleryCards.length === 0 && <p className="text-sm text-[color:var(--muted)]">Featured exhibitions are being refreshed. Learn how to <Link className="underline" href="/learn/building-exhibitions">build an exhibition</Link>.</p>}
          </div>
        </div>
      </section>

      <section id="early-access" className="scroll-mt-24 border-b" style={{ borderColor: 'var(--border)', background: 'linear-gradient(135deg, rgba(203,208,213,0.06) 0%, var(--bg) 60%)' }}>
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(203,208,213,0.32)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] mb-4" style={{ color: '#C8CDD2', background: 'rgba(203,208,213,0.07)' }}>
            Founding Access
          </div>
          <h2 className="text-2xl font-black tracking-[-0.04em] text-text-primary sm:text-3xl">
            {launchAccess?.isOpen === false ? "All 50 founding spots are claimed." : "Join the first 50 collectors."}
          </h2>
          <p className="mt-2 text-base leading-7" style={{ color: 'var(--muted)' }}>
            {launchAccess?.isOpen === false
              ? "Join the waitlist and we’ll contact you when the next group opens."
              : "Create your free account now. Existing real accounts are included in the public total, and registration closes automatically at 50."}
          </p>
          {launchAccess?.isOpen !== false ? (
            <div className="mt-6 flex flex-col items-center gap-3">
              {launchAccess ? (
                <div className="text-sm font-bold text-[color:var(--accent)]">{launchAccess.remaining} of {launchAccess.capacity} free spots remain</div>
              ) : null}
              <Link href="/signup" className="vltd-primary-button inline-flex h-12 items-center justify-center rounded-full px-7 text-sm font-black transition">
                Create your free account →
              </Link>
            </div>
          ) : waitlistStatus === "success" || waitlistStatus === "already" ? (
            <div className="mt-6 rounded-2xl border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.06)] px-6 py-5 text-center">
              <div className="mb-2 flex justify-center">
                <Glyph name="check" size={26} strokeWidth={2} style={{ color: "#4ade80" }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>{waitlistMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleWaitlistSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <input
                aria-label="Email address for early access"
                autoComplete="email"
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
          {launchAccess?.isOpen === false ? <p className="mt-3 text-xs" style={{ color: 'var(--muted2)' }}>We’ll email you when another group opens.</p> : null}
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
        <div className="mx-auto grid max-w-7xl divide-y divide-[color:var(--border)] px-4 sm:px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-8">
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
            Your collection, from record to showcase.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
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
            Collect cards, comics, records, games, and more? Keep your collecting
            interests together, with details and photos for each piece.
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
            href={launchAccess?.isOpen === false ? "#early-access" : "/signup"}
            className="flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(203,208,213,0.34)] p-5 text-center text-[color:var(--accent)] transition hover:bg-[rgba(203,208,213,0.06)]"
            style={{ background: 'var(--surface)' }}
          >
            <span className="text-2xl">+</span>
            <span className="mt-2 text-sm font-black">{launchAccess?.isOpen === false ? "Join the waitlist" : "Claim a free spot"}</span>
            <span className="text-xs text-[color:var(--muted2)]">Founding access</span>
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
                  Start with a photo. Make the record your own.
                </h2>
                <p className="mt-4 max-w-md text-base leading-7 text-[color:var(--muted)]">
                  Use photos and AI-assisted identification to start an item record. Review the suggested details, add what you know, and check estimated values against recent comparable sales.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={launchAccess?.isOpen === false ? "#early-access" : "/signup"} className="vltd-primary-button inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-black transition">
                    {launchAccess?.isOpen === false ? "Join the waitlist" : "Claim a free spot"}
                  </Link>
                  <Link href="/learn" className="inline-flex h-11 items-center justify-center rounded-full border border-[rgba(203,208,213,0.28)] px-6 text-sm font-semibold transition hover:bg-[rgba(203,208,213,0.06)]" style={{ color: '#C8CDD2' }}>
                    Learn more →
                  </Link>
                </div>
              </div>
              {/* Right — feature list */}
              <div className="flex flex-col justify-center gap-4 border-t border-[rgba(203,208,213,0.12)] px-8 py-10 lg:border-l lg:border-t-0 lg:py-14">
                {[
                  { icon: "◎", title: "Auto-Lock Scanner", desc: "Helps capture an image when the camera is steady. Review photo quality before saving." },
                  { icon: "⟳", title: "Stream Mode", desc: "Scanner stays live between items. Continuous flow for large drops." },
                  { icon: "▣", title: "AI Identification", desc: "Suggested item details for you to review and correct. Condition estimates are not professional grades." },
                  { icon: "↗", title: "Collection Records", desc: "Keep purchase prices and estimated values with your saved items." },
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

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h2 className="text-3xl font-black text-text-primary">Before you join</h2>
        <div className="mt-6 space-y-6 text-[color:var(--muted)]">
          {HOME_FAQ.map(({ q, a }) => (
            <div key={q}><h3 className="font-bold text-text-primary">{q}</h3><p className="mt-2">{a}</p></div>
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
          {launchAccess?.isOpen === false
            ? "The first 50 spots are claimed. Join the waitlist for the next opening."
            : "Create one of the first 50 free collector accounts and start building your collection."}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={launchAccess?.isOpen === false ? "#early-access" : "/signup"}
            className="vltd-primary-button inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-black transition"
          >
            {launchAccess?.isOpen === false ? "Join the waitlist" : "Create free account"}
          </Link>
          <Link
            href="/login"
            className="inline-flex h-14 items-center justify-center rounded-full border border-[color:var(--border)] px-8 text-base font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
          >
            Sign in →
          </Link>
        </div>
        <p className="mt-4 text-xs text-[color:var(--muted2)]">
          Founding access · Registration closes at 50 accounts
        </p>
      </section>

      <footer className="border-t border-[color:var(--border)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1">
              <BrandMark />
              <p className="mt-1 max-w-xs text-xs text-[color:var(--muted2)]">
                Your collection. Your records. Your showcase.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Product</div>
                <div className="flex flex-col gap-1.5">
                  <Link href={launchAccess?.isOpen === false ? "#early-access" : "/signup"} className="text-[color:var(--muted)] hover:text-text-primary transition">{launchAccess?.isOpen === false ? "Join the waitlist" : "Create free account"}</Link>
                  <Link href="/login" className="text-[color:var(--muted)] hover:text-text-primary transition">Log in</Link>
                  <Link href="/learn" className="text-[color:var(--muted)] hover:text-text-primary transition">Learn</Link>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Explore</div>
                <div className="flex flex-col gap-1.5">
                  <Link href="#public-galleries" className="text-[color:var(--muted)] hover:text-text-primary transition">Exhibitions</Link>
                  <Link href="/discover" className="text-[color:var(--muted)] hover:text-text-primary transition">Discover</Link>
                  <Link href="/museum" className="text-[color:var(--muted)] hover:text-text-primary transition">Exhibitions</Link>
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted2)]">Universes</div>
                <div className="flex flex-col gap-1.5">
                  <Link href="#early-access" className="text-[color:var(--muted)] hover:text-text-primary transition">TCG</Link>
                  <Link href="#early-access" className="text-[color:var(--muted)] hover:text-text-primary transition">Sports</Link>
                  <Link href="#early-access" className="text-[color:var(--muted)] hover:text-text-primary transition">Pop Culture</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-[color:var(--border)] pt-4 text-xs text-[color:var(--muted2)]">
            © 2026 VLTD. Pronounced “Vaulted.” — founding access
          </div>
        </div>
      </footer>
    </main>
  );
}
