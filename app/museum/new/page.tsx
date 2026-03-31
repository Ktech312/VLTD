"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createGallery,
  loadGalleries,
  saveGalleries,
  type Gallery,
} from "@/lib/galleryModel";
import { getGalleryLimits } from "@/lib/galleryTier";
import { getTierSafe } from "@/lib/subscription";

function safeTrim(value: string) {
  return String(value ?? "").trim();
}

export default function NewMuseumGalleryPage() {
  const router = useRouter();

  const tier = getTierSafe();
  const limits = useMemo(() => getGalleryLimits(tier), [tier]);
  const existingGalleries = useMemo(() => loadGalleries(), []);
  const canCreate =
    limits.galleries === Infinity || existingGalleries.length < limits.galleries;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<Gallery["visibility"]>("PUBLIC");
  const [state, setState] = useState<Gallery["state"]>("ACTIVE");
  const [themePack, setThemePack] = useState<
    "classic" | "walnut" | "midnight" | "marble"
  >("classic");
  const [displayMode, setDisplayMode] = useState<"grid" | "shelf">("grid");
  const [guestViewMode, setGuestViewMode] = useState<"public" | "guest">("public");
  const [submitting, setSubmitting] = useState(false);

  const remaining =
    limits.galleries === Infinity
      ? Infinity
      : Math.max(0, limits.galleries - existingGalleries.length);

  async function handleCreate() {
    if (submitting) return;
    if (!canCreate) return;

    const cleanTitle = safeTrim(title);
    if (!cleanTitle) return;

    setSubmitting(true);

    try {
      const next = createGallery(cleanTitle);

      const updated: Gallery = {
        ...next,
        description: safeTrim(description),
        visibility,
        state,
        themePack,
        displayMode,
        guestViewMode,
        updatedAt: Date.now(),
      };

      saveGalleries([...existingGalleries, updated]);
      router.push(`/museum/${updated.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link
            href="/museum"
            className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
          >
            ← Back to Museum
          </Link>

          <Link
            href="/collector"
            className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
          >
            Collector Profile
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-5 shadow-[0_18px_54px_rgba(0,0,0,0.3)] sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),rgba(255,255,255,0)_28%),radial-gradient(circle_at_75%_0%,rgba(255,205,120,0.06),rgba(255,205,120,0)_22%)]" />

          <div className="relative">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              MUSEUM
            </div>

            <h1 className="mt-2 text-3xl font-semibold sm:text-[2.2rem]">
              Create Gallery
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
              Start a new curated gallery with your preferred visibility, theme pack,
              display mode, and guest view behavior. You can refine sections, items,
              notes, shelves, and sharing after creation.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  TIER
                </div>
                <div className="mt-2 text-2xl font-semibold">{tier}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Current subscription
                </div>
              </div>

              <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  CURRENT GALLERIES
                </div>
                <div className="mt-2 text-2xl font-semibold">{existingGalleries.length}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  In active profile
                </div>
              </div>

              <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  REMAINING
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {remaining === Infinity ? "∞" : remaining}
                </div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Available slots
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
            GALLERY SETUP
          </div>
          <h2 className="mt-2 text-xl font-semibold">Basic Information</h2>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Gallery Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hall of Grails"
                className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Write a short curatorial description for this gallery..."
                className="w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
              />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              ACCESS
            </div>
            <h2 className="mt-2 text-xl font-semibold">Visibility + State</h2>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Gallery["visibility"])}
                  className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
                >
                  <option value="PUBLIC">Public</option>
                  <option value="INVITE">Invite Only</option>
                  <option value="LOCKED">Locked</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">State</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value as Gallery["state"])}
                  className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="STORAGE">Storage</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              PRESENTATION
            </div>
            <h2 className="mt-2 text-xl font-semibold">Theme + Display</h2>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Theme Pack</label>
                <select
                  value={themePack}
                  onChange={(e) =>
                    setThemePack(
                      e.target.value as "classic" | "walnut" | "midnight" | "marble"
                    )
                  }
                  className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
                >
                  <option value="classic">Classic</option>
                  <option value="walnut">Walnut</option>
                  <option value="midnight">Midnight</option>
                  <option value="marble">Marble</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Display Mode</label>
                <select
                  value={displayMode}
                  onChange={(e) => setDisplayMode(e.target.value as "grid" | "shelf")}
                  className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
                >
                  <option value="grid">Grid</option>
                  <option value="shelf">Shelf</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Guest View Mode</label>
                <select
                  value={guestViewMode}
                  onChange={(e) => setGuestViewMode(e.target.value as "public" | "guest")}
                  className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
                >
                  <option value="public">Public</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
            CREATE
          </div>
          <h2 className="mt-2 text-xl font-semibold">Finish Setup</h2>

          {!canCreate ? (
            <div className="mt-4 rounded-[20px] bg-[color:var(--input)] p-4 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              You have reached your current gallery limit for this profile.
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate || !safeTrim(title) || submitting}
              className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Gallery"}
            </button>

            <Link
              href="/museum"
              className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
            >
              Cancel
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}