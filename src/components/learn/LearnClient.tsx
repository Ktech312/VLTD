"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Glyph, type GlyphName } from "@/components/ui/Glyph";
import NewsletterSignup from "@/components/learn/NewsletterSignup";
import {
  FEATURED_ARTICLE,
  GUIDE_ARTICLES,
  PLAYBOOK_ARTICLES,
  QUICK_ARTICLES,
  LEARN_ARTICLES,
  type LearnArticle,
} from "@/lib/learnContent";
import {
  loadSavedArticles,
  toggleSavedArticle,
  syncSavedArticlesFromSupabase,
} from "@/lib/savedArticles";

function ThumbGlyph({ glyph, className = "" }: { glyph: GlyphName; className?: string }) {
  return (
    <div
      className={`grid place-items-center ${className}`}
      style={{ background: "linear-gradient(135deg, rgba(245,181,72,0.10), rgba(20,20,28,0.6))" }}
    >
      <span style={{ color: "var(--theme-gold,#F5B548)", opacity: 0.85 }}>
        <Glyph name={glyph} size={40} />
      </span>
    </div>
  );
}

function SaveChip({ saved, onToggle }: { saved: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      aria-pressed={saved}
      className="inline-flex items-center gap-1.5 text-xs font-semibold transition"
      style={{ color: saved ? "var(--theme-gold,#F5B548)" : "var(--muted)" }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}

function ClockRead({ minutes }: { minutes: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--muted2)]">
      <Glyph name="clock" size={13} />
      {minutes} min read
    </span>
  );
}

