"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";

import CommandPalette from "@/components/CommandPalette";
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

function IconSearch({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16.4 16.4 21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconVault({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M5 10h14v9H5z" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconMuseum({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 10h16" stroke="currentColor" strokeWidth="2" />
      <path d="M6 10v8M12 10v8M18 10v8M3 18h18" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 4 4 8h16L12 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChart({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M5 19V9M12 19V5M19 19v-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function normalize(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

function parseQuerySmart(raw: string): Parsed {
  const s = normalize(raw).toLowerCase();
  const out: Parsed = {};
  let leftover = s;

  const catMap: Record<string, string> = {
    comics: "COMICS",
    comic: "COMICS",
    sports: "SPORTS",
    sport: "SPORTS",
    pokemon: "POKEMON",
    "pokémon": "POKEMON",
    mtg: "MTG",
    magic: "MTG",
    custom: "CUSTOM",
  };

  for (const key of Object.keys(catMap)) {
    const re = new RegExp(`\\b${key}\\b`, "i");
    if (re.test(leftover)) {
      out.cat = catMap[key];
      leftover = leftover.replace(re, " ");
    }
  }

  const graders = ["cgc", "psa", "bgs", "sgc"];
  for (const g of graders) {
    const re = new RegExp(`\\b${g}\\b`, "i");
    if (re.test(leftover)) {
      out.graded = g.toUpperCase();
      leftover = leftover.replace(re, " ");
    }
  }

  const gradeInline = leftover.match(/\b(\d{1,2}(?:\.\d)?)\b/);
  if (gradeInline?.[1]) {
    const maybe = gradeInline[1];
    if (Number(maybe) >= 1 && Number(maybe) <= 10) {
      out.grade = maybe;
      leftover = leftover.replace(gradeInline[0], " ");
    }
  }

  const cleaned = normalize(leftover).trim();
  if (cleaned) out.q = cleaned;
  return out;
}

function navPillClass(active: boolean) {
  return [
    "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm ring-1 transition whitespace-nowrap",
    active
      ? "bg-[color:var(--pill)] text-[color:var(--fg)] vltd-pill-main"
      : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]",
  ].join(" ");
}

function TopNavInner() {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const [input, setInput] = useState("");
  const [userOpen, setUserOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const [signedIn, setSignedIn] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [activeProfileId, setActiveProfileId] = useState("");

  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const loadingAuthRef = useRef(false);
  const initializedRef = useRef(false);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
    [profiles, activeProfileId]
  );

  useEffect(() => {
    setInput(sp.get("q") ?? "");
  }, [sp]);

  useEffect(() => {
    let active = true;

    initAuthListener();

    async function loadAuthState(reason: "initial" | "auth-change" = "initial") {
      if (loadingAuthRef.current) return;
      loadingAuthRef.current = true;

      try {
        const {
          data: { user },
        } = await getCurrentUser();

        if (!active) return;

        if (!user) {
          setSignedIn(false);
          setAccountEmail("");
          setProfiles([]);
          setActiveProfileId("");
          initializedRef.current = true;
          return;
        }

        setSignedIn(true);
        setAccountEmail(user.email ?? "");

        const { data } = await listMyProfiles();
        if (!active) return;

        const nextProfiles = (data ?? []) as ProfileRow[];
        setProfiles(nextProfiles);

        const stored =
          typeof window !== "undefined"
            ? localStorage.getItem(ACTIVE_PROFILE_KEY)
            : "";

        const nextActive =
          nextProfiles.find((p) => p.id === stored)?.id ??
          nextProfiles.find((p) => p.username === "clerk")?.id ??
          nextProfiles[0]?.id ??
          "";

        setActiveProfileId(nextActive);

        if (
          typeof window !== "undefined" &&
          nextActive &&
          nextActive !== stored
        ) {
          localStorage.setItem(ACTIVE_PROFILE_KEY, nextActive);
          window.dispatchEvent(new Event("vltd:active-profile"));
        }

        if (reason === "initial") {
          initializedRef.current = true;
        }
      } finally {
        loadingAuthRef.current = false;
      }
    }

    void loadAuthState("initial");

    const { data: subscription } = onAuthStateChange(() => {
      if (!initializedRef.current) return;
      void loadAuthState("auth-change");
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserOpen(false);
      }
    }

    if (userOpen) {
      document.addEventListener("mousedown", handleOutside);
    }

    return () => document.removeEventListener("mousedown", handleOutside);
  }, [userOpen]);

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
    setUserOpen(false);
    setSignedIn(false);
    setAccountEmail("");
    setProfiles([]);
    setActiveProfileId("");
    router.push("/login");
    router.refresh();
  }

  const avatarText = signedIn
    ? (activeProfile?.display_name || accountEmail || "U").slice(0, 1).toUpperCase()
    : "G";

  const accountTypeLabel =
    activeProfile?.profile_type === "business" ? "Business" : "Collector";

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--surface)]/82 backdrop-blur-xl">
        <div className="mx-auto grid h-[72px] max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-5">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img src="/brand/vltd-logo.png" alt="VLTD" className="h-[44px] w-auto sm:h-[48px]" />
            </Link>
          </div>

          <div className="hidden min-w-0 items-center justify-center md:flex">
            <div className="flex items-center gap-2">
              <Link href="/vault" className={navPillClass(pathname.startsWith("/vault"))}>
                <IconVault />
                Vault
              </Link>
              <Link href="/museum" className={navPillClass(pathname.startsWith("/museum"))}>
                <IconMuseum />
                Museum
              </Link>
              <Link href="/portfolio" className={navPillClass(pathname.startsWith("/portfolio"))}>
                <IconChart />
                Portfolio
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applySearch(input);
              }}
              className="hidden md:block"
            >
              <div
                className={[
                  "flex h-[42px] items-center overflow-hidden rounded-full bg-[color:var(--input)] ring-1 ring-[color:var(--border)] transition-all duration-200",
                  searchExpanded ? "w-[280px] px-3" : "w-[176px] px-3",
                ].join(" ")}
              >
                <button type="submit" className="shrink-0 text-[color:var(--muted)]" aria-label="Search vault">
                  <IconSearch />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setSearchExpanded(true)}
                  onBlur={() => {
                    if (!input.trim()) setSearchExpanded(false);
                  }}
                  placeholder="Search vault..."
                  className="ml-2 min-w-0 flex-1 bg-transparent text-sm text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] focus:outline-none"
                />
              </div>
            </form>

            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                className="grid h-[48px] w-[48px] place-items-center rounded-full bg-[color:var(--pill)] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
              >
                {avatarText}
              </button>

              {userOpen ? (
                <div className="absolute right-0 mt-3 w-[280px] overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                  <div className="border-b border-[color:var(--border)] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[color:var(--fg)]">
                          {activeProfile?.display_name || accountEmail || "Guest"}
                        </div>
                        <div className="mt-1 truncate text-xs text-[color:var(--muted)]">
                          {accountEmail || "Not signed in"}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]">
                        {accountTypeLabel}
                      </div>
                    </div>
                  </div>

                  <div className="px-2 py-2">
                    <Link
                      href="/collector"
                      onClick={() => setUserOpen(false)}
                      className="block rounded-xl px-3 py-2.5 text-sm text-[color:var(--fg)] transition hover:bg-[color:var(--pill)]"
                    >
                      Collector Profile
                    </Link>
                    <Link
                      href="/account"
                      onClick={() => setUserOpen(false)}
                      className="block rounded-xl px-3 py-2.5 text-sm text-[color:var(--fg)] transition hover:bg-[color:var(--pill)]"
                    >
                      Account Settings
                    </Link>
                    {profiles.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setUserOpen(false);
                          setCommandOpen(true);
                        }}
                        className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-[color:var(--fg)] transition hover:bg-[color:var(--pill)]"
                      >
                        Switch Account
                      </button>
                    ) : null}
                  </div>

                  <div className="border-t border-[color:var(--border)] px-2 py-2">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block w-full rounded-xl px-3 py-2.5 text-left text-sm text-[color:var(--fg)] transition hover:bg-[color:var(--pill)]"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-[color:var(--border)]/60 md:hidden">
          <div className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2 sm:px-5">
            <Link href="/vault" className={navPillClass(pathname.startsWith("/vault"))}>
              <IconVault />
              Vault
            </Link>
            <Link href="/museum" className={navPillClass(pathname.startsWith("/museum"))}>
              <IconMuseum />
              Museum
            </Link>
            <Link href="/portfolio" className={navPillClass(pathname.startsWith("/portfolio"))}>
              <IconChart />
              Portfolio
            </Link>
          </div>

          <div className="px-4 pb-3 sm:px-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applySearch(input);
              }}
            >
              <div className="flex h-[42px] items-center rounded-full bg-[color:var(--input)] px-3 ring-1 ring-[color:var(--border)]">
                <button type="submit" className="shrink-0 text-[color:var(--muted)]" aria-label="Search vault">
                  <IconSearch />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Search vault..."
                  className="ml-2 min-w-0 flex-1 bg-transparent text-sm text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] focus:outline-none"
                />
              </div>
            </form>
          </div>
        </div>
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