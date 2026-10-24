"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { Glyph } from "@/components/ui/Glyph";
import { formatStoreDate } from "@/lib/comicUpcoming";
import { loadSharedWishlist, type SharedWish } from "@/lib/wishlistShare";

// Public, read-only view of a Curator's shared wishlist. Data comes only from
// get_shared_wishlist: title, cover, category, edition and status always; quantity, dates, price, shop and notes only
// when the owner switched them on. Target prices are never shared.
export default function SharedWishlistPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? "");
  const [state, setState] = useState<{ loading: boolean; owner: string | null; items: SharedWish[]; error?: string }>({
    loading: true,
    owner: null,
    items: [],
  });

  useEffect(() => {
    let active = true;
    void loadSharedWishlist(token).then((res) => {
      if (active) setState({ loading: false, ...res });
    });
    return () => {
      active = false;
    };
  }, [token]);

  const notFound = !state.loading && !state.owner;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <div className="mx-auto max-w-5xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--muted2)" }}>Wishlist</div>
        <h1 className="mt-1 text-2xl font-semibold">
          {state.loading ? "Loading…" : notFound ? "This wishlist isn't shared" : `${state.owner}'s wishlist`}
        </h1>
        {notFound ? (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>The link may have been turned off by its owner.</p>
        ) : null}

        {!state.loading && state.owner && state.items.length === 0 ? (
          <p className="mt-4 text-sm" style={{ color: "var(--muted)" }}>Nothing on this wishlist yet.</p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {state.items.map((item, i) => (
            <div key={`${item.title}-${i}`} className="overflow-hidden rounded-[12px] ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
              <div className="relative aspect-[2/3] w-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center" style={{ color: "var(--muted2)" }}>
                    <Glyph name="tag" size={22} />
                  </div>
                )}
                {item.status === "preordered" ? (
                  <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(0,0,0,0.7)", color: "#ECEDEF" }}>
                    Pre-ordered
                  </span>
                ) : null}
              </div>
              <div className="p-2.5">
                <div className="line-clamp-2 text-[13px] font-semibold leading-tight">{item.title}</div>
                <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
                  {[item.edition, item.category, item.quantity && item.quantity > 1 ? `x${item.quantity}` : null, item.releaseDate ? formatStoreDate(item.releaseDate) : item.releaseWindow ? item.releaseWindow : null, typeof item.price === "number" ? `$${item.price}` : null, item.shop].filter(Boolean).join(" · ")}
                </div>
                {item.notes ? <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>{item.notes}</div> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center text-[12px]" style={{ color: "var(--muted2)" }}>
          Shared from <Link href="/" style={{ color: "var(--theme-gold)" }}>VLTD</Link>
        </div>
      </div>
    </main>
  );
}
