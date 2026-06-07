"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchRegistrySubjects, type RegistrySubject } from "@/lib/registryModel";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function SubjectCard({ s }: { s: RegistrySubject }) {
  const href = `/registry/${encodeURIComponent(s.subject)}`;
  return (
    <Link
      href={href}
      className="group block rounded-2xl p-5 ring-1 ring-[color:var(--border)] transition hover:ring-[color:var(--theme-gold)] hover:brightness-110"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-bold truncate" style={{ color: "var(--fg)" }}>{s.subject}</div>
          <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
            {s.collectorCount} collector{s.collectorCount !== 1 ? "s" : ""} &middot; {s.itemCount} items
          </div>
        </div>
        <div
          className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: "var(--theme-elevated)", color: "var(--theme-gold)" }}
        >
          #{1}
        </div>
      </div>
      {s.topDisplayName && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-lg">{s.topAvatarEmoji}</span>
          <div>
            <div className="text-[11px] font-semibold" style={{ color: "var(--fg)" }}>{s.topDisplayName}</div>
            <div className="text-[10px]" style={{ color: "var(--muted)" }}>{s.topItemCount} items</div>
          </div>
        </div>
      )}
    </Link>
  );
}

export default function RegistryPage() {
  const [subjects, setSubjects] = useState<RegistrySubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchRegistrySubjects().then((data) => { setSubjects(data); setLoading(false); });
  }, []);

  const filtered = subjects.filter((s) =>
    s.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-4xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link href="/vault" className="text-sm" style={{ color: "var(--muted)" }}>Vault</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Registry</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold" style={{ color: "var(--fg)" }}>Vault Registry</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Global leaderboards for every collectible subject. See who collects what.
          </p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects..."
            className="mt-4 w-full max-w-sm rounded-xl px-4 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            style={{ background: "var(--pill)", color: "var(--fg)" }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        {loading ? (
          <div className="text-center py-16 text-sm" style={{ color: "var(--muted)" }}>Loading registry...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: "var(--muted)" }}>
            {search ? `No subjects matching "${search}"` : "No registry data yet. Start tagging items with subjects in your vault."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((s) => <SubjectCard key={s.subject} s={s} />)}
          </div>
        )}
      </div>
    </div>
  );
}