export default function LearnClient() {
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    setSaved(loadSavedArticles());
    void syncSavedArticlesFromSupabase().then(setSaved);
  }, []);

  const toggle = (slug: string) => setSaved(toggleSavedArticle(slug));
  const isSaved = (slug: string) => saved.includes(slug);

  const savedArticles = useMemo(
    () => LEARN_ARTICLES.filter((a) => saved.includes(a.slug)),
    [saved],
  );

  const featured = FEATURED_ARTICLE;

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ── Header ── */}
        <header className="mb-8">
          <h1 className="text-4xl font-black tracking-[-0.04em] text-text-primary">Learn</h1>
          <p className="mt-2 text-base text-[color:var(--muted)]">
            Collector knowledge, insurance guidance, and market education.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── Main column ── */}
          <div className="min-w-0">
            {/* Featured */}
            <Link
              href={`/learn/${featured.slug}`}
              className="group block overflow-hidden rounded-[22px] border border-[color:var(--border)] bg-vault-card transition hover:border-[rgba(245,181,72,0.4)]"
              style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.22)" }}
            >
              <div className="grid md:grid-cols-2">
                <div className="p-6 sm:p-8">
                  <span className="inline-flex rounded-full border border-[rgba(245,181,72,0.28)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--accent)]">
                    Featured
                  </span>
                  <h2 className="mt-4 text-2xl font-black leading-tight tracking-[-0.03em] text-text-primary sm:text-3xl">
                    {featured.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">{featured.dek}</p>
                  <div className="mt-6 flex items-center gap-4">
                    <ClockRead minutes={featured.readMinutes} />
                    {featured.tag && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--muted2)]">
                        <Glyph name="tag" size={13} />
                        {featured.tag}
                      </span>
                    )}
                    <span className="ml-auto">
                      <SaveChip saved={isSaved(featured.slug)} onToggle={() => toggle(featured.slug)} />
                    </span>
                  </div>
                </div>
                <ThumbGlyph glyph={featured.glyph} className="min-h-[180px] md:min-h-full" />
              </div>
            </Link>

            {/* Guides & Articles */}
            <h2 className="mb-4 mt-10 text-xl font-black tracking-[-0.03em] text-text-primary">Guides &amp; Articles</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {GUIDE_ARTICLES.map((a) => (
                <GuideCard key={a.slug} a={a} saved={isSaved(a.slug)} onToggle={() => toggle(a.slug)} />
              ))}
            </div>

            {/* Saved guides (only when there are some) */}
            {savedArticles.length > 0 && (
              <>
                <h2 className="mb-4 mt-10 flex items-center gap-2 text-xl font-black tracking-[-0.03em] text-text-primary">
                  <Glyph name="star" size={18} /> Saved guides
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {savedArticles.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/learn/${a.slug}`}
                      className="flex items-center gap-3 rounded-[14px] border border-[color:var(--border)] bg-vault-card px-4 py-3 transition hover:border-[rgba(245,181,72,0.4)]"
                    >
                      <span style={{ color: "var(--theme-gold,#F5B548)" }}><Glyph name={a.glyph} size={20} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-text-primary">{a.title}</span>
                        <span className="block text-[11px] text-[color:var(--muted2)]">{a.category}</span>
                      </span>
                      <span className="ml-auto shrink-0">
                        <SaveChip saved onToggle={() => toggle(a.slug)} />
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-5">
            {/* Collector Playbooks */}
            <section className="rounded-[20px] border border-[color:var(--border)] bg-vault-card p-4">
              <h3 className="mb-3 flex items-center gap-2 text-base font-black text-text-primary">
                <Glyph name="cards" size={18} /> Collector Playbooks
              </h3>
              <div className="divide-y divide-[color:var(--border)]">
                {PLAYBOOK_ARTICLES.map((a) => (
                  <SidebarRow key={a.slug} a={a} />
                ))}
              </div>
            </section>

            {/* Quick Guides */}
            <section className="rounded-[20px] border border-[color:var(--border)] bg-vault-card p-4">
              <h3 className="mb-3 text-base font-black text-text-primary">Quick Guides</h3>
              <div className="divide-y divide-[color:var(--border)]">
                {QUICK_ARTICLES.map((a) => (
                  <SidebarRow key={a.slug} a={a} />
                ))}
              </div>
            </section>

            {/* Newsletter */}
            <section className="rounded-[20px] border border-[color:var(--border)] bg-vault-card p-5">
              <div className="mb-3 flex items-start gap-3">
                <span style={{ color: "var(--theme-gold,#F5B548)" }}><Glyph name="message" size={22} /></span>
                <div>
                  <h3 className="text-base font-black text-text-primary">Collector insights, delivered</h3>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                    New guides, market updates, and tips — straight to your inbox.
                  </p>
                </div>
              </div>
              <NewsletterSignup source="learn" />
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function GuideCard({ a, saved, onToggle }: { a: LearnArticle; saved: boolean; onToggle: () => void }) {
  return (
    <Link
      href={`/learn/${a.slug}`}
      className="group flex flex-col overflow-hidden rounded-[18px] border border-[color:var(--border)] bg-vault-card transition hover:border-[rgba(245,181,72,0.4)]"
    >
      <div className="relative">
        <ThumbGlyph glyph={a.glyph} className="h-28" />
        <span className="absolute left-3 top-3 rounded-full bg-[rgba(0,0,0,0.55)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent)]">
          {a.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-base font-black leading-snug text-text-primary">{a.title}</h3>
        <p className="mt-1.5 flex-1 text-xs leading-5 text-[color:var(--muted)]">{a.dek}</p>
        <div className="mt-3 flex items-center justify-between">
          <ClockRead minutes={a.readMinutes} />
          <SaveChip saved={saved} onToggle={onToggle} />
        </div>
      </div>
    </Link>
  );
}

function SidebarRow({ a }: { a: LearnArticle }) {
  return (
    <Link href={`/learn/${a.slug}`} className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: "rgba(245,181,72,0.08)", border: "1px solid rgba(245,181,72,0.18)", color: "var(--theme-gold,#F5B548)" }}>
        <Glyph name={a.glyph} size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-text-primary">{a.title}</span>
        <span className="block truncate text-[11px] text-[color:var(--muted2)]">{a.dek}</span>
      </span>
      <span className="shrink-0 text-[color:var(--muted2)] transition group-hover:text-[color:var(--theme-gold,#F5B548)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
      </span>
    </Link>
  );
}
