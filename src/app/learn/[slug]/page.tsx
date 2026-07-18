import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Glyph } from "@/components/ui/Glyph";
import SaveArticleButton from "@/components/learn/SaveArticleButton";
import { getArticle, LEARN_ARTICLES, type LearnBlock } from "@/lib/learnContent";

export function generateStaticParams() {
  return LEARN_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Learn — VLTD" };
  return { title: `${article.title} — VLTD`, description: article.dek };
}

function Block({ block }: { block: LearnBlock }) {
  switch (block.type) {
    case "h":
      return <h2 className="mt-8 text-lg font-black tracking-[-0.02em] text-text-primary">{block.text}</h2>;
    case "p":
      return <p className="mt-4 text-[15px] leading-7 text-[color:var(--muted)]">{block.text}</p>;
    case "list":
      return (
        <ul className="mt-4 space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-7 text-[color:var(--muted)]">
              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--theme-gold,#F5B548)" }} />
              {it}
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="mt-4 space-y-3">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-7 text-[color:var(--muted)]">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black" style={{ background: "rgba(245,181,72,0.12)", color: "var(--theme-gold,#F5B548)" }}>
                {i + 1}
              </span>
              <span className="pt-0.5">{it}</span>
            </li>
          ))}
        </ol>
      );
    case "callout":
      return (
        <div className="mt-6 rounded-[14px] border border-[rgba(245,181,72,0.28)] bg-[rgba(245,181,72,0.06)] px-4 py-3 text-[14px] leading-6 text-[color:var(--fg)]">
          {block.text}
        </div>
      );
  }
}

export default async function LearnArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/learn" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          Learn
        </Link>

        <header className="mt-5 border-b border-[color:var(--border)] pb-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-[12px]" style={{ background: "rgba(245,181,72,0.08)", border: "1px solid rgba(245,181,72,0.2)", color: "var(--theme-gold,#F5B548)" }}>
              <Glyph name={article.glyph} size={22} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--accent)]">{article.category}</span>
          </div>
          <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.035em] text-text-primary sm:text-4xl">
            {article.title}
          </h1>
          <p className="mt-3 text-base leading-7 text-[color:var(--muted)]">{article.dek}</p>
          <div className="mt-5 flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--muted2)]">
              <Glyph name="clock" size={14} /> {article.readMinutes} min read
            </span>
            <SaveArticleButton slug={article.slug} />
          </div>
        </header>

        <article className="pb-4">
          {article.body.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </article>

        <div className="mt-8 rounded-[18px] border border-[color:var(--border)] bg-vault-card p-6 text-center">
          <h3 className="text-lg font-black text-text-primary">Put it into practice</h3>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Document, value, and protect your collection in VLTD.</p>
          <Link
            href="/vault"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-bold"
            style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}
          >
            Go to your vault
          </Link>
        </div>
      </div>
    </main>
  );
}
