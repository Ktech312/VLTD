import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wishlist — VLTD",
  description: "Items on your watchlist",
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
