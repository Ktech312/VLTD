"use client";

// ─────────────────────────────────────────────────────────────
// /admin/characters — Seed Character Admin
// Auth: env variable gate now. Ready for real auth later.
// To enable: set NEXT_PUBLIC_ADMIN_KEY in your .env.local
// ─────────────────────────────────────────────────────────────

import { useState, useMemo } from "react";
import { SEED_CHARACTERS } from "@/lib/seedCharacters";
import { SEED_CHARACTERS_PART2 } from "@/lib/seedCharacters_part2";
import { SEED_CHARACTERS_PART3 } from "@/lib/seedCharacters_part3";
import { SEED_CHARACTERS_PART4 } from "@/lib/seedCharacters_part4";
import type { SeedCharacter, SeedItem } from "@/lib/seedCharacters";

const ALL_CHARACTERS: SeedCharacter[] = [
  ...SEED_CHARACTERS,
  ...SEED_CHARACTERS_PART2,
  ...SEED_CHARACTERS_PART3,
  ...SEED_CHARACTERS_PART4,
];

const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_KEY ?? "vltd-admin-2024";

// ── Formatters ──────────────────────────────────────────────
function formatMoney(n?: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ── Auth Gate ───────────────────────────────────────────────
function AuthGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  function attempt() {
    if (input === ADMIN_KEY) {
      onUnlock();
    } else {
      setError(true);
      setInput("");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0c12]">
      <div className="w-full max-w-sm rounded-[24px] bg-[#111318] p-8 ring-1 ring-white/10">
        <div className="text-center">
          <div className="text-2xl">🔐</div>
          <div className="mt-2 text-sm font-semibold text-white">Admin Access</div>
          <div className="mt-1 text-xs text-white/40">Character Management</div>
        </div>
        <input
          type="password"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && attempt()}
          placeholder="Admin key"
          className="mt-6 w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/40 placeholder:text-white/30"
        />
        {error && <div className="mt-2 text-center text-xs text-red-400">Incorrect key</div>}
        <button
          onClick={attempt}
          className="mt-4 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400"
        >
          Enter
        </button>
        <div className="mt-4 text-center text-[10px] text-white/20">
          Set NEXT_PUBLIC_ADMIN_KEY in .env.local to change this password.
          {/* Future: swap for Supabase Auth or NextAuth */}
        </div>
      </div>
    </div>
  );
}

