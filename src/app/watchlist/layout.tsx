import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watchlist — VLTD",
  description: "Items on your watchlist",
};

export default function WatchlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
