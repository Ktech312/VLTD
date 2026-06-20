"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import CameraCapturePanel from "@/components/CameraCapturePanel";
import CaptureCamera from "@/components/CaptureCamera";
import { analyzeImageWithVision, type VisionAnalysisResult } from "@/lib/ai/openaiVision";
import { scanBarcodeFromFile } from "@/lib/scanners/barcodeScanner";
import { lookupUpcItem } from "@/lib/upcLookup";
import { newId } from "@/lib/id";
import { appendItems, type VaultImage } from "@/lib/vaultModel";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import { hasSupabaseEnv, uploadVaultImageToSupabase } from "@/lib/vaultCloud";
import {
  generateVaultImageKey,
  prepareImageBlob,
  saveImageBlobToIndexedDb,
} from "@/lib/vaultImageStore";
import {
  getUniverses,
  getCategories,
  getSubcategories,
  UNIVERSE_LABEL,
  isUniverseKey,
  type UniverseKey,
} from "@/lib/taxonomy";

/* ── Types ─────────────────────────────────────────────────────── */

type Phase = "idle" | "loading" | "review" | "error";

const UNIVERSES = getUniverses();

type ReviewFields = {
  title: string;
  subtitle: string;
  category: string;
  universe: string;
  grade: string;
  certNumber: string;
  condition: string;
  description: string;
  number: string;
  categoryLabel: string;
  subcategoryLabel: string;
  confidence: number;
};

const EMPTY_FIELDS: ReviewFields = {
  title: "",
  subtitle: "",
  category: "",
  universe: "",
  grade: "",
  certNumber: "",
  condition: "",
  description: "",
  number: "",
  categoryLabel: "",
  subcategoryLabel: "",
  confidence: 0.45,
};

/* ── Helpers ────────────────────────────────────────────────────── */

function confidenceBadge(c: number) {
  if (c >= 0.75) return { bg: "rgba(34,197,94,0.15)", color: "#22C55E", label: "High confidence" };
  if (c >= 0.45) return { bg: "rgba(245,181,72,0.15)", color: "#F5B548", label: "Medium confidence" };
  return { bg: "rgba(239,68,68,0.15)", color: "#EF4444", label: "Low confidence" };
}

function mergeResults(
  vision: VisionAnalysisResult | null,
  upc: Awaited<ReturnType<typeof lookupUpcItem>> | null
): ReviewFields {
  return {
    title: vision?.title || upc?.title || "",
    subtitle: vision?.subtitle || upc?.subtitle || "",
    category: vision?.category || upc?.categoryLabel || "",
    universe: vision?.universe || upc?.universe || "",
    grade: vision?.grade || "",
    certNumber: vision?.certNumber || "",
    condition: vision?.condition || "",
    description: vision?.description || upc?.notes || "",
    number: vision?.number || "",
    categoryLabel: vision?.categoryLabel || upc?.categoryLabel || "",
    subcategoryLabel: vision?.subcategoryLabel || upc?.subcategoryLabel || "",
    confidence: vision?.confidence ?? 0.45,
  };
}

