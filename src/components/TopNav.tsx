"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Image from "next/image";
import CommandPalette from "@/components/CommandPalette";
import { ThemePicker } from "@/components/ui/ThemePicker";
import {
  getCurrentUser,
  initAuthListener,
  listMyProfiles,
  onAuthStateChange,
  signOut,
} from "@/lib/auth";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  profile_type: "personal" | "business";
};

type Parsed = {
  q?: string;
  cat?: string;
  graded?: string;
  grade?: string;
};

/* ── Icons ──────────────────────────────────────────────── */

function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "#A0956B" }}>
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
        fill={active ? "rgba(245,181,72,0.14)" : "none"} />
      <path d="M9 21V13h6v8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconVault({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "#A0956B" }}>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.10)" : "none"} />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 9v-2M12 17v-2M15 12h2M7 12h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconExhibitions({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "#A0956B" }}>
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "#A0956B" }}>
      <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.10)" : "none"} />
      <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="11" cy="11" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconActivity({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "#A0956B" }}>
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "#A0956B" }}>
      <path d="M12 21C12 21 3.5 14 3.5 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8.5 2.5C20.5 14 12 21 12 21Z"
        stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"
        fill={active ? "rgba(245,181,72,0.14)" : "none"} />
    </svg>
  );
}

function IconGoals({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "#A0956B" }}>
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.75"
        fill={active ? "rgba(245,181,72,0.12)" : "none"}
      />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconLearn({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "#A0956B" }}>
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

function IconInsights({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "#F5B548" : "#A0956B" }}>
      <path d="M3 17l4.5-5.5 4 3.5 4.5-6 4.5 3.5"
        stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: "#A0956B" }}>
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

