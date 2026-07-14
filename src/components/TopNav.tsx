"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";

import Image from "next/image";
import CommandPalette from "@/components/CommandPalette";
import { ThemePicker } from "@/components/ui/ThemePicker";
import {
  getCurrentUser,
  initAuthListener,
  listMyProfiles,
  onAuthStateChange,
  setStoredActiveProfileId,
  signOut,
} from "@/lib/auth";
import { getMyAdminRole, type AdminRole } from "@/lib/adminAuth";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
const AVATAR_PRESET_SRCS: Record<string, string> = {
  key: "/avatars/presets/key.png",
  lion: "/avatars/presets/lion.png",
  dragon: "/avatars/presets/dragon.png",
  fox: "/avatars/presets/fox.png",
  eagle: "/avatars/presets/eagle.png",
  gem: "/avatars/presets/gem.png",
  orb: "/avatars/presets/orb.png",
  sword: "/avatars/presets/sword.png",
  cards: "/avatars/presets/cards.png",
  crown: "/avatars/presets/crown.png",
  vault: "/avatars/presets/vault.png",
  fire: "/avatars/presets/fire.png",
  keysmith: "/avatars/presets/keysmith.png",
  guitar: "/avatars/presets/guitar.png",
  vinyl: "/avatars/presets/vinyl.png",
  harp: "/avatars/presets/harp.png",
};

function resolveAvatarImageSrc(avatarUrl?: string | null) {
  if (!avatarUrl) return "";
  if (avatarUrl.startsWith("__preset:")) return AVATAR_PRESET_SRCS[avatarUrl.replace("__preset:", "")] ?? "";
  return avatarUrl;
}

function emojiToPresetUrl(emoji?: string | null) {
  switch (emoji) {
    case "🦁": return "__preset:lion";
    case "🐉": return "__preset:dragon";
    case "🦊": return "__preset:fox";
    case "🦅": return "__preset:eagle";
    case "💎": return "__preset:gem";
    case "🔮": return "__preset:orb";
    case "⚔️": return "__preset:sword";
    case "🃏": return "__preset:cards";
    case "👑": return "__preset:crown";
    case "🏛️": return "__preset:vault";
    case "🔥": return "__preset:fire";
    default: return "";
  }
}

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  profile_type: "personal" | "business";
  avatar_emoji?: string | null;
  avatar_url?: string | null;
};

type Parsed = {
  q?: string;
  cat?: string;
  graded?: string;
  grade?: string;
};

/* ── Icons ──────────────────────────────────────────────── */

function IconVault({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.10)" : "none"} />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 9v-2M12 17v-2M15 12h2M7 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconExhibitions({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      <path d="M3 21h18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M5 21V11M19 21V11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M2 11h20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 4 2 11h20L12 4Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
        fill={active ? "rgba(245,181,72,0.12)" : "none"} />
      <path d="M9 21v-5h6v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconDiscover({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.10)" : "none"} />
      <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="11" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconActivity({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      <rect x="3" y="13" width="3.5" height="8" rx="1" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.20)" : "rgba(160,149,107,0.14)"} />
      <rect x="8.5" y="9" width="3.5" height="12" rx="1" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.20)" : "rgba(160,149,107,0.14)"} />
      <rect x="14" y="5" width="3.5" height="16" rx="1" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.28)" : "rgba(160,149,107,0.14)"} />
    </svg>
  );
}

function IconWatchlist({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      <path d="M12 21C12 21 3.5 14 3.5 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8.5 2.5C20.5 14 12 21 12 21Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
        fill={active ? "rgba(245,181,72,0.14)" : "none"} />
    </svg>
  );
}

function IconGoals({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.12)" : "none"} />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconLearn({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      <path d="M4 4h7a1 1 0 0 1 1 1v14a1 1 0 0 0-1-1H4V4Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
        fill={active ? "rgba(245,181,72,0.14)" : "none"} />
      <path d="M20 4h-7a1 1 0 0 0-1 1v14a1 1 0 0 1 1-1h7V4Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
        fill={active ? "rgba(245,181,72,0.10)" : "none"} />
      <path d="M12 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

function IconCommunityBoard({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      {/* Podium / leaderboard */}
      <rect x="2" y="13" width="5" height="8" rx="1" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.16)" : "none"} />
      <rect x="9.5" y="9" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.24)" : "none"} />
      <rect x="17" y="11" width="5" height="10" rx="1" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.16)" : "none"} />
      <path d="M12 6.5l1 2h2l-1.5 1.2.5 2L12 10.7 10 11.7l.5-2L9 8.5h2l1-2Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"
        fill={active ? "rgba(245,181,72,0.30)" : "none"} />
    </svg>
  );
}