// ── Item Row ─────────────────────────────────────────────────
function ItemRow({ item, index }: { item: SeedItem; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.03] transition"
      >
        <span className="w-6 shrink-0 text-center text-[10px] text-white/25">{index + 1}</span>
        <span className="flex-1 text-xs font-medium text-white/80 leading-tight">{item.title}</span>
        <span className="shrink-0 text-[10px] text-white/35">{item.universe}</span>
        <span className="shrink-0 w-16 text-right text-[10px] font-semibold text-amber-400/80">
          {formatMoney(item.currentValue)}
        </span>
        <span className="shrink-0 text-white/20 text-[10px]">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-white/[0.02]">
          <div className="grid gap-1 text-[11px] text-white/60">
            {item.subtitle && <div><span className="text-white/30">Subtitle: </span>{item.subtitle}</div>}
            {item.grade && <div><span className="text-white/30">Grade: </span>{item.grade}</div>}
            {item.category && <div><span className="text-white/30">Category: </span>{item.category}</div>}
            {item.notes && <div><span className="text-white/30">Notes: </span>{item.notes}</div>}
            <div className="flex gap-4 mt-1">
              <div><span className="text-white/30">Value: </span><span className="text-amber-400">{formatMoney(item.currentValue)}</span></div>
              {item.purchasePrice != null && <div><span className="text-white/30">Cost: </span>{formatMoney(item.purchasePrice)}</div>}
              <div><span className="text-white/30">ID: </span><span className="font-mono text-[10px] text-white/30">{item.id}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Character Card ────────────────────────────────────────────
function CharacterCard({
  char,
  isSelected,
  onClick,
}: {
  char: SeedCharacter;
  isSelected: boolean;
  onClick: () => void;
}) {
  const totalValue = char.items.reduce((s, i) => s + (i.currentValue ?? 0), 0);
  return (
    <button
      onClick={onClick}
      className={[
        "w-full rounded-2xl p-4 text-left transition ring-1",
        isSelected
          ? "bg-amber-500/10 ring-amber-400/40"
          : "bg-white/[0.03] ring-white/8 hover:bg-white/[0.06]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">{char.avatarEmoji}</span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{char.displayName}</div>
          <div className="text-[10px] text-white/40">@{char.handle}</div>
        </div>
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-white/50">
        <span>{char.items.length} items</span>
        <span>{char.galleries.length} galleries</span>
        <span className="text-amber-400/70">{formatMoney(totalValue)}</span>
      </div>
      <div className="mt-1 text-[10px] text-white/30">{char.primaryFocus}</div>
    </button>
  );
}

// ── Detail Panel ──────────────────────────────────────────────
function CharacterDetail({ char }: { char: SeedCharacter }) {
  const [tab, setTab] = useState<"items" | "galleries" | "bio">("bio");
  const [search, setSearch] = useState("");

  const totalValue = char.items.reduce((s, i) => s + (i.currentValue ?? 0), 0);
  const universes = [...new Set(char.items.map((i) => i.universe).filter(Boolean))];

  const filteredItems = useMemo(() => {
    if (!search.trim()) return char.items;
    const q = search.toLowerCase();
    return char.items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.subtitle ?? "").toLowerCase().includes(q) ||
        (i.universe ?? "").toLowerCase().includes(q) ||
        (i.category ?? "").toLowerCase().includes(q)
    );
  }, [char.items, search]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/8 p-5">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{char.avatarEmoji}</span>
          <div>
            <div className="text-xl font-bold text-white">{char.displayName}</div>
            <div className="text-sm text-white/40">@{char.handle}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
          <div className="rounded-full bg-white/5 px-3 py-1 text-white/60">
            {char.items.length} items
          </div>
          <div className="rounded-full bg-white/5 px-3 py-1 text-white/60">
            {char.galleries.length} galleries
          </div>
          <div className="rounded-full bg-amber-400/10 px-3 py-1 text-amber-400">
            {formatMoney(totalValue)} total value
          </div>
          <div className="rounded-full bg-white/5 px-3 py-1 text-white/60">
            {char.primaryFocus}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {universes.map((u) => (
            <span key={u} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
              {u}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 border-b border-white/8 px-4 pt-2">
        {(["bio", "items", "galleries"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-3 py-2 text-xs font-semibold capitalize transition border-b-2",
              tab === t
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-white/40 hover:text-white/70",
            ].join(" ")}
          >
            {t}
            {t === "items" && ` (${char.items.length})`}
            {t === "galleries" && ` (${char.galleries.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "bio" && (
          <div className="p-5">
            <div className="text-sm leading-relaxed text-white/70">{char.bio}</div>
            <div className="mt-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Profile ID</div>
              <div className="font-mono text-xs text-white/50 break-all">{char.profileId}</div>
            </div>
            <div className="mt-3 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Gallery IDs</div>
              {char.galleries.map((g) => (
                <div key={g.id} className="font-mono text-[10px] text-white/40 mb-1">{g.id}</div>
              ))}
            </div>
          </div>
        )}

        {tab === "items" && (
          <div>
            <div className="sticky top-0 bg-[#111318] p-3 border-b border-white/5 z-10">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full rounded-xl bg-white/5 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none placeholder:text-white/30"
              />
              {search && (
                <div className="mt-1 text-[10px] text-white/30">
                  {filteredItems.length} of {char.items.length} items
                </div>
              )}
            </div>
            <div>
              {filteredItems.map((item, i) => (
                <ItemRow key={item.id} item={item} index={i} />
              ))}
            </div>
          </div>
        )}

        {tab === "galleries" && (
          <div className="p-4 grid gap-3">
            {char.galleries.map((g) => (
              <div key={g.id} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8">
                <div className="font-semibold text-sm text-white">{g.title}</div>
                <div className="mt-1 text-xs text-white/50">{g.description}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/40">
                  <span className="rounded-full bg-white/5 px-2 py-0.5">{g.themePack}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5">{g.visibility}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5">{g.itemIds.length} items</span>
                </div>
                <div className="mt-2 font-mono text-[10px] text-white/25">{g.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AdminCharactersPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  if (!unlocked) return <AuthGate onUnlock={() => setUnlocked(true)} />;

  const filtered = ALL_CHARACTERS.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.handle.toLowerCase().includes(q) ||
      c.primaryFocus.toLowerCase().includes(q)
    );
  });

  const selected = ALL_CHARACTERS.find((c) => c.handle === selectedHandle) ?? null;

  const totalItems = ALL_CHARACTERS.reduce((s, c) => s + c.items.length, 0);
  const totalValue = ALL_CHARACTERS.reduce(
    (s, c) => s + c.items.reduce((ss, i) => ss + (i.currentValue ?? 0), 0),
    0
  );

  return (
    <div className="flex h-screen bg-[#0a0c12] text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 shrink-0 flex flex-col border-r border-white/8">
        {/* Header */}
        <div className="shrink-0 p-4 border-b border-white/8">
          <div className="text-sm font-bold text-white">Character Admin</div>
          <div className="mt-0.5 text-[10px] text-white/40">
            {ALL_CHARACTERS.length} characters · {totalItems} items · {formatMoney(totalValue)}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search characters..."
            className="mt-3 w-full rounded-xl bg-white/5 px-3 py-1.5 text-xs text-white ring-1 ring-white/10 focus:outline-none placeholder:text-white/30"
          />
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 grid gap-2">
          {filtered.map((char) => (
            <CharacterCard
              key={char.handle}
              char={char}
              isSelected={selectedHandle === char.handle}
              onClick={() => setSelectedHandle(char.handle)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-xs text-white/30 py-8">No characters found</div>
          )}
        </div>
        {/* Footer note */}
        <div className="shrink-0 p-3 border-t border-white/8 text-[10px] text-white/25 text-center">
          To add users: edit seedCharacters*.ts → run generateCharacterSeed.ts → paste SQL in Supabase
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-hidden bg-[#111318]">
        {selected ? (
          <CharacterDetail char={selected} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-4xl opacity-20">👤</div>
              <div className="mt-2 text-sm text-white/30">Select a character</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