const NAV_ITEMS = [
  {
    label: "Home",        href: "/",          icon: IconHome,        exact: true,
    desc: "Your personal museum command center.",
  },
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
    label: "Insights",    href: "/portfolio",  icon: IconInsights,    exact: true,  subpathOnly: false,
    desc: "Track value, growth, provenance and collection health.",
  },
  {
    label: "Watchlist",   href: "/wishlist",   icon: IconWatchlist,   exact: false, subpathOnly: false,
    desc: "Save pieces, collectors and exhibitions you love.",
  },
  {
    label: "Goals",       href: "/goals",      icon: IconGoals,       exact: false, subpathOnly: false,
    desc: "Track collection completion targets.",
  },
  {
    label: "Learn",       href: "/learn",      icon: IconLearn,       exact: false, subpathOnly: false,
    desc: "Universe guide, grading scales, and collecting tips.",
  },
  {
    label: "Activity",    href: "/activity",   icon: IconActivity,    exact: false, subpathOnly: false,
    desc: "See updates, comments, appreciations and follows.",
  },
];

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
  const [searchExpanded, setSearchExpanded] = useState(false);

  const [signedIn, setSignedIn] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");

  const [mounted, setMounted] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const userDropdownRef = useRef<HTMLDivElement | null>(null);
  const guideRef = useRef<HTMLDivElement | null>(null);
  const loadingAuthRef = useRef(false);
  const initializedRef = useRef(false);

  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) ?? null,
    [profiles, activeProfileId]
  );

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => { setInput(sp.get("q") ?? ""); }, [sp]);

  // Calculate dropdown portal position when opening
  useEffect(() => {
    if (userOpen && userMenuRef.current) {
      const rect = userMenuRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [userOpen]);

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
          setSignedIn(false); setAccountEmail(""); setProfiles([]); setActiveProfileId("");
          initializedRef.current = true; return;
        }
        setSignedIn(true); setAccountEmail(user.email ?? "");
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
    return () => { active = false; subscription.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inMenu = userMenuRef.current?.contains(target);
      const inDropdown = userDropdownRef.current?.contains(target);
      if (!inMenu && !inDropdown) setUserOpen(false);
      if (guideRef.current && !guideRef.current.contains(target)) setGuideOpen(false);
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

  function isActive(item: typeof NAV_ITEMS[0]) {
    if (item.subpathOnly) return pathname.startsWith(item.href + '/');
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  const avatarText = signedIn
    ? (activeProfile?.display_name || accountEmail || "U").slice(0, 1).toUpperCase()
    : "G";
  const accountTypeLabel = activeProfile?.profile_type === "business" ? "Business" : "Collector";

  return (
    <>
      <div
        className={`sticky top-0 backdrop-blur-xl ${userOpen || commandOpen || guideOpen ? "z-[200]" : "z-40"}`}
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
              {NAV_ITEMS.map((item) => {
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
                      className="text-[10px] font-semibold tracking-[0.04em] leading-none whitespace-nowrap"
                      style={{ color: active ? "#F5B548" : "#A0956B" }}
                    >
                      {item.label}
                    </span>
                    {/* Active underline */}
                    {active && (
                      <span
                        className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full"
                        style={{ background: "linear-gradient(90deg, transparent, #F5B548, transparent)" }}
                      />
                    )}
                  </Link>
                );
              })}
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
                  color: guideOpen ? "#F5B548" : "#A0956B",
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
                <button type="submit" className="shrink-0" style={{ color: "#5A5040" }} aria-label="Search">
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
                  style={{ background: "rgba(255,255,255,0.07)", color: "#5A5040", fontFamily: "monospace" }}>
                  ⌘K
                </span>
              </div>
            </form>

            {/* Bell */}
            <button
              type="button"
              className="hidden md:flex h-[36px] w-[36px] items-center justify-center rounded-full transition"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              aria-label="Notifications"
            >
              <IconBell />
            </button>

            {/* User menu */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-1 rounded-full p-1 transition"
                style={{ background: "transparent", border: "none" }}
              >
                <div
                  className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                  style={{ background: 'var(--theme-gold-gradient, linear-gradient(135deg,#8B6914,#F5B548))', color: "#0B0B0B" }}
                >
                  {avatarText}
                </div>
                <IconChevron size={12} />
              </button>

              {/* User dropdown — rendered via portal so it always paints above page content */}
              {mounted && userOpen && typeof document !== "undefined" && createPortal(
                <div
                  ref={userDropdownRef}
                  className="fixed w-[300px] overflow-hidden rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
                  style={{
                    top: dropdownPos.top,
                    right: dropdownPos.right,
                    zIndex: 9999,
                    background: "var(--theme-nav-bg, rgba(11,19,32,0.99))",
                    border: "1px solid var(--theme-nav-border, rgba(245,181,72,0.18))",
                    backdropFilter: "blur(20px)",
                  }}
                >
                  <div className="px-4 py-3.5" style={{ borderBottom: "1px solid rgba(245,181,72,0.10)" }}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
                          {activeProfile?.display_name || accountEmail || "Guest"}
                        </div>
                        <div className="mt-0.5 truncate text-xs" style={{ color: "#A0956B" }}>
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
                        ].map(({ href, label }) => (
                          <Link key={href} href={href} onClick={() => setUserOpen(false)}
                            className="block rounded-xl px-3 py-2.5 text-sm transition hover:bg-[rgba(245,181,72,0.06)]"
                            style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
                            {label}
                          </Link>
                        ))}
                        {profiles.length > 1 && (
                          <button type="button"
                            onClick={() => { setUserOpen(false); setCommandOpen(true); }}
                            className="block w-full rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[rgba(245,181,72,0.06)]"
                            style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
                            Switch Account
                          </button>
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
                  {/* Appearance / Theme picker */}
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
                </div>,
                document.body
              )}
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
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: "#5A5040" }}>
                Explore VLTD
              </p>
              <div className="grid grid-cols-4 gap-2 lg:grid-cols-10">
                {NAV_ITEMS.map((item) => {
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
                        <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight" style={{ color: "#5A5040" }}>
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
                      Your Collection.<br />Your Museum.<br />Your Legacy.
                    </p>
                    <Link
                      href="/about"
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
