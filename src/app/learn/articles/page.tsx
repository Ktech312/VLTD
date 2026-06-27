import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getArticles } from "@/lib/sanity";
import { createImageUrlBuilder as imageUrlBuilder } from "@sanity/image-url";
import { client } from "@/lib/sanity";

export const metadata: Metadata = {
  title: "Collecting Articles & Guides — VLTD",
  description:
    "Expert guides, market news, and collecting tips across Pop Culture, Sports, TCG, Music, Games, and more.",
};

const builder = imageUrlBuilder(client);
function urlFor(source: object) {
  return builder.image(source).width(640).height(360).fit("crop").url();
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Article = {
  _id: string;
  title: string;
  slug: { current: string };
  category?: string;
  excerpt?: string;
  publishedAt?: string;
  heroImage?: object;
};

export default async function ArticlesPage() {
  let articles: Article[] = [];
  try {
    articles = await getArticles();
  } catch {
    // Sanity not yet configured — show empty state
  }

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
              href="/learn"
              className="rounded-full px-5 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
            >
              Guide
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
            >
              Log in
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

      {/* ── Hero ── */}
      <section className="border-b border-[color:var(--border)] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(245,181,72,0.28)] px-4 py-1.5 text-xs font-semibold text-[color:var(--accent)]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--theme-gold, #F5B548)" }} />
            Articles &amp; Guides
          </div>
          <h1 className="text-4xl font-black leading-[0.96] tracking-[-0.045em] text-text-primary sm:text-5xl">
            Collect smarter.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[color:var(--muted)]">
            Guides, market news, and tips from the VLTD team — covering every universe in your vault.
          </p>
        </div>
      </section>

      {/* ── Articles grid ── */}
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="mb-4 grid h-14 w-14 place-items-center rounded-[16px] text-2xl"
                style={{
                  background: "var(--theme-gold-subtle, rgba(245,181,72,0.08))",
                  border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.2))",
                }}
              >
                ✦
              </div>
              <div className="text-base font-semibold text-text-primary">No articles yet</div>
              <p className="mt-2 max-w-sm text-sm text-[color:var(--muted)]">
                Articles published in the VLTD Studio will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <Link
                  key={article._id}
                  href={`/learn/articles/${article.slug.current}`}
                  className="group rounded-[22px] border border-[color:var(--border)] bg-vault-card overflow-hidden transition hover:border-[rgba(245,181,72,0.4)]"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}
                >
                  {article.heroImage ? (
                    <div className="aspect-video w-full overflow-hidden bg-[color:var(--surface)]">
                      <Image
                        src={urlFor(article.heroImage)}
                        alt={article.title}
                        width={640}
                        height={360}
                        className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100 group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center bg-[color:var(--surface)] text-3xl text-[color:var(--muted2)]">
                      ✦
                    </div>
                  )}

                  <div className="p-5">
                    {article.category && (
                      <span className="inline-flex items-center rounded-full border border-[rgba(245,181,72,0.28)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
                        {article.category}
                      </span>
                    )}
                    <h2 className="mt-2 text-base font-black leading-snug text-text-primary group-hover:text-[color:var(--accent)] transition">
                      {article.title}
                    </h2>
                    {article.excerpt && (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[color:var(--muted)]">
                        {article.excerpt}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between text-xs text-[color:var(--muted2)]">
                      {article.publishedAt ? (
                        <span>{formatDate(article.publishedAt)}</span>
                      ) : (
                        <span />
                      )}
                      <span className="font-semibold text-[color:var(--accent)] transition group-hover:translate-x-0.5">
                        Read more →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

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
