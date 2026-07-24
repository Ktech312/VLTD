"use client";

// Bulk photo upload — Path B (upload a bundle of saved images).
//
// Flow: pick photos → choose ONE Universe for the whole batch → optionally let
// the AI fill in details (metered by the bulk-scan quota) → review grid where
// the user fixes anything wrong → "Add all to Vault".
//
// Adding photos and typing by hand is always free; only AI identify is counted.
// Path A (camera rapid-capture) will reuse this same review grid later.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import CameraCapturePanel from "@/components/CameraCapturePanel";
import { analyzeImageWithVision, type VisionAnalysisResult } from "@/lib/ai/openaiVision";
import { resolveVisionTaxonomy } from "@/lib/visionTaxonomy";
import { newId } from "@/lib/id";
import { appendItems, type VaultImage, type VaultItem } from "@/lib/vaultModel";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import { hasSupabaseEnv, uploadVaultImageToSupabase } from "@/lib/vaultCloud";
import {
  generateVaultImageKey,
  prepareImageBlob,
  saveImageBlobToIndexedDb,
} from "@/lib/vaultImageStore";
import { getStoredActiveProfileId } from "@/lib/auth";
import { getBulkScanStatus, consumeBulkScans } from "@/lib/bulkScanQuota";
import {
  getUniverses,
  getCategories,
  getSubcategories,
  UNIVERSE_LABEL,
  isUniverseKey,
  type UniverseKey,
} from "@/lib/taxonomy";

/* ── Types ─────────────────────────────────────────────────────── */

type Phase = "pick" | "scanning" | "review";

type BulkDraft = {
  id: string;
  file: File;
  previewUrl: string;
  title: string;
  categoryLabel: string;
  subcategoryLabel: string;
  currentValue: string;
  scanned: boolean;
  confidence: number;
};

const UNIVERSES = getUniverses();
const MAX_FILES = 60;

/* ── Shared styles ─────────────────────────────────────────────── */

const LABEL_CLS = "text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted2)]";
const INPUT_CLS =
  "mt-1 w-full rounded-xl border bg-vault-card px-3 py-2 text-sm font-semibold text-text-primary outline-none transition focus:border-[color:var(--theme-gold-border)]";
const INPUT_STYLE = { borderColor: "var(--theme-border, rgba(245,181,72,0.12))" } as const;

/* ── Image persistence (mirrors the single-item capture flow) ──── */

async function persistBulkImage(itemId: string, file: File): Promise<Partial<VaultItem>> {
  const durableBlob = await prepareImageBlob(file);
  const fileName = file.name || "upload.jpg";

  if (navigator.onLine && hasSupabaseEnv()) {
    try {
      const uploaded = await uploadVaultImageToSupabase({ itemId, file: durableBlob, fileName });
      const image: VaultImage = {
        id: `${itemId}_img_0`,
        storageKey: uploaded.path,
        url: uploaded.publicUrl,
        order: 0,
        localOnly: false,
        role: "primary",
      };
      return {
        images: [image],
        primaryImageKey: image.storageKey,
        imageFrontUrl: image.url,
        imageFrontStoragePath: image.storageKey,
      };
    } catch (error) {
      console.error("[Bulk] Supabase image upload failed, using local fallback:", error);
    }
  }

  const storageKey = generateVaultImageKey(itemId, 0);
  await saveImageBlobToIndexedDb(durableBlob, storageKey);
  const image: VaultImage = {
    id: `${itemId}_img_0`,
    storageKey,
    order: 0,
    localOnly: true,
    role: "primary",
  };
  return { images: [image], primaryImageKey: image.storageKey, imageFrontStoragePath: image.storageKey };
}

