// Path: src/app/user/style/page.tsx
"use client";

import Link from "next/link";
import { ApplyStyleGallery } from "@/components/ApplyStyleGallery";

export default function UserStyleGalleryPage() {
  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-5 py-8 vltd-page-tight">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-xs tracking-widest text-[color:var(--muted2)]">USER</div>
            <h1 className="mt-2 text-4xl font-semibold">Style Gallery</h1>
            <div className="mt-2 text-sm text-[color:var(--muted)]">Try combinations fast. Keep what looks most premium.</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/user"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)] transition"
            >
              Back to Settings
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <ApplyStyleGallery />
        </div>
      </div>
    </main>
  );
}