function IconMarketplace({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      {/* Price tag */}
      <path d="M3 7.5V3h4.5l9.8 9.8a2 2 0 0 1 0 2.83l-3.67 3.67a2 2 0 0 1-2.83 0L3 7.5Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
        fill={active ? "rgba(245,181,72,0.12)" : "none"} />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" opacity={active ? "1" : "0.7"} />
    </svg>
  );
}

function IconInsights({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      <path d="M3 17l4.5-5.5 4 3.5 4.5-6 4.5 3.5"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

function IconEvents({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.10)" : "none"} />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="8" cy="15" r="1.2" fill="currentColor" opacity={active ? "1" : "0.6"} />
      <circle cx="12" cy="15" r="1.2" fill="currentColor" opacity={active ? "1" : "0.6"} />
      <circle cx="16" cy="15" r="1.2" fill="currentColor" opacity={active ? "0.5" : "0.3"} />
    </svg>
  );
}

function IconBellNav({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "var(--muted2, #A0956B)" }}>
      <path d="M15 17H9a3 3 0 0 0 6 0Z" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 17h16M12 3v1m0 0a7 7 0 0 1 7 7v3.5H5V11a7 7 0 0 1 7-7Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
        fill={active ? "rgba(245,181,72,0.12)" : "none"} />
    </svg>
  );
}

