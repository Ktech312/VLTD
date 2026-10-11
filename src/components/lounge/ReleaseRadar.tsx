"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAllSources, formatStoreDate, type UpcomingIssue } from "@/lib/comicUpcoming";

// Release Radar: what's coming out soon, in the Lounge's left column.
// Comics only for now (Metron); the dropdown is where other categories will
// go once there's a real release source for them.
const CATEGORIES = [{ value: "comics", label: "Comics", href: "/upcoming" }] as const;

export default function ReleaseRadar({ cardStyle, accent }: { cardStyle: React.CSSProperties; accent: string }) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("comics");
  const [issues, setIssues] = useState<UpcomingIssue[] | null>(null);

  useEffect(() => {
    let active = true;
    // Soonest release date, same feed as the Upcoming Comics page.
    void fetchAllSources({ days: 30, page: 1, pageSize: 25, byDate: true }).then((data) => {
      if (active) setIssues((data?.results ?? []).filter((i) => i.imageUrl).slice(0, 5));
    });
    return () => {
      active = false;
    };
  }, [category]);

  const current = CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[0];

  return (
    <section className="rounded-[8px]" style={cardStyle}>
      <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>Release Radar</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          aria-label="Release category"
          className="rounded-[6px] px-2 py-1 text-[11px] font-bold"
          style={{ background: "var(--pill)", color: "var(--fg)", border: "1px solid var(--border)" }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {issues === null ? (
        <div className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--muted2)" }}>Loading…</div>
      ) : issues.length === 0 ? (
        <div className="px-4 py-6 text-center text-[12px]" style={{ color: "var(--muted2)" }}>No releases in the next 30 days.</div>
      ) : (
        <ul>
          {issues.map((issue) => (
            <li key={issue.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <Link href={current.href} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-[color:var(--table-row-hover)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={issue.imageUrl ?? ""} alt="" loading="lazy" className="h-[54px] w-9 shrink-0 rounded-[4px] object-cover" style={{ border: "1px solid var(--border)" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold">{issue.series} #{issue.number}</p>
                  <p className="text-[10px]" style={{ color: "var(--muted2)" }}>{formatStoreDate(issue.storeDate)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={current.href} className="block w-full px-4 py-3 text-left text-[12px] font-bold" style={{ color: accent }}>
        See all upcoming {current.label.toLowerCase()} →
      </Link>
    </section>
  );
}