async function persistCapturedImage(itemId: string, file: File) {
  const durableBlob = await prepareImageBlob(file);
  const fileName = file.name || "capture.jpg";

  if (navigator.onLine && hasSupabaseEnv()) {
    try {
      const uploaded = await uploadVaultImageToSupabase({
        itemId,
        file: durableBlob,
        fileName,
      });

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
      console.error("[Capture] Supabase image upload failed, using local fallback:", error);
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

  return {
    images: [image],
    primaryImageKey: image.storageKey,
    imageFrontStoragePath: image.storageKey,
  };
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function CapturePage() {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fields, setFields] = useState<ReviewFields>(EMPTY_FIELDS);
  const [capturedImageFile, setCapturedImageFile] = useState<File | null>(null);
  const [isCameraPanelOpen, setIsCameraPanelOpen] = useState(true);

  /* ── AI flow triggered by photo capture ── */
  const handleCapture = useCallback(async (file: File) => {
    setCapturedImageFile(file);
    setIsCameraPanelOpen(false);
    setPhase("loading");
    setErrorMsg("");

    try {
      // Run vision analysis and barcode scan in parallel
      const [visionSettled, barcodeSettled] = await Promise.allSettled([
        analyzeImageWithVision(file),
        scanBarcodeFromFile(file),
      ]);

      const vision = visionSettled.status === "fulfilled" ? visionSettled.value : null;
      if (visionSettled.status === "rejected") {
        console.error("[Capture] Vision error:", visionSettled.reason);
      }

      // UPC lookup if a barcode was detected
      let upcData: Awaited<ReturnType<typeof lookupUpcItem>> | null = null;
      const barcodeRaw =
        barcodeSettled.status === "fulfilled" ? barcodeSettled.value?.rawValue : null;

      // Also check if AI returned a barcode directly
      const barcodeCode =
        barcodeRaw ||
        (vision?.barcode && vision.barcode.length > 0 ? vision.barcode : null);

      if (barcodeCode) {
        try {
          upcData = await lookupUpcItem(barcodeCode);
        } catch (upcErr) {
          console.error("[Capture] UPC lookup error:", upcErr);
        }
      }

      if (!vision && !upcData) {
        // Both failed completely — show error
        throw new Error("Could not identify item. Please fill in details manually.");
      }

      setFields(mergeResults(vision, upcData));
      setPhase("review");
    } catch (err) {
      console.error("[Capture] Error:", err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not identify item. Please fill in details manually."
      );
      setPhase("error");
    }
  }, []);

  /* ── Save to vault ── */
  const handleSave = useCallback(async () => {
    try {
      const id = newId();
      const imagePatch = capturedImageFile
        ? await persistCapturedImage(id, capturedImageFile)
        : {};

      const item = {
        id,
        title: fields.title.trim() || "Untitled Item",
        subtitle: fields.subtitle || undefined,
        category: fields.category || undefined,
        universe: fields.universe || undefined,
        grade: fields.grade || undefined,
        certNumber: fields.certNumber || undefined,
        notes: fields.description || undefined,
        number: fields.number || undefined,
        categoryLabel: fields.categoryLabel || undefined,
        subcategoryLabel: fields.subcategoryLabel || undefined,
        status: "COLLECTION" as const,
        createdAt: Date.now(),
        ...imagePatch,
      };
      await appendItems([item]);
      emitVaultUpdate();
      router.push("/vault");
    } catch (err) {
      console.error("[Capture] Save error:", err);
    }
  }, [capturedImageFile, fields, router]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showExtraFields, setShowExtraFields] = useState(false);

  /* ── Bulk capture ── */
  const handleBulkCapture = useCallback(async (file: File, categoryLabel: string, subcategoryLabel: string) => {
    try {
      const id = newId();
      const imagePatch = await persistCapturedImage(id, file);
      const item = {
        id,
        title: "Bulk Item",
        categoryLabel: categoryLabel || undefined,
        subcategoryLabel: subcategoryLabel || undefined,
        status: "COLLECTION" as const,
        createdAt: Date.now(),
        bulkPending: true,
        ...imagePatch,
      };
      await appendItems([item]);
      emitVaultUpdate();
    } catch (err) {
      console.error("[Bulk Capture] Save error:", err);
    }
  }, []);

  const universeKey = isUniverseKey(fields.universe) ? fields.universe as UniverseKey : null;
  const categoryOptions = universeKey ? getCategories(universeKey) : [];
  const subcategoryOptions = universeKey && fields.categoryLabel
    ? getSubcategories(universeKey, fields.categoryLabel)
    : [];

  const badge = confidenceBadge(fields.confidence);

  /* ── Render ── */
  return (
    <main className="min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section
          className="relative overflow-hidden rounded-[34px] p-5 sm:p-7"
          style={{
            background: "var(--theme-elevated, rgba(20,32,55,0.9))",
            border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.25))",
            boxShadow: "0 26px 86px rgba(0,0,0,0.32)",
          }}
        >
          {/* ambient glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 20% 0%, var(--theme-gold-subtle, rgba(245,181,72,0.06)), transparent 30%)",
            }}
          />

          {/* ── Two-column layout: info + camera ── */}
          <div
            className={`relative flex flex-col gap-5 lg:gap-7 ${
              phase === "idle" || phase === "loading"
                ? "lg:grid lg:grid-cols-[1fr_360px] lg:items-start"
                : ""
            }`}
          >
            {/* Left: header + state-specific content */}
            <div className="order-2 lg:order-none">
              <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)]">
                Smart Scan
              </div>
              <h1 className="mt-2 text-2xl font-black leading-tight tracking-[-0.04em] text-text-primary lg:mt-3 lg:text-4xl lg:leading-[0.98] lg:tracking-[-0.055em] lg:text-5xl">
                Add an item to your VLTD vault.
              </h1>
              <p className="mt-3 hidden max-w-2xl text-base leading-7 text-[color:var(--muted)] lg:block">
                Capture the item first. VLTD will use the image as the starting point for item
                identification, valuation, and record building.
              </p>

              {/* ── IDLE: steps + nav links ── */}
              {phase === "idle" && (
                <>
                  <div className="mt-4 hidden gap-3 lg:mt-6 lg:grid lg:grid-cols-3">
                    {[
                      { n: "1", title: "Capture", desc: "Use camera or upload a photo." },
                      { n: "2", title: "Identify", desc: "Confirm title, category, and universe." },
                      { n: "3", title: "Vault", desc: "Save it with value and notes." },
                    ].map(({ n, title, desc }) => (
                      <div
                        key={n}
                        className="rounded-2xl border border-[color:var(--border)] bg-vault-card p-4"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">
                          {n}
                        </div>
                        <div className="mt-2 text-sm font-black text-text-primary">{title}</div>
                        <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{desc}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 lg:mt-6 lg:gap-3">
                    <Link
                      href="/vault/quick"
                      className="inline-flex min-h-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-vault-card px-4 text-xs font-semibold text-[color:var(--muted)] transition hover:text-text-primary lg:min-h-11 lg:px-5 lg:text-sm"
                    >
                      Quick Add instead
                    </Link>
                    <Link
                      href="/vault/add"
                      className="inline-flex min-h-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-vault-card px-4 text-xs font-semibold text-[color:var(--muted)] transition hover:text-text-primary lg:min-h-11 lg:px-5 lg:text-sm"
                    >
                      Manual Add
                    </Link>
                  </div>
                </>
              )}

              {/* ── LOADING state ── */}
              {phase === "loading" && (
                <div className="mt-8 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-3 w-3 animate-pulse rounded-full"
                      style={{
                        background: "var(--theme-gold, #F5B548)",
                        boxShadow: "0 0 14px rgba(245,181,72,0.6)",
                      }}
                    />
                    <span className="text-base font-black text-text-primary">
                      Identifying your item…
                    </span>
                  </div>
                  <p className="text-sm text-[color:var(--muted)]">
                    Running AI vision analysis and barcode scan. This takes a few seconds.
                  </p>
                </div>
              )}

              {/* ── ERROR state ── */}
              {phase === "error" && (
                <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-vault-card p-5">
                  <p className="text-sm font-black text-[#EF4444]">
                    Could not identify item automatically.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                    {errorMsg || "The image may be unclear or the item is unrecognized."}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setPhase("idle")}
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-vault-card px-5 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
                    >
                      ← Try again
                    </button>
                    <Link
                      href="/vault/add"
                      className="inline-flex min-h-10 items-center justify-center rounded-full px-5 text-sm font-black text-[#0B0B0B]"
                      style={{
                        background: "var(--theme-gold-gradient)",
                        boxShadow: "var(--theme-gold-glow)",
                      }}
                    >
                      Fill in manually
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Right: camera (idle) or analyzing preview (loading) */}
            {phase === "idle" && (
              <div className="order-first lg:order-none">
                <CaptureCamera
                  onCapture={handleCapture}
                  onOpenCamera={() => setIsCameraPanelOpen(true)}
                />
              </div>
            )}
            {phase === "loading" && (
              <div className="order-first lg:order-none">
                <div
                  className="relative flex min-h-[260px] w-full flex-col items-center justify-center overflow-hidden rounded-[30px] border"
                  style={{
                    borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))",
                    background: "radial-gradient(circle at 50% 30%, rgba(245,181,72,0.08), rgba(5,11,21,0.72) 70%)",
                  }}
                >
                  {capturedImageFile && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={URL.createObjectURL(capturedImageFile)}
                      alt="Captured"
                      className="absolute inset-0 h-full w-full object-cover opacity-25"
                    />
                  )}
                  <div className="relative flex flex-col items-center gap-3 px-6 text-center">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full"
                      style={{
                        background: "rgba(245,181,72,0.12)",
                        border: "1px solid rgba(245,181,72,0.35)",
                      }}
                    >
                      <span
                        className="h-5 w-5 rounded-full border-[2.5px] border-transparent border-t-[#F5B548] animate-spin"
                        style={{ borderTopColor: "#F5B548", borderRightColor: "rgba(245,181,72,0.3)" }}
                      />
                    </div>
                    <div className="text-base font-black text-text-primary">Analyzing…</div>
                    <div className="text-xs text-[color:var(--muted)]">Running vision + barcode scan</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── REVIEW panel — full width below the grid ── */}
          {phase === "review" && (
            <div
              className="relative mt-6 rounded-[26px] border p-5 sm:p-6"
              style={{
                borderColor: "var(--theme-gold-border, rgba(245,181,72,0.25))",
                background: "var(--theme-card, rgba(15,25,45,0.85))",
              }}
            >
              {/* Header row with confidence badge */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted2)]">
                  AI Identification — Review &amp; Edit
                </div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: badge.color }} />
                  {badge.label}
                </span>
              </div>

              {/* ── Core fields: Title + Universe ── */}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Title</label>
                  <input
                    className="mt-1 w-full rounded-xl border bg-vault-card px-3 py-2 text-sm font-semibold text-text-primary outline-none transition focus:border-[color:var(--theme-gold-border)]"
                    style={{ borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}
                    value={fields.title}
                    onChange={(e) => setFields((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Item title"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Universe</label>
                  <select
                    className="mt-1 w-full rounded-xl border bg-vault-card px-3 py-2 text-sm font-semibold text-text-primary outline-none transition focus:border-[color:var(--theme-gold-border)]"
                    style={{ borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}
                    value={fields.universe}
                    onChange={(e) => {
                      const u = e.target.value as UniverseKey;
                      const cats = getCategories(u);
                      setFields((prev) => ({ ...prev, universe: u, categoryLabel: cats[0] ?? "", subcategoryLabel: "" }));
                    }}
                  >
                    <option value="">— Select —</option>
                    {UNIVERSES.map((u) => (
                      <option key={u} value={u}>{UNIVERSE_LABEL[u]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Category + Subcategory ── */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Category</label>
                  <select
                    className="mt-1 w-full rounded-xl border bg-vault-card px-3 py-2 text-sm font-semibold text-text-primary outline-none transition focus:border-[color:var(--theme-gold-border)]"
                    style={{ borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}
                    value={fields.categoryLabel}
                    onChange={(e) => {
                      const cat = e.target.value;
                      const subs = universeKey ? getSubcategories(universeKey, cat) : [];
                      setFields((prev) => ({ ...prev, categoryLabel: cat, subcategoryLabel: subs[0] ?? "" }));
                    }}
                    disabled={!universeKey}
                  >
                    <option value="">— Select Category —</option>
                    {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Subcategory</label>
                  <select
                    className="mt-1 w-full rounded-xl border bg-vault-card px-3 py-2 text-sm font-semibold text-text-primary outline-none transition focus:border-[color:var(--theme-gold-border)]"
                    style={{ borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}
                    value={fields.subcategoryLabel}
                    onChange={(e) => setFields((prev) => ({ ...prev, subcategoryLabel: e.target.value }))}
                    disabled={subcategoryOptions.length === 0}
                  >
                    <option value="">— Select Subcategory —</option>
                    {subcategoryOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Advanced toggle ── */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)] transition hover:text-[color:var(--muted)]"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                  {showAdvanced ? "Hide" : "Show"} Advanced Fields
                </button>

                {showAdvanced && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["Grade", "grade"],
                        ["Cert Number", "certNumber"],
                        ["Condition", "condition"],
                      ] as [string, keyof ReviewFields][]
                    ).map(([label, key]) => (
                      <div key={key}>
                        <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">{label}</label>
                        <input
                          className="mt-1 w-full rounded-xl border bg-vault-card px-3 py-2 text-sm font-semibold text-text-primary outline-none transition focus:border-[color:var(--theme-gold-border)]"
                          style={{ borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}
                          value={String(fields[key] ?? "")}
                          onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={`Enter ${label.toLowerCase()}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Inline expand: Extra Fields (#21 fix) ── */}
              {showExtraFields && (
                <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.15))" }}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)] mb-3">More Fields</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["Subtitle", "subtitle"],
                        ["Number / Edition", "number"],
                      ] as [string, keyof ReviewFields][]
                    ).map(([label, key]) => (
                      <div key={key}>
                        <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">{label}</label>
                        <input
                          className="mt-1 w-full rounded-xl border bg-vault-card px-3 py-2 text-sm font-semibold text-text-primary outline-none transition focus:border-[color:var(--theme-gold-border)]"
                          style={{ borderColor: "var(--theme-border, rgba(245,181,72,0.12))" }}
                          value={String(fields[key] ?? "")}
                          onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={`Enter ${label.toLowerCase()}`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">Description / Notes</label>
                    <textarea
                      className="mt-1 w-full rounded-xl border bg-vault-card px-3 py-2 text-sm text-text-primary outline-none transition focus:border-[color:var(--theme-gold-border)]"
                      style={{ borderColor: "var(--theme-border, rgba(245,181,72,0.12))", minHeight: 72, resize: "vertical" }}
                      value={fields.description}
                      onChange={(e) => setFields((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Add notes about this item"
                    />
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-black text-[#0B0B0B]"
                  style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)" }}
                >
                  Save to Vault
                </button>
                <button
                  type="button"
                  onClick={() => setShowExtraFields((v) => !v)}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-[color:var(--border)] bg-vault-card px-6 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
                >
                  {showExtraFields ? "Less Fields" : "Edit More Fields"}
                </button>
                <button
                  type="button"
                  onClick={() => setPhase("idle")}
                  className="inline-flex min-h-12 items-center justify-center rounded-full px-4 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
                >
                  ← Rescan
                </button>
              </div>
            </div>
          )}
        </section>

        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void handleCapture(file);
          }}
        />

        {isCameraPanelOpen ? (
          <CameraCapturePanel
            title="Capture Item Photo"
            description="Use the guided camera to frame, crop, and improve this item before Smart Scan identifies it."
            universe={fields.universe}
            onCapture={handleCapture}
            onBulkCapture={handleBulkCapture}
            onClose={() => setIsCameraPanelOpen(false)}
            onUseFileInstead={() => {
              setIsCameraPanelOpen(false);
              uploadInputRef.current?.click();
            }}
          />
        ) : null}
      </div>
    </main>
  );
}
