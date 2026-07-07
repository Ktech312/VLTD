"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import {
  getAllCommands,
  groupCommands,
  runCommandAction,
  searchCommands,
  type CommandItem,
  type CommandProfile,
  type CommandSection,
} from "@/lib/commandCenter";

type Props = {
  open: boolean;
  onClose: () => void;
  profileLabel?: string;
  profiles?: CommandProfile[];
  activeProfileId?: string;
};

const SECTION_LABELS: Record<CommandSection, string> = {
  navigation: "Navigation",
  vault: "Vault",
  museum: "Exhibitions",
  portfolio: "Portfolio",
  account: "Account",
  action: "Actions",
};

const SECTION_ORDER: CommandSection[] = [
  "action",
  "navigation",
  "vault",
  "museum",
  "portfolio",
  "account",
];

const SECTION_LIMITS: Record<CommandSection, number> = {
  action: 6,
  navigation: 6,
  vault: 8,
  museum: 8,
  portfolio: 5,
  account: 8,
};

function trimGroupedResults(grouped: Record<CommandSection, CommandItem[]>) {
  const trimmed: Record<CommandSection, CommandItem[]> = {
    navigation: [],
    vault: [],
    museum: [],
    portfolio: [],
    account: [],
    action: [],
  };

  for (const section of SECTION_ORDER) {
    trimmed[section] = grouped[section].slice(0, SECTION_LIMITS[section]);
  }

  return trimmed;
}

function flattenOrdered(grouped: Record<CommandSection, CommandItem[]>) {
  return SECTION_ORDER.flatMap((section) => grouped[section]);
}

export default function CommandPalette({
  open,
  onClose,
  profileLabel,
  profiles = [],
  activeProfileId,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const commands = useMemo(
    () => getAllCommands({ profiles, activeProfileId }),
    [open, profiles, activeProfileId]
  );
  const searchedResults = useMemo(() => searchCommands(commands, query), [commands, query]);
  const groupedRaw = useMemo(() => groupCommands(searchedResults), [searchedResults]);
  const grouped = useMemo(() => trimGroupedResults(groupedRaw), [groupedRaw]);
  const visibleResults = useMemo(() => flattenOrdered(grouped), [grouped]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 10);

    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, Math.max(visibleResults.length - 1, 0)));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        const command = visibleResults[activeIndex];
        if (!command) return;

        e.preventDefault();

        const handled = runCommandAction(command);
        if (!handled && command.href) {
          router.push(command.href);
        }
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, visibleResults, activeIndex, router, onClose]);

  function runCommand(command: CommandItem) {
    const handled = runCommandAction(command);
    if (!handled && command.href) {
      router.push(command.href);
    }
    onClose();
  }

  if (!open || !mounted) return null;

  // Portal to <body> so the overlay escapes the nav's stacking context /
  // page-transition transforms — otherwise z-index can't lift it above content.
  return createPortal(
    <div className="fixed inset-0 z-[9998]">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div
        className="absolute left-1/2 top-[8vh] w-[min(760px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-[28px] border border-[color:var(--border)] shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
        style={{
          // Guaranteed-opaque base (no theme var can make it transparent), with the
          // theme surface tint composited on top so it still matches the active theme.
          backgroundColor: "#0e1526",
          backgroundImage: "linear-gradient(var(--surface-strong), var(--surface-strong))",
        }}
      >
        <div className="border-b border-[color:var(--border)] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                COMMAND PALETTE
              </div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                {profileLabel ? `Active profile: ${profileLabel}` : "Global navigation and collector actions"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs text-[color:var(--muted2)] ring-1 ring-[color:var(--border)] sm:block">
                ⌘K
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close command palette"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-[color:var(--muted)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)] hover:text-[color:var(--fg)]"
              >
                ✕
              </button>
            </div>
          </div>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "vault", "gallery", "create gallery", a profile name, or an item title...'
            className="mt-3 min-h-[48px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 text-base text-[color:var(--fg)] ring-1 ring-[color:var(--border)] placeholder:text-[color:var(--muted2)] focus:outline-none"
          />
        </div>

        <div className="max-h-[65vh] overflow-auto p-3 sm:p-4">
          {visibleResults.length === 0 ? (
            <div className="rounded-[22px] bg-[color:var(--input)] p-5 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              No commands matched your search.
            </div>
          ) : (
            <div className="grid gap-4">
              {SECTION_ORDER.map((section) => {
                const sectionItems = grouped[section];
                if (!sectionItems.length) return null;

                return (
                  <section key={section}>
                    <div className="flex items-center justify-between px-2 pb-2">
                      <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                        {SECTION_LABELS[section]}
                      </div>
                      <div className="text-[10px] text-[color:var(--muted2)]">
                        {sectionItems.length}
                      </div>
                    </div>

                    <div className="grid gap-2">
                      {sectionItems.map((command) => {
                        const absoluteIndex = visibleResults.findIndex((x) => x.id === command.id);
                        const active = absoluteIndex === activeIndex;

                        return (
                          <button
                            key={command.id}
                            type="button"
                            onClick={() => runCommand(command)}
                            className={[
                              "w-full rounded-[20px] px-4 py-3 text-left ring-1 transition",
                              active
                                ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-transparent"
                                : "bg-[color:var(--input)] text-[color:var(--fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill)]",
                            ].join(" ")}
                          >
                            <div className="text-sm font-semibold">{command.label}</div>
                            {command.subtitle ? (
                              <div
                                className={[
                                  "mt-1 text-xs",
                                  active
                                    ? "text-[color:var(--fg)]/80"
                                    : "text-[color:var(--muted)]",
                                ].join(" ")}
                              >
                                {command.subtitle}
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-[color:var(--border)] px-4 py-3 text-xs text-[color:var(--muted)] sm:px-5">
          ↑ ↓ to move • Enter to open • Esc to close
        </div>
      </div>
    </div>,
    document.body
  );
}