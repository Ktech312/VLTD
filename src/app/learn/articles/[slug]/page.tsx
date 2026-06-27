import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PortableText } from "@portabletext/react";
import { getArticle } from "@/lib/sanity";
import { createImageUrlBuilder as imageUrlBuilder } from "@sanity/image-url";
import { client } from "@/lib/sanity";

const builder = imageUrlBuilder(client);
function urlFor(source: object) {
  return builder.image(source).width(1200).height(630).fit("crop").url();
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let article;
  try {
    article = await getArticle(slug);
  } catch {
    return {};
  }
  if (!article) return {};
  return {
    title: article.seoTitle || `${article.title} — VLTD`,
    description: article.seoDescription || article.excerpt || "",
  };
}

const portableComponents = {
  types: {
    image: ({ value }: { value: object & { alt?: string } }) => (
      <div className="my-8 overflow-hidden rounded-[18px]">
        <Image
          src={urlFor(value)}
          alt={value.alt || ""}
          width={1200}
          height={630}
          className="w-full object-cover"
        />
      </div>
    ),
  },
  block: {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="mb-4 mt-10 text-3xl font-black leading-tight tracking-[-0.03em] text-text-primary">
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="mb-3 mt-8 text-2xl font-black leading-tight tracking-[-0.025em] text-text-primary">
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="mb-2 mt-6 text-xl font-bold text-text-primary">{children}</h3>
    ),
    normal: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-4 leading-7 text-[color:var(--muted)]">{children}</p>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="my-6 border-l-2 border-[rgba(245,181,72,0.5)] pl-5 italic text-[color:var(--muted)]">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <ul className="mb-4 ml-5 list-disc space-y-1.5 text-[color:var(--muted)]">{children}</ul>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <ol className="mb-4 ml-5 list-decimal space-y-1.5 text-[color:var(--muted)]">{children}</ol>
    ),
  },
  marks: {
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-bold text-text-primary">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => (
      <em className="italic">{children}</em>
    ),
    link: ({ value, children }: { value?: { href?: string }; children?: React.ReactNode }) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[color:var(--accent)] underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    ),
  },
};

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  let article;
  try {
    article = await getArticle(slug);
  } catch {
    notFound();
  }
  if (!article) notFound();

  return (
    <main className="text-[color:var(--fg)]">
      {/* ── Nav ── */}
      <nav className="border-b border-[color:var(--border)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="font-black tracking-[-0.04em] text-text-primary">
            VLTD
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/learn/articles"
              className="rounded-full px-5 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
            >
              ← Articles
            </Link>
            <Link
              href="/signup"
              className="rounded-full px-5 py-2 text-sm font-bold transition"
              style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}
            >
              Get started — free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero image ── */}
      {article.heroImage && (
        <div className="aspect-[2.4/1] w-full overflow-hidden bg-[color:var(--surface)]">
          <Image
            src={urlFor(article.heroImage)}
            alt={article.title}
            width={1200}
            height={500}
            priority
            className="h-full w-full object-cover opacity-90"
          />
        </div>
      )}

      {/* ── Article content ── */}
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        {article.category && (
          <span className="inline-flex items-center rounded-full border border-[rgba(245,181,72,0.28)] px-3 py-1 text-xs font-semibold text-[color:var(--accent)]">
            {article.category}
          </span>
        )}
        <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-[-0.04em] text-text-primary sm:text-5xl">
          {article.title}
        </h1>
        {article.excerpt && (
          <p className="mt-4 text-lg leading-8 text-[color:var(--muted)]">{article.excerpt}</p>
        )}
        {article.publishedAt && (
          <div className="mt-4 text-sm text-[color:var(--muted2)]">
            {formatDate(article.publishedAt)}
          </div>
        )}

        <div className="mt-10 border-t border-[color:var(--border)] pt-10 text-base">
          {article.body ? (
            <PortableText value={article.body} components={portableComponents} />
          ) : (
            <p className="text-[color:var(--muted)]">No content yet.</p>
          )}
        </div>

        {/* ── CTA ── */}
        <div className="mt-14 rounded-[22px] border border-[rgba(245,181,72,0.2)] bg-vault-card p-8 text-center" style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
          <div className="text-xl font-black text-text-primary">Start vaulting your collection.</div>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            VLTD is free to start — AI scanning, public galleries, and portfolio tracking included.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex min-h-11 items-center justify-center rounded-full px-7 text-sm font-bold"
              style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}
            >
              Create your vault — free
            </Link>
            <Link
              href="/learn/articles"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--border)] px-7 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
            >
              More articles
            </Link>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-[color:var(--border)] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-[color:var(--muted2)] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-black tracking-[-0.04em] text-text-primary">VLTD</span>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-text-primary">Log in</Link>
            <Link href="/signup" className="hover:text-text-primary">Sign up</Link>
            <Link href="/learn" className="hover:text-text-primary">Guide</Link>
            <Link href="/learn/articles" className="hover:text-text-primary">Articles</Link>
          </div>
          <div className="italic">© 2026 VLTD. Pronounced "Vaulted."</div>
        </div>
      </footer>
    </main>
  );
}
