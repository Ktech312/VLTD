"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Glyph } from "@/components/ui/Glyph";
import CoverArt from "@/components/learn/CoverArt";
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

function Thumb({ article, className = "" }: { article: LearnArticle; className?: string }) {
  if (article.image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={article.image} alt="" className={`h-full w-full object-cover ${className}`} />;
  }
  return <CoverArt slug={article.slug} className={`h-full w-full ${className}`} />;
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
      className="inline-flex items-center gap-1 text-[11px] font-semibold transition"
      style={{ color: saved ? "var(--theme-gold,#F5B548)" : "var(--muted)" }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}

function ClockRead({ minutes }: { minutes: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--muted2)]">
      <Glyph name="clock" size={12} />
      {minutes} min read
    </span>
  );
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
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
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_312px]">
          {/* ── Main column (header lives here so the sidebar rises to the top) ── */}
          <div className="min-w-0">
            <div className="mb-5">
              <h1 className="text-[26px] font-black tracking-[-0.03em] text-text-primary">Learn</h1>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Collector knowledge, insurance guidance, and market education.
              </p>
            </div>

            {/* Featured */}
            <Link
              href={`/learn/${featured.slug}`}
              className="group block overflow-hidden rounded-[8px] border border-[color:var(--border)] bg-vault-card transition hover:border-[rgba(245,181,72,0.4)]"
            >
              <div className="grid md:grid-cols-[1.1fr_0.9fr]">
                <div className="p-5">
                  <span className="inline-flex rounded-[5px] border border-[rgba(245,181,72,0.28)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--accent)]">
                    Featured
                  </span>
                  <h2 className="mt-3 text-xl font-black leading-tight tracking-[-0.02em] text-text-primary sm:text-2xl">
                    {featured.title}
                  </h2>
                  <p className="mt-2 text-[13px] leading-6 text-[color:var(--muted)]">{featured.dek}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <ClockRead minutes={featured.readMinutes} />
                    {featured.tag && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[color:var(--muted2)]">
                        <Glyph name="tag" size={12} />
                        {featured.tag}
                      </span>
                    )}
                    <span className="ml-auto">
                      <SaveChip saved={isSaved(featured.slug)} onToggle={() => toggle(featured.slug)} />
                    </span>
                  </div>
                </div>
                <Thumb article={featured} className="min-h-[150px] md:min-h-full" />
              </div>
            </Link>

            {/* Guides & Articles */}
            <h2 className="mb-3 mt-7 text-base font-black tracking-[-0.02em] text-text-primary">Guides &amp; Articles</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GUIDE_ARTICLES.map((a) => (
                <GuideCard key={a.slug} a={a} saved={isSaved(a.slug)} onToggle={() => toggle(a.slug)} />
              ))}
            </div>

            {/* Saved guides (only when there are some) */}
            {savedArticles.length > 0 && (
              <>
                <h2 className="mb-3 mt-7 flex items-center gap-1.5 text-base font-black tracking-[-0.02em] text-text-primary">
                  <Glyph name="star" size={16} /> Saved guides
                </h2>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {savedArticles.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/learn/${a.slug}`}
                      className="flex items-center gap-2.5 rounded-[8px] border border-[color:var(--border)] bg-vault-card px-3 py-2.5 transition hover:border-[rgba(245,181,72,0.4)]"
                    >
                      <span style={{ color: "var(--theme-gold,#F5B548)" }}><Glyph name={a.glyph} size={18} /></span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold text-text-primary">{a.title}</span>
                        <span className="block text-[10px] text-[color:var(--muted2)]">{a.category}</span>
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
          <aside className="space-y-4">
            {/* Collector Playbooks */}
            <section className="rounded-[8px] border border-[color:var(--border)] bg-vault-card p-3.5">
              <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-black text-text-primary">
                <Glyph name="cards" size={16} /> Collector Playbooks
              </h3>
              <div className="divide-y divide-[color:var(--border)]">
                {PLAYBOOK_ARTICLES.map((a) => (
                  <SidebarRow key={a.slug} a={a} />
                ))}
              </div>
            </section>

            {/* Quick Guides */}
            <section className="rounded-[8px] border border-[color:var(--border)] bg-vault-card p-3.5">
              <h3 className="mb-2.5 text-sm font-black text-text-primary">Quick Guides</h3>
              <div className="divide-y divide-[color:var(--border)]">
                {QUICK_ARTICLES.map((a) => (
                  <SidebarRow key={a.slug} a={a} />
                ))}
              </div>
            </section>

            {/* Newsletter */}
            <section className="rounded-[8px] border border-[color:var(--border)] bg-vault-card p-4">
              <div className="mb-3 flex items-start gap-2.5">
                <span style={{ color: "var(--theme-gold,#F5B548)" }}><Glyph name="message" size={20} /></span>
                <div>
                  <h3 className="text-sm font-black text-text-primary">Collector insights, delivered</h3>
                  <p className="mt-1 text-[11px] leading-5 text-[color:var(--muted)]">
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
      className="group flex flex-col overflow-hidden rounded-[8px] border border-[color:var(--border)] bg-vault-card transition hover:border-[rgba(245,181,72,0.4)]"
    >
      <div className="relative h-24">
        <Thumb article={a} className="h-24" />
        <span className="absolute left-2.5 top-2.5 rounded-[5px] bg-[rgba(0,0,0,0.6)] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent)]">
          {a.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="text-[14px] font-black leading-snug text-text-primary">{a.title}</h3>
        <p className="mt-1 flex-1 text-[11px] leading-5 text-[color:var(--muted)]">{a.dek}</p>
        <div className="mt-2.5 flex items-center justify-between">
          <ClockRead minutes={a.readMinutes} />
          <SaveChip saved={saved} onToggle={onToggle} />
        </div>
      </div>
    </Link>
  );
}

function SidebarRow({ a }: { a: LearnArticle }) {
  return (
    <Link href={`/learn/${a.slug}`} className="group flex items-center gap-3 py-2 first:pt-1 last:pb-1">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[6px]" style={{ background: "rgba(245,181,72,0.08)", border: "1px solid rgba(245,181,72,0.18)", color: "var(--theme-gold,#F5B548)" }}>
        <Glyph name={a.glyph} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold leading-tight text-text-primary">{a.title}</span>
        <span className="block truncate text-[11px] text-[color:var(--muted2)]">{a.dek}</span>
      </span>
      <span className="shrink-0 text-[color:var(--muted2)] transition group-hover:text-[color:var(--theme-gold,#F5B548)]">
        <Chevron />
      </span>
    </Link>
  );
}