/* ── Map an AI vision result onto a draft, constrained to the batch Universe ─ */
function visionToDraftPatch(vision: VisionAnalysisResult, universe: UniverseKey): Partial<BulkDraft> {
  const validCats = getCategories(universe);
  const taxo = resolveVisionTaxonomy({
    universe,
    category: vision.categoryLabel || vision.category || "",
    subcategory: vision.subcategoryLabel || "",
  });
  // Keep the batch's chosen Universe; only accept AI category/sub if valid there.
  const categoryLabel = validCats.includes(taxo.categoryLabel) ? taxo.categoryLabel : "";
  const subs = categoryLabel ? getSubcategories(universe, categoryLabel) : [];
  const subcategoryLabel = subs.includes(taxo.subcategoryLabel) ? taxo.subcategoryLabel : "";
  return {
    title: vision.title || "",
    categoryLabel,
    subcategoryLabel,
    currentValue: vision.estimatedValue ? String(vision.estimatedValue) : "",
    scanned: true,
    confidence: vision.confidence ?? 0,
  };
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function BulkUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [phase, setPhase] = useState<Phase>("pick");
  const [universe, setUniverse] = useState<UniverseKey | "">("");
  const [drafts, setDrafts] = useState<BulkDraft[]>([]);
  const [status, setStatus] = useState("");
  const [committing, setCommitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Quota
  const [remaining, setRemaining] = useState<number | null>(null);
  const [scanLimit, setScanLimit] = useState<number | null>(null);
  const [profileId, setProfileId] = useState("");

  // Scanning progress
  const [scanDone, setScanDone] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);

  // Track object URLs so we can revoke them on unmount.
  const urlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => {
      for (const u of urlsRef.current) URL.revokeObjectURL(u);
    };
  }, []);

  // Load the user's remaining scans for the ticker.
  useEffect(() => {
    const pid = getStoredActiveProfileId();
    setProfileId(pid);
    if (!pid) return;
    void (async () => {
      const s = await getBulkScanStatus(pid);
      if (s) {
        setRemaining(s.remaining);
        setScanLimit(s.scanLimit);
      }
    })();
  }, []);

  const catOptions = universe && isUniverseKey(universe) ? getCategories(universe) : [];

  /* ── Add files (from the device picker or the camera) ── */
  const addFiles = useCallback((files: File[]) => {
    const picked = files.filter((f) => f.type.startsWith("image/")).slice(0, MAX_FILES);
    if (picked.length === 0) return;
    const next: BulkDraft[] = picked.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      urlsRef.current.push(previewUrl);
      return {
        id: newId(),
        file,
        previewUrl,
        title: "",
        categoryLabel: "",
        subcategoryLabel: "",
        currentValue: "",
        scanned: false,
        confidence: 0,
      };
    });
    setDrafts((prev) => [...prev, ...next]);
    setStatus("");
  }, []);

  const onFilesPicked = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      addFiles(Array.from(fileList));
    },
    [addFiles]
  );

  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const patchDraft = useCallback((id: string, patch: Partial<BulkDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  /* ── AI scan (metered) ── */
  const runScan = useCallback(async () => {
    if (!universe || !isUniverseKey(universe)) return;
    if (drafts.length === 0) return;

    setPhase("scanning");
    setScanDone(0);
    setScanTotal(drafts.length);

    let localRemaining = remaining ?? 0;

    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i];
      setScanDone(i);

      // Out of scans — leave this and the rest for manual entry.
      if (profileId && localRemaining <= 0) {
        setStatus("You've used all your AI scans for this cycle. The rest are ready to fill in by hand.");
        break;
      }

      try {
        const vision = await analyzeImageWithVision(draft.file, { universe });

        // Only charge the quota for a scan that actually produced a result.
        if (profileId) {
          const res = await consumeBulkScans(profileId, 1);
          if (res) {
            localRemaining = res.remaining;
            setRemaining(res.remaining);
            if (res.granted === 0) {
              // Server says the cycle is spent (e.g. another device used them).
              setStatus("You've used all your AI scans for this cycle. The rest are ready to fill in by hand.");
              break;
            }
          }
        }

        patchDraft(draft.id, visionToDraftPatch(vision, universe));
      } catch (err) {
        console.error("[Bulk] Scan failed for one image:", err);
        // Leave the draft as-is for manual entry.
      }
    }

    setScanDone(drafts.length);
    setPhase("review");
  }, [universe, drafts, remaining, profileId, patchDraft]);

  const skipToManual = useCallback(() => {
    if (!universe) return;
    setPhase("review");
  }, [universe]);

  /* ── Rescan a single card (metered) ── */
  const rescanOne = useCallback(
    async (draft: BulkDraft) => {
      if (!universe || !isUniverseKey(universe)) return;
      if (scanningId) return; // one at a time
      if (profileId && (remaining ?? 0) <= 0) {
        setStatus("No AI scans left this cycle — fill this one in by hand.");
        return;
      }
      setScanningId(draft.id);
      setStatus("");
      try {
        const vision = await analyzeImageWithVision(draft.file, { universe });
        if (profileId) {
          const res = await consumeBulkScans(profileId, 1);
          if (res) {
            setRemaining(res.remaining);
            if (res.granted === 0) {
              setStatus("No AI scans left this cycle — fill this one in by hand.");
              return;
            }
          }
        }
        patchDraft(draft.id, visionToDraftPatch(vision, universe));
      } catch (err) {
        console.error("[Bulk] Rescan failed:", err);
        setStatus("Couldn't identify that one — try again or fill it in by hand.");
      } finally {
        setScanningId(null);
      }
    },
    [universe, scanningId, profileId, remaining, patchDraft]
  );

  /* ── Commit ── */
  const addAllToVault = useCallback(async () => {
    if (drafts.length === 0 || !universe) return;
    setCommitting(true);
    setStatus("");
    try {
      const items: VaultItem[] = [];
      for (const d of drafts) {
        const id = newId();
        const imagePatch = await persistBulkImage(id, d.file);
        items.push({
          id,
          title: d.title.trim() || "Untitled Item",
          universe,
          categoryLabel: d.categoryLabel || undefined,
          subcategoryLabel: d.subcategoryLabel || undefined,
          currentValue: d.currentValue ? Number(d.currentValue) : undefined,
          status: "COLLECTION",
          createdAt: Date.now(),
          ...imagePatch,
        });
      }
      appendItems(items);
      emitVaultUpdate();
      router.push("/vault");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.startsWith("FREE_TIER_LIMIT:")) {
        router.push("/account/billing?reason=vault_limit");
        return;
      }
      console.error("[Bulk] Commit error:", err);
      setStatus("Something went wrong saving the batch. Please try again.");
      setCommitting(false);
    }
  }, [drafts, universe, router]);

  const scannedCount = drafts.filter((d) => d.scanned).length;

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <main className="px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)]">
              Bulk Upload
            </div>
            <h1 className="mt-1 text-2xl font-black leading-tight tracking-[-0.04em] text-text-primary lg:text-3xl">
              Add many at once
            </h1>
          </div>
          <Link
            href="/capture"
            className="text-xs font-semibold text-[color:var(--muted)] underline-offset-2 hover:text-text-primary hover:underline"
          >
            ← Add one item instead
          </Link>
        </div>

        {/* Ticker */}
        {profileId && remaining !== null && scanLimit !== null ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs ring-1 ring-[color:var(--border)]">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: remaining > 0 ? "#22C55E" : "#EF4444" }}
            />
            <span className="font-semibold text-text-primary">{remaining}</span>
            <span className="text-[color:var(--muted)]">of {scanLimit} AI scans left this cycle</span>
          </div>
        ) : null}

        {/* ── PICK ─────────────────────────────────────────────── */}
        {phase === "pick" && (
          <section className="mt-5 flex flex-col gap-5">
            {/* Step 1: Universe first (tip) */}
            <div
              className="rounded-2xl border p-4"
              style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.2))", background: "var(--theme-card, rgba(15,25,45,0.6))" }}
            >
              <label className={LABEL_CLS}>Step 1 — Pick the Universe for this batch</label>
              <select
                className={INPUT_CLS}
                style={INPUT_STYLE}
                value={universe}
                onChange={(e) => setUniverse(e.target.value as UniverseKey | "")}
              >
                <option value="">— Select —</option>
                {UNIVERSES.map((u) => (
                  <option key={u} value={u}>{UNIVERSE_LABEL[u]}</option>
                ))}
              </select>
              <p className="mt-2 text-[11px] leading-4 text-[color:var(--muted2)]">
                One batch = one Universe. Choosing it first makes the AI more accurate and saves you
                effort. Uploading a different Universe? Finish this batch, then start another.
              </p>
            </div>

            {/* Step 2: photos */}
            <div>
              <label className={LABEL_CLS}>Step 2 — Add your photos</label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!dragOver) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(Array.from(e.dataTransfer.files));
                }}
                className="mt-2 flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-sm text-[color:var(--muted)] transition hover:text-text-primary"
                style={{
                  borderColor: dragOver
                    ? "var(--theme-gold, #F5B548)"
                    : "var(--theme-gold-border, rgba(245,181,72,0.3))",
                  background: dragOver ? "var(--theme-gold-subtle, rgba(245,181,72,0.08))" : undefined,
                }}
              >
                <span className="text-2xl font-black text-[color:var(--theme-gold,#F5B548)]">+</span>
                <span className="font-semibold">
                  {dragOver
                    ? "Drop photos here"
                    : drafts.length > 0
                      ? "Add more photos"
                      : "Choose photos, or drag them here"}
                </span>
                <span className="text-[11px] text-[color:var(--muted2)]">Up to {MAX_FILES} at a time</span>
              </button>

              <div className="mt-2 flex items-center gap-3 text-xs text-[color:var(--muted2)]">
                <span className="uppercase tracking-[0.14em]">or</span>
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  className="font-semibold text-text-primary underline-offset-2 hover:underline"
                >
                  Use the camera — snap them one after another
                </button>
              </div>

              {drafts.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-2 text-xs text-[color:var(--muted)]">{drafts.length} photo{drafts.length === 1 ? "" : "s"} selected</div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                    {drafts.map((d) => (
                      <div
                        key={d.id}
                        className="group relative aspect-square overflow-hidden rounded-xl border"
                        style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.18))" }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={d.previewUrl} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeDraft(d.id)}
                          aria-label="Remove photo"
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Step 3: choose how to fill details */}
            {drafts.length > 0 ? (
              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.2))", background: "var(--theme-card, rgba(15,25,45,0.6))" }}
              >
                <label className={LABEL_CLS}>Step 3 — Fill in details</label>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!universe || (profileId !== "" && remaining === 0)}
                    onClick={() => void runScan()}
                    className="inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-black text-[#0B0B0B] disabled:opacity-40"
                    style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)" }}
                  >
                    Scan with AI to fill details
                  </button>
                  <button
                    type="button"
                    disabled={!universe}
                    onClick={skipToManual}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border px-6 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary disabled:opacity-40"
                    style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.3))" }}
                  >
                    Skip — I&apos;ll fill in by hand
                  </button>
                </div>
                {!universe ? (
                  <p className="mt-2 text-[11px] text-[#EF4444]">Pick a Universe above first.</p>
                ) : profileId && remaining === 0 ? (
                  <p className="mt-2 text-[11px] text-[color:var(--muted2)]">
                    No AI scans left this cycle — you can still add everything by hand.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        )}

        {/* ── SCANNING ─────────────────────────────────────────── */}
        {phase === "scanning" && (
          <section className="mt-8 flex flex-col items-center gap-4 py-10 text-center">
            <span
              className="h-8 w-8 rounded-full border-[3px] animate-spin"
              style={{ borderColor: "rgba(245,181,72,0.25)", borderTopColor: "#F5B548" }}
            />
            <div className="text-base font-black text-text-primary">
              Identifying {Math.min(scanDone + 1, scanTotal)} of {scanTotal}…
            </div>
            {profileId && remaining !== null ? (
              <div className="text-xs text-[color:var(--muted)]">{remaining} AI scans left this cycle</div>
            ) : null}
            <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-[color:var(--pill)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${scanTotal ? (scanDone / scanTotal) * 100 : 0}%`,
                  background: "var(--theme-gold-gradient, #F5B548)",
                }}
              />
            </div>
          </section>
        )}

        {/* ── REVIEW ───────────────────────────────────────────── */}
        {phase === "review" && (
          <section className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[color:var(--muted)]">
                <span className="font-black text-text-primary">{drafts.length}</span> item
                {drafts.length === 1 ? "" : "s"} · all filed under{" "}
                <span className="font-semibold text-text-primary">
                  {universe ? UNIVERSE_LABEL[universe as UniverseKey] : ""}
                </span>
                {scannedCount > 0 ? ` · ${scannedCount} AI-identified` : ""}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-[color:var(--muted)] underline-offset-2 hover:text-text-primary hover:underline"
              >
                + Add more photos
              </button>
            </div>

            <p className="mt-1 text-[11px] leading-4 text-[color:var(--muted2)]">
              Check each one and fix anything the AI got wrong — it can mislabel look-alikes. Blank
              names save as &ldquo;Untitled Item.&rdquo;
            </p>

            <div className="mt-4 grid gap-3">
              {drafts.map((d) => {
                const subOptions =
                  universe && isUniverseKey(universe) && d.categoryLabel
                    ? getSubcategories(universe, d.categoryLabel)
                    : [];
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-start gap-4 rounded-2xl border p-3 sm:flex-nowrap"
                    style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.18))", background: "var(--theme-card, rgba(15,25,45,0.5))" }}
                  >
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border" style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.18))" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.previewUrl} alt="" className="h-full w-full object-cover" />
                    </div>

                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className={LABEL_CLS}>Item name</label>
                        <input
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={d.title}
                          onChange={(e) => patchDraft(d.id, { title: e.target.value })}
                          placeholder="Untitled Item"
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Category</label>
                        <select
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={d.categoryLabel}
                          onChange={(e) => patchDraft(d.id, { categoryLabel: e.target.value, subcategoryLabel: "" })}
                        >
                          <option value="">— Select —</option>
                          {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Subcategory</label>
                        <select
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={d.subcategoryLabel}
                          onChange={(e) => patchDraft(d.id, { subcategoryLabel: e.target.value })}
                          disabled={subOptions.length === 0}
                        >
                          <option value="">— Select —</option>
                          {subOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Current value ($)</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={d.currentValue}
                          onChange={(e) => patchDraft(d.id, { currentValue: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <button
                          type="button"
                          disabled={scanningId !== null || (profileId !== "" && (remaining ?? 0) <= 0)}
                          onClick={() => void rescanOne(d)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--theme-gold,#F5B548)] underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline"
                        >
                          {scanningId === d.id ? (
                            <>
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Scanning…
                            </>
                          ) : d.scanned ? (
                            "Rescan"
                          ) : (
                            "Scan with AI"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDraft(d.id)}
                          className="text-xs font-semibold text-[color:var(--muted)] underline-offset-2 hover:text-[#EF4444] hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {drafts.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed p-6 text-center text-sm text-[color:var(--muted)]" style={{ borderColor: "var(--border)" }}>
                Nothing left in this batch. <Link href="/vault" className="underline">Back to Vault</Link>
              </div>
            ) : (
              <div className="sticky bottom-4 mt-5 flex flex-wrap items-center gap-3 rounded-2xl border p-3" style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.25))", background: "var(--theme-elevated, rgba(20,32,55,0.92))" }}>
                <button
                  type="button"
                  disabled={committing || scanningId !== null}
                  onClick={() => void addAllToVault()}
                  className="inline-flex min-h-12 items-center justify-center rounded-full px-7 text-sm font-black text-[#0B0B0B] disabled:opacity-50"
                  style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)" }}
                >
                  {committing ? "Adding…" : `Add all ${drafts.length} to Vault`}
                </button>
                <button
                  type="button"
                  disabled={committing}
                  onClick={() => setPhase("pick")}
                  className="inline-flex min-h-12 items-center justify-center rounded-full px-4 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
                >
                  ← Back
                </button>
              </div>
            )}
          </section>
        )}

        {status ? (
          <div className="mt-4 rounded-xl bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]">
            {status}
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            onFilesPicked(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />

        {cameraOpen ? (
          <CameraCapturePanel
            title="Bulk camera"
            description="Snap each item — no waiting. Tap Save after each and they collect below. Close when you're done, then choose how to fill in details."
            universe={universe || undefined}
            initialBulkMode
            bulkToggle={false}
            bulkTaxonomy={false}
            onCapture={() => {}}
            onBulkCapture={(file) => addFiles([file])}
            onClose={() => setCameraOpen(false)}
            onUseFileInstead={() => {
              setCameraOpen(false);
              fileInputRef.current?.click();
            }}
          />
        ) : null}
      </div>
    </main>
  );
}