function IconSearch({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
      <path d="M16.4 16.4 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: "var(--muted2, #A0956B)" }}>
      <path d="M15 17H9a3 3 0 0 0 6 0Z" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 17h16M12 3v1m0 0a7 7 0 0 1 7 7v3.5H5V11a7 7 0 0 1 7-7Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconChevron({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Nav items ──────────────────────────────────────────── */

// Main nav bar items
const MAIN_NAV_ITEMS = [
  {
    label: "Vault",       href: "/vault",      icon: IconVault,       exact: false,
    desc: "Your private collection inventory.",
  },
  {
    label: "Exhibitions", href: "/museum",     icon: IconExhibitions, exact: false,
    desc: "Curate and display collections for the world.",
  },
  {
    label: "Discover",    href: "/discover",   icon: IconDiscover,    exact: false,
    desc: "Find collectors, museums and inspiration.",
  },
  {
    label: "Events",      href: "/events",     icon: IconEvents,      exact: false,
    desc: "Shows, conventions & collector gatherings.",
  },
  {
    label: "Insights",    href: "/portfolio",  icon: IconInsights,    exact: true,  subpathOnly: false,
    desc: "Track value, growth, provenance and collection health.",
  },
];

// "More" dropdown items
const MORE_NAV_ITEMS = [
  {
    label: "Command Center", href: "/more", icon: IconVault, exact: true,
    desc: "Account hub, tools, sync status and quick actions.",
  },
  {
    label: "VLT Lounge", href: "/community-board", icon: IconCommunityBoard, exact: false,
    desc: "Spotlights, MVPs & collector community.",
  },
  {
    label: "Marketplace",  href: "/market",     icon: IconMarketplace, exact: false,
    desc: "Browse for-sale items from collectors across VLTD.",
  },
  {
    label: "Watchlist",   href: "/wishlist",   icon: IconWatchlist,   exact: false,
    desc: "Save pieces, collectors and exhibitions you love.",
  },
  {
    label: "Goals",       href: "/goals",      icon: IconGoals,       exact: false,
    desc: "Track collection completion targets.",
  },
  {
    label: "Learn",       href: "/learn",      icon: IconLearn,       exact: false,
    desc: "Universe guide, grading scales, and collecting tips.",
  },
  {
    label: "Activity",    href: "/activity",   icon: IconActivity,    exact: false,
    desc: "See updates, comments, appreciations and follows.",
  },
  {
    label: "Notifications", href: "/notifications", icon: IconBellNav, exact: false,
    desc: "New exhibitions from collectors you follow.",
  },
];

// All items combined (for guide panel)
const ALL_NAV_ITEMS = [...MAIN_NAV_ITEMS, ...MORE_NAV_ITEMS];

/* ── Helpers ────────────────────────────────────────────── */

function normalize(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function parseQuerySmart(raw: string): Parsed {
  const s = normalize(raw).toLowerCase();
  const out: Parsed = {};
  let leftover = s;

  const catMap: Record<string, string> = {
    comics: "COMICS", comic: "COMICS", sports: "SPORTS", sport: "SPORTS",
    pokemon: "POKEMON", "pokémon": "POKEMON", mtg: "MTG", magic: "MTG", custom: "CUSTOM",
  };
  for (const key of Object.keys(catMap)) {
    const re = new RegExp(`\\b${key}\\b`, "i");
    if (re.test(leftover)) { out.cat = catMap[key]; leftover = leftover.replace(re, " "); }
  }

  const graders = ["cgc", "psa", "bgs", "sgc"];
  for (const g of graders) {
    const re = new RegExp(`\\b${g}\\b`, "i");
    if (re.test(leftover)) { out.graded = g.toUpperCase(); leftover = leftover.replace(re, " "); }
  }

  const gradeInline = leftover.match(/\b(\d{1,2}(?:\.\d)?)\b/);
  if (gradeInline?.[1]) {
    const maybe = gradeInline[1];
    if (Number(maybe) >= 1 && Number(maybe) <= 10) { out.grade = maybe; leftover = leftover.replace(gradeInline[0], " "); }
  }

  const cleaned = normalize(leftover).trim();
  if (cleaned) out.q = cleaned;
  return out;
}

/* ── Main component ─────────────────────────────────────── */

function TopNavInner() {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const [input, setInput] = useState("");
  const [userOpen, setUserOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const [signedIn, setSignedIn] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");
  const [adminRole, setAdminRole] = useState<AdminRole>(null);

  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);
  const moreDropdownRef = useRef<HTMLDivElement | null>(null);
  const loadingAuthRef = useRef(false);
  const initializedRef = useRef(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const [moreDropdownPos, setMoreDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId]
  );

  useEffect(() => { setInput(sp.get("q") ?? ""); }, [sp]);

  // ⌘K / Ctrl+K opens the command palette (profile switching lives in the
  // account menu now; this is for search + quick actions).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let active = true;
    initAuthListener();

    async function loadAuthState(reason: "initial" | "auth-change" = "initial") {
      if (loadingAuthRef.current) return;
      loadingAuthRef.current = true;
      try {
        const { data: { user } } = await getCurrentUser();
        if (!active) return;
        if (!user) {
          setSignedIn(false); setAccountEmail(""); setProfiles([]); setActiveProfileId(""); setAdminRole(null);
          initializedRef.current = true; return;
        }
        setSignedIn(true); setAccountEmail(user.email ?? "");
        void getMyAdminRole().then(setAdminRole);
        const { data } = await listMyProfiles();
        if (!active) return;
        const nextProfiles = (data ?? []) as ProfileRow[];
        setProfiles(nextProfiles);
        const stored = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_PROFILE_KEY) : "";
        const nextActive =
          nextProfiles.find((p) => p.id === stored)?.id ??
          nextProfiles.find((p) => p.username === "clerk")?.id ??
          nextProfiles[0]?.id ?? "";
        setActiveProfileId(nextActive);
        if (typeof window !== "undefined" && nextActive && nextActive !== stored) {
          localStorage.setItem(ACTIVE_PROFILE_KEY, nextActive);
          window.dispatchEvent(new Event("vltd:active-profile"));
        }
        if (reason === "initial") initializedRef.current = true;
      } finally {
        loadingAuthRef.current = false;
      }
    }

    void loadAuthState("initial");
    const { data: subscription } = onAuthStateChange(() => {
      if (!initializedRef.current) return;
      void loadAuthState("auth-change");
    });
    const reloadActiveProfile = () => void loadAuthState("auth-change");
    window.addEventListener("vltd:active-profile", reloadActiveProfile);
    return () => {
      active = false;
      window.removeEventListener("vltd:active-profile", reloadActiveProfile);
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inTrigger = userMenuRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inTrigger && !inDropdown) setUserOpen(false);
      if (guideRef.current && !guideRef.current.contains(target)) setGuideOpen(false);
      const inMore = moreRef.current?.contains(target);
      const inMoreDropdown = moreDropdownRef.current?.contains(target);
      if (!inMore && !inMoreDropdown) setMoreOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function applySearch(raw: string) {
    const parsed = parseQuerySmart(raw);
    const params = new URLSearchParams();
    if (parsed.q) params.set("q", parsed.q);
    if (parsed.cat) params.set("cat", parsed.cat);
    if (parsed.graded) params.set("graded", parsed.graded);
    if (parsed.grade) params.set("grade", parsed.grade);
    router.push("/vault" + (params.toString() ? `?${params.toString()}` : ""));
  }

  async function handleSignOut() {
    await signOut();
    setUserOpen(false); setSignedIn(false); setAccountEmail(""); setProfiles([]); setActiveProfileId("");
    router.push("/login"); router.refresh();
  }

  function isActive(item: { href: string; exact?: boolean; subpathOnly?: boolean }) {
    if (item.subpathOnly) return pathname.startsWith(item.href + '/');
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  // Check if any "more" item is active (to highlight the More button)
  const isMoreActive = MORE_NAV_ITEMS.some((item) => isActive(item));

  const avatarText = signedIn
    ? (activeProfile?.display_name || accountEmail || "U").slice(0, 1).toUpperCase()
    : "G";
  const avatarImageSrc = resolveAvatarImageSrc(activeProfile?.avatar_url || emojiToPresetUrl(activeProfile?.avatar_emoji));
  const accountTypeLabel = activeProfile?.profile_type === "business" ? "Business" : "Collector";

  return (
    <>
      <div
        className={`fixed top-0 left-0 right-0 w-full backdrop-blur-xl ${userOpen || commandOpen || guideOpen || moreOpen ? "z-[9999]" : "z-[200]"}`}
        style={{ background: "var(--theme-nav-bg, rgba(11,19,32,0.96))", borderBottom: "1px solid var(--theme-nav-border, rgba(245,181,72,0.15))" }}
      >
        {/* ── Main nav row ── */}
        <div className="mx-auto flex h-[64px] max-w-[1400px] items-center gap-4 px-4 sm:px-6">

          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center">
            <Image src="/brand/vltd-logo.png" alt="VLTD" width={120} height={42} className="h-[42px] w-auto" priority />
          </Link>

          {/* Desktop icon nav — centered */}
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="flex items-end gap-1">
              {MAIN_NAV_ITEMS.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    className="relative flex flex-col items-center gap-[3px] px-3 pt-2 pb-[10px] transition-opacity hover:opacity-100"
                    style={{ opacity: active ? 1 : 0.65 }}
                  >
                    <Icon active={active} />
                    <span
                      className="text-[11px] font-semibold tracking-[0.04em] leading-none whitespace-nowrap"
                      style={{ color: active ? "#F5B548" : "var(--muted, #C4B07A)" }}
                    >
                      {item.label}
                    </span>
                    {active && (
                      <span
                        className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                        style={{ background: "linear-gradient(90deg, transparent, #F5B548, transparent)" }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* More ··· dropdown trigger */}
              <div ref={moreRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!moreOpen && moreRef.current) {
                      const r = moreRef.current.getBoundingClientRect();
                      setMoreDropdownPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
                    }
                    setMoreOpen((v) => !v);
                  }}
                  className="relative flex flex-col items-center gap-[3px] px-3 pt-2 pb-[10px] transition-opacity hover:opacity-100"
                  style={{ opacity: isMoreActive || moreOpen ? 1 : 0.65 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    style={{ color: isMoreActive || moreOpen ? "#F5B548" : "var(--muted2, #A0956B)" }}>
                    <circle cx="5" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                    <circle cx="19" cy="12" r="1.5" fill="currentColor" />
                  </svg>
                  <span
                    className="text-[11px] font-semibold tracking-[0.04em] leading-none whitespace-nowrap"
                    style={{ color: isMoreActive || moreOpen ? "#F5B548" : "var(--muted, #C4B07A)" }}
                  >
                    More
                  </span>
                  {isMoreActive && (
                    <span
                      className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                      style={{ background: "linear-gradient(90deg, transparent, #F5B548, transparent)" }}
                    />
                  )}
                </button>

                {/* More dropdown panel — rendered via fixed portal to escape nav stacking context */}
              </div>
            </div>
          </div>

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2 shrink-0">

            {/* Guide button */}
            <div ref={guideRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setGuideOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition"
                style={{
                  background: guideOpen ? "rgba(245,181,72,0.12)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${guideOpen ? "rgba(245,181,72,0.35)" : "rgba(255,255,255,0.10)"}`,
                  color: guideOpen ? "#F5B548" : "var(--muted2, #A0956B)",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-label="Guide">
                  <path d="M4 4h7a1 1 0 0 1 1 1v14a1 1 0 0 0-1-1H4V4Z"
                    stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
                    fill={guideOpen ? "rgba(245,181,72,0.16)" : "rgba(245,181,72,0.06)"} />
                  <path d="M20 4h-7a1 1 0 0 0-1 1v14a1 1 0 0 1 1-1h7V4Z"
                    stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
                    fill={guideOpen ? "rgba(245,181,72,0.16)" : "rgba(245,181,72,0.06)"} />
                  <path d="M12 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
                  <text x="15.5" y="15" textAnchor="middle" fontSize="7" fontWeight="bold" fill="currentColor">?</text>
                </svg>
                <span style={{ transform: guideOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-flex" }}>
                  <IconChevron />
                </span>
              </button>
            </div>

            {/* Search bar */}
            <form
              onSubmit={(e) => { e.preventDefault(); applySearch(input); }}
              className="hidden md:block"
            >
              <div
                className="flex items-center gap-2 rounded-full px-3"
                style={{
                  height: "36px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  width: searchExpanded ? "300px" : "220px",
                  transition: "width 0.2s",
                }}
              >
                <button type="submit" className="shrink-0" style={{ color: "var(--muted, #8A7A5A)" }} aria-label="Search">
                  <IconSearch className="h-3.5 w-3.5" />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setSearchExpanded(true)}
                  onBlur={() => { if (!input.trim()) setSearchExpanded(false); }}
                  placeholder="Search vault, exhibitions, collectors..."
                  className="min-w-0 flex-1 bg-transparent text-[13px] focus:outline-none"
                  style={{ color: "var(--theme-text-primary, #F0EAD6)" }}
                />
                <span className="shrink-0 hidden lg:inline text-[11px] rounded px-1.5 py-0.5"
                  style={{ background: "rgba(255,255,255,0.07)", color: "var(--muted, #8A7A5A)", fontFamily: "monospace" }}>
                  ⌘K
                </span>
              </div>
            </form>

            {/* Bell */}
            <div className="group relative hidden md:flex">
              <Link
                href="/notifications"
                className="h-[36px] w-[36px] flex items-center justify-center rounded-full transition"
                style={{ background: pathname === "/notifications" ? "rgba(245,181,72,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${pathname === "/notifications" ? "rgba(245,181,72,0.35)" : "rgba(255,255,255,0.08)"}` }}
                aria-label="Notifications"
              >
                <IconBell />
              </Link>
            </div>

            {/* User menu trigger */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!userOpen && userMenuRef.current) {
                    const rect = userMenuRef.current.getBoundingClientRect();
                    setDropdownPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
                  }
                  setUserOpen((v) => !v);
                }}
                className="flex items-center gap-1 rounded-full p-1 transition"
                style={{ background: "transparent", border: "none" }}
              >
                <div
                  className="flex h-[32px] w-[32px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[13px] font-bold"
                  style={{ background: 'var(--theme-gold-gradient, linear-gradient(135deg,#8B6914,#F5B548))', color: "#0B0B0B" }}
                >
                  {avatarImageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarImageSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    avatarText
                  )}
                </div>
                <IconChevron size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Guide dropdown panel ── */}
        {guideOpen && (
          <div
            className="border-t"
            style={{ borderColor: "var(--theme-border, rgba(245,181,72,0.10))", background: "var(--theme-nav-bg, rgba(11,11,11,0.98))" }}
          >
            <div className="mx-auto max-w-[1400px] px-6 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: "var(--muted, #8A7A5A)" }}>
                Explore VLTD
              </p>
              <div className="grid grid-cols-4 gap-2 lg:grid-cols-10">
                {ALL_NAV_ITEMS.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href + item.label + "guide"}
                      href={item.href}
                      onClick={() => setGuideOpen(false)}
                      className="group flex min-h-[74px] flex-col gap-1 rounded-xl p-2 transition"
                      style={{
                        background: active ? "rgba(245,181,72,0.07)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${active ? "rgba(245,181,72,0.20)" : "rgba(255,255,255,0.06)"}`,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "rgba(245,181,72,0.07)";
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,181,72,0.20)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = active ? "rgba(245,181,72,0.07)" : "rgba(255,255,255,0.02)";
                        (e.currentTarget as HTMLElement).style.borderColor = active ? "rgba(245,181,72,0.20)" : "rgba(255,255,255,0.06)";
                      }}
                    >
                      <div className="[&_svg]:h-3.5 [&_svg]:w-3.5">
                        <Icon active={active} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold leading-none" style={{ color: active ? "#F5B548" : "var(--theme-text-primary, #F0EAD6)" }}>
                          {item.label}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight" style={{ color: "var(--muted, #8A7A5A)" }}>
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  );
                })}

                {/* Brand card */}
                <div
                  className="col-span-1 flex min-h-[74px] flex-col justify-between rounded-xl p-2"
                  style={{
                    background: "linear-gradient(135deg, rgba(42,36,24,0.90), rgba(26,20,8,0.90))",
                    border: "1px solid rgba(245,181,72,0.25)",
                    boxShadow: "0 0 24px rgba(245,181,72,0.08)",
                  }}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center self-end rounded-lg text-sm"
                    style={{ background: "rgba(245,181,72,0.12)", border: "1px solid rgba(245,181,72,0.25)" }}
                  >
                    🏛
                  </div>
                  <div>
                    <p className="text-[10px] font-black leading-tight" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
                      Your Collection.<br />Your Exhibitions.<br />Your Legacy.
                    </p>
                    <Link
                      href="/guide"
                      onClick={() => setGuideOpen(false)}
                      className="mt-1 inline-block text-[10px] font-semibold leading-tight"
                      style={{ color: "#F5B548" }}
                    >
                      Learn more about VLTD →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* More dropdown — fixed positioning outside nav stacking context */}
      {moreOpen && moreDropdownPos && (
        <div
          ref={moreDropdownRef}
          style={{
            position: "fixed",
            top: moreDropdownPos.top,
            left: moreDropdownPos.left,
            transform: "translateX(-50%)",
            minWidth: 200,
            zIndex: 9999,
            background: "var(--theme-nav-bg, rgba(11,19,32,0.99))",
            border: "1px solid var(--theme-nav-border, rgba(245,181,72,0.18))",
            backdropFilter: "blur(20px)",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 18px 50px rgba(0,0,0,0.6)",
          }}
        >
          <div className="py-1.5 px-1.5">
            {MORE_NAV_ITEMS.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[rgba(245,181,72,0.07)]"
                  style={{ background: active ? "rgba(245,181,72,0.07)" : "transparent" }}
                >
                  <div className="[&_svg]:h-4 [&_svg]:w-4 shrink-0">
                    <Icon active={active} />
                  </div>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: active ? "#F5B548" : "var(--theme-text-primary, #F0EAD6)" }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* User dropdown — fixed positioning outside nav stacking context */}
      {userOpen && dropdownPos && (
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: dropdownPos.top,
            right: dropdownPos.right,
            width: 300,
            zIndex: 9999,
            background: "var(--theme-nav-bg, rgba(11,19,32,0.99))",
            border: "1px solid var(--theme-nav-border, rgba(245,181,72,0.18))",
            backdropFilter: "blur(20px)",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 18px 50px rgba(0,0,0,0.6)",
          }}
        >
          <div className="px-4 py-3.5" style={{ borderBottom: "1px solid rgba(245,181,72,0.10)" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
                  {activeProfile?.display_name || accountEmail || "Guest"}
                </div>
                <div className="mt-0.5 truncate text-xs" style={{ color: "var(--muted2, #A0956B)" }}>
                  {accountEmail || "Not signed in"}
                </div>
              </div>
              <div className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em]"
                style={{ background: "rgba(245,181,72,0.12)", color: "#F5B548", border: "1px solid rgba(245,181,72,0.22)" }}>
                {accountTypeLabel}
              </div>
            </div>
          </div>
          <div className="px-2 py-2">
            {signedIn ? (
              <>
                {[
                  { href: "/dashboard", label: "Dashboard" },
                  { href: "/collector", label: "Collector Profile" },
                  { href: "/account", label: "Account Settings" },
                  { href: "/account/team", label: "Team" },
                  { href: "/account/invite", label: "Invite Friends" },
                  { href: "/redeem", label: "Redeem a Code" },
                  { href: "/account/backup", label: "Cloud Backup" },
                ].map(({ href, label }) => (
                  <Link key={href} href={href} onClick={() => setUserOpen(false)}
                    className="block rounded-xl px-3 py-2.5 text-sm transition hover:bg-[rgba(245,181,72,0.06)]"
                    style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
                    {label}
                  </Link>
                ))}
                {profiles.length > 1 && (
                  <div className="mt-1 pt-2" style={{ borderTop: "1px solid rgba(245,181,72,0.10)" }}>
                    <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted2, #A0956B)" }}>
                      Switch Profile
                    </div>
                    {profiles.map((p) => {
                      const active = p.id === activeProfileId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={active}
                          onClick={() => {
                            setUserOpen(false);
                            setStoredActiveProfileId(p.id);
                            window.location.reload();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition hover:bg-[rgba(245,181,72,0.06)] disabled:cursor-default disabled:hover:bg-transparent"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm" style={{ background: "rgba(245,181,72,0.10)" }}>
                            {p.avatar_emoji || (p.profile_type === "business" ? "🏛️" : "👤")}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
                              {p.display_name}
                            </div>
                            <div className="truncate text-[11px]" style={{ color: "var(--muted2, #A0956B)" }}>
                              @{p.username} · {p.profile_type === "business" ? "Business" : "Personal"}
                            </div>
                          </div>
                          {active ? (
                            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide" style={{ color: "#4ade80" }}>Active</span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-semibold" style={{ color: "#F5B548" }}>Switch</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
                {adminRole && (
                  <Link href="/admin/characters" onClick={() => setUserOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-[rgba(245,181,72,0.08)]"
                    style={{ color: "#F5B548" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.9 }}>
                      <path d="M12 2a5 5 0 1 1 0 10A5 5 0 0 1 12 2Z" stroke="currentColor" strokeWidth="1.75" />
                      <path d="M3 21c0-4.418 4.03-8 9-8s9 3.582 9 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                      <circle cx="19" cy="7" r="3" fill="#F5B548" stroke="#0b1320" strokeWidth="1.5" />
                      <path d="M18 7h2M19 6v2" stroke="#0b1320" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    Admin
                    <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{ background: "rgba(245,181,72,0.15)", color: "#F5B548", border: "1px solid rgba(245,181,72,0.25)" }}>
                      {adminRole}
                    </span>
                  </Link>
                )}
                {adminRole && (
                  <Link href="/admin/waitlist" onClick={() => setUserOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-[rgba(245,181,72,0.08)]"
                    style={{ color: "#F5B548" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.9 }}>
                      <path d="M4 4h16v16H4zM4 9h16M9 4v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Beta Waitlist
                  </Link>
                )}
                {adminRole && (
                  <Link href="/admin/bugs" onClick={() => setUserOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-[rgba(245,181,72,0.08)]"
                    style={{ color: "#F5B548" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.9 }}>
                      <path d="M12 20a6 6 0 0 0 6-6v-2a6 6 0 0 0-12 0v2a6 6 0 0 0 6 6zM12 8V6M5 11H3M5 15l-2 1M19 11h2M19 15l2 1" />
                    </svg>
                    Bug Reports
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setUserOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm transition hover:bg-[rgba(245,181,72,0.06)]"
                  style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>Log In</Link>
                <Link href="/signup" onClick={() => setUserOpen(false)}
                  className="block rounded-xl px-3 py-2.5 text-sm transition hover:bg-[rgba(245,181,72,0.06)]"
                  style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>Create Account</Link>
              </>
            )}
          </div>
          <div style={{ borderTop: "1px solid rgba(245,181,72,0.10)" }}>
            <ThemePicker />
          </div>
          {signedIn && (
            <div className="px-2 py-2" style={{ borderTop: "1px solid rgba(245,181,72,0.10)" }}>
              <button type="button" onClick={handleSignOut}
                className="block w-full rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[rgba(224,82,82,0.08)]"
                style={{ color: "#E05252" }}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        profileLabel={activeProfile?.display_name || ""}
        profiles={profiles}
        activeProfileId={activeProfileId}
      />
    </>
  );
}

export default function TopNav() {
  return (
    <Suspense fallback={null}>
      <TopNavInner />
    </Suspense>
  );
}
