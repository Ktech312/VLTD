"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import CameraCapturePanel from "@/components/CameraCapturePanel";
import { analyzeImageWithVision, type VisionAnalysisResult } from "@/lib/ai/openaiVision";
import { resolveVisionTaxonomy } from "@/lib/visionTaxonomy";
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
  storageLocation: string;
  currentValue: string;
  purchasePrice: string;
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
  storageLocation: "",
  currentValue: "",
  purchasePrice: "",
  confidence: 0.45,
};

/* ── Shared styles ─────────────────────────────────────────────── */

const LABEL_CLS =
  "text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]";
const INPUT_CLS =
  "mt-1 w-full rounded-xl border bg-vault-card px-3 py-2 text-sm font-semibold text-text-primary outline-none transition focus:border-[color:var(--theme-gold-border)]";
const INPUT_STYLE = { borderColor: "var(--theme-border, rgba(245,181,72,0.12))" } as const;

/* ── Accordion section ─────────────────────────────────────────── */

function AccordionSection({
  n,
  title,
  hint,
  open,
  onToggle,
  badge,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border"
      style={{
        borderColor: open
          ? "var(--theme-gold-border, rgba(245,181,72,0.35))"
          : "var(--theme-gold-border, rgba(245,181,72,0.16))",
        background: "var(--theme-card, rgba(15,25,45,0.6))",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
          style={{ border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.35))", color: "var(--theme-gold, #F5B548)" }}
        >
          {n}
        </span>
        <span className="shrink-0 text-[13px] font-black uppercase tracking-[0.14em] text-text-primary">
          {title}
        </span>
        {hint && !open ? (
          <span className="min-w-0 flex-1 truncate text-xs text-[color:var(--muted)]">{hint}</span>
        ) : (
          <span className="flex-1" />
        )}
        {badge}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={`shrink-0 text-[color:var(--muted2)] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          className="border-t px-4 py-4"
          style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.12))" }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

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
  // Map the AI's free-text classification onto valid taxonomy values so the
  // Universe / Category / Subcategory dropdowns auto-fill (user can override).
  const taxo = resolveVisionTaxonomy({
    universe: vision?.universe || upc?.universe || "",
    category: vision?.categoryLabel || vision?.category || upc?.categoryLabel || "",
    subcategory: vision?.subcategoryLabel || upc?.subcategoryLabel || "",
  });
  return {
    title: vision?.title || upc?.title || "",
    subtitle: vision?.subtitle || upc?.subtitle || "",
    category: taxo.categoryLabel || vision?.category || upc?.categoryLabel || "",
    universe: taxo.universe || "",
    grade: vision?.grade || "",
    certNumber: vision?.certNumber || "",
    condition: vision?.condition || "",
    description: vision?.description || upc?.notes || "",
    number: vision?.number || "",
    categoryLabel: taxo.categoryLabel || vision?.categoryLabel || upc?.categoryLabel || "",
    subcategoryLabel: taxo.subcategoryLabel || vision?.subcategoryLabel || upc?.subcategoryLabel || "",
    storageLocation: "",
    currentValue: "",
    purchasePrice: "",
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
  // The live camera is embedded inline on the Add screen (below), so it no
  // longer opens as a modal on load. The modal is only used on demand — e.g.
  // re-scanning a barcode from the review screen.
  const [isCameraPanelOpen, setIsCameraPanelOpen] = useState(false);

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
        condition: fields.condition || undefined,
        storageLocation: fields.storageLocation.trim() || undefined,
        currentValue: fields.currentValue ? Number(fields.currentValue) : undefined,
        purchasePrice: fields.purchasePrice ? Number(fields.purchasePrice) : undefined,
        status: "COLLECTION" as const,
        createdAt: Date.now(),
        ...imagePatch,
      };
      await appendItems([item]);
      emitVaultUpdate();
      router.push("/vault");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.startsWith("FREE_TIER_LIMIT:")) {
        // Redirect to billing with a toast-friendly message
        router.push("/account/billing?reason=vault_limit");
        return;
      }
      console.error("[Capture] Save error:", err);
    }
  }, [capturedImageFile, fields, router]);

  // Accordion open state — Identity open by default, like the record builder.
  const [openSections, setOpenSections] = useState<Set<number>>(() => new Set([1]));
  const toggleSection = useCallback((n: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }, []);

  // Object URL for the large preview in the review layout (revoked on change/unmount).
  const previewUrl = useMemo(
    () => (capturedImageFile ? URL.createObjectURL(capturedImageFile) : ""),
    [capturedImageFile]
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
    <main className="px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
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

          {/* ── Two-column layout: info + camera (capture states) ── */}
          {phase !== "review" && (
          <div
            className={`relative flex flex-col gap-5 lg:gap-7 ${
              phase === "idle" || phase === "loading"
                ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:items-start"
                : ""
            }`}
          >
            {/* Left: header + state-specific content */}
            <div className="order-2 lg:order-none">
              <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)]">
                Add Item
              </div>
              <h1 className="mt-2 text-2xl font-black leading-tight tracking-[-0.04em] text-text-primary lg:mt-3 lg:text-4xl lg:leading-[0.98] lg:tracking-[-0.055em] lg:text-5xl">
                Snap it. We&apos;ll do the rest.
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--muted)] lg:mt-3 lg:text-base">
                Point your camera at the item and snap — VLTD identifies it and fills in the details.
              </p>

              {/* ── IDLE: the express/pro alternatives, tucked ── */}
              {phase === "idle" && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--muted2)] lg:mt-6">
                  <span className="uppercase tracking-[0.14em]">Rather type it?</span>
                  <Link href="/vault/quick" className="font-semibold underline-offset-2 hover:text-text-primary hover:underline">
                    Quick Add
                  </Link>
                  <Link href="/vault/add" className="font-semibold underline-offset-2 hover:text-text-primary hover:underline">
                    Full manual entry
                  </Link>
                </div>
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
                <CameraCapturePanel
                  variant="inline"
                  title="Add Item"
                  description="Point at the item and snap. VLTD fills in the rest."
                  universe={fields.universe}
                  onCapture={handleCapture}
                  onBulkCapture={handleBulkCapture}
                  onClose={() => {}}
                  onUseFileInstead={() => uploadInputRef.current?.click()}
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
          )}

          {/* ── REVIEW: record-builder (image left, numbered accordion right) ── */}
          {phase === "review" && (
            <div className="relative">
              {/* Compact header + actions */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)]">
                    Add Item
                  </div>
                  <h1 className="mt-1 text-2xl font-black leading-tight tracking-[-0.04em] text-text-primary lg:text-3xl">
                    New Vault Item
                  </h1>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-sm font-black text-text-primary">Confirm details</div>
                  <div className="text-[11px] text-[color:var(--muted2)]">Check the fields below, then save.</div>
                </div>
              </div>

              {/* Corrections — secondary, only if the scan wasn't right */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[color:var(--muted2)]">
                <span className="uppercase tracking-[0.14em]">Not right?</span>
                <button type="button" onClick={() => setIsCameraPanelOpen(true)} className="font-semibold underline-offset-2 hover:text-text-primary hover:underline">Scan barcode</button>
                <button type="button" onClick={() => uploadInputRef.current?.click()} className="font-semibold underline-offset-2 hover:text-text-primary hover:underline">Replace photo</button>
                <button
                  type="button"
                  onClick={() => {
                    setFields(EMPTY_FIELDS);
                    setCapturedImageFile(null);
                    setPhase("idle");
                  }}
                  className="font-semibold underline-offset-2 hover:text-text-primary hover:underline"
                >
                  Start over
                </button>
              </div>

              {/* Two columns: preview | accordion */}
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr] lg:items-start">
                {/* Left: image preview */}
                <div>
                  <div
                    className="relative mx-auto flex aspect-[4/5] w-full max-w-[260px] items-center justify-center overflow-hidden rounded-[16px] border sm:max-w-none"
                    style={{
                      borderColor: "var(--theme-gold-border, rgba(245,181,72,0.25))",
                      background: "radial-gradient(circle at 50% 25%, rgba(245,181,72,0.06), rgba(5,11,21,0.65) 72%)",
                    }}
                  >
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl} alt="Captured item" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-sm text-[color:var(--muted)]">No image</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCameraPanelOpen(true)}
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-xs font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
                    style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.3))" }}
                  >
                    + Add photos
                  </button>
                  <p className="mt-2 text-[11px] leading-4 text-[color:var(--muted2)]">
                    Tip: good lighting and a straight-on angle produce the best identification.
                  </p>
                </div>

                {/* Right: numbered accordion */}
                <div className="flex flex-col gap-3">
                  {/* 1 — IDENTITY */}
                  <AccordionSection
                    n={1}
                    title="Identity"
                    hint={fields.title || "Name, cert, and grade"}
                    open={openSections.has(1)}
                    onToggle={() => toggleSection(1)}
                    badge={
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: badge.color }} />
                        {badge.label}
                      </span>
                    }
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className={LABEL_CLS}>Item Name *</label>
                        <input
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={fields.title}
                          onChange={(e) => setFields((p) => ({ ...p, title: e.target.value }))}
                          placeholder="Item name"
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Alternate Name</label>
                        <input
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={fields.subtitle}
                          onChange={(e) => setFields((p) => ({ ...p, subtitle: e.target.value }))}
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Number / Edition</label>
                        <input
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={fields.number}
                          onChange={(e) => setFields((p) => ({ ...p, number: e.target.value }))}
                          placeholder="e.g. #57"
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Certification #</label>
                        <input
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={fields.certNumber}
                          onChange={(e) => setFields((p) => ({ ...p, certNumber: e.target.value }))}
                          placeholder="Cert number"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={LABEL_CLS}>Grade</label>
                          <input
                            className={INPUT_CLS}
                            style={INPUT_STYLE}
                            value={fields.grade}
                            onChange={(e) => setFields((p) => ({ ...p, grade: e.target.value }))}
                            placeholder="9"
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLS}>Condition</label>
                          <input
                            className={INPUT_CLS}
                            style={INPUT_STYLE}
                            value={fields.condition}
                            onChange={(e) => setFields((p) => ({ ...p, condition: e.target.value }))}
                            placeholder="Mint"
                          />
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={LABEL_CLS}>Notes</label>
                        <textarea
                          className={INPUT_CLS}
                          style={{ ...INPUT_STYLE, minHeight: 68, resize: "vertical", fontWeight: 400 }}
                          value={fields.description}
                          onChange={(e) => setFields((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Add any details about this item…"
                        />
                      </div>
                    </div>
                  </AccordionSection>

                  {/* 2 — CATEGORY */}
                  <AccordionSection
                    n={2}
                    title="Category"
                    hint={
                      [fields.universe ? UNIVERSE_LABEL[fields.universe as UniverseKey] : "", fields.categoryLabel, fields.subcategoryLabel]
                        .filter(Boolean)
                        .join(" · ") || "Comics, Cards, Records, & more"
                    }
                    open={openSections.has(2)}
                    onToggle={() => toggleSection(2)}
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className={LABEL_CLS}>Universe</label>
                        <select
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={fields.universe}
                          onChange={(e) => {
                            const u = e.target.value as UniverseKey;
                            const cats = u ? getCategories(u) : [];
                            setFields((p) => ({ ...p, universe: u, categoryLabel: cats[0] ?? "", subcategoryLabel: "" }));
                          }}
                        >
                          <option value="">— Select —</option>
                          {UNIVERSES.map((u) => (
                            <option key={u} value={u}>{UNIVERSE_LABEL[u]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Category</label>
                        <select
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={fields.categoryLabel}
                          onChange={(e) => {
                            const cat = e.target.value;
                            const subs = universeKey ? getSubcategories(universeKey, cat) : [];
                            setFields((p) => ({ ...p, categoryLabel: cat, subcategoryLabel: subs[0] ?? "" }));
                          }}
                          disabled={!universeKey}
                        >
                          <option value="">— Select —</option>
                          {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Subcategory</label>
                        <select
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={fields.subcategoryLabel}
                          onChange={(e) => setFields((p) => ({ ...p, subcategoryLabel: e.target.value }))}
                          disabled={subcategoryOptions.length === 0}
                        >
                          <option value="">— Select —</option>
                          {subcategoryOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </AccordionSection>

                  {/* 3 — LOCATION */}
                  <AccordionSection
                    n={3}
                    title="Location"
                    hint={fields.storageLocation || "Where it is stored"}
                    open={openSections.has(3)}
                    onToggle={() => toggleSection(3)}
                  >
                    <label className={LABEL_CLS}>Storage location</label>
                    <input
                      className={INPUT_CLS}
                      style={INPUT_STYLE}
                      value={fields.storageLocation}
                      onChange={(e) => setFields((p) => ({ ...p, storageLocation: e.target.value }))}
                      placeholder="e.g. Box 12 · Shelf B"
                    />
                    <p className="mt-2 text-[11px] leading-4 text-[color:var(--muted2)]">
                      Note where this item lives so it&apos;s easy to find later.
                    </p>
                  </AccordionSection>

                  {/* 4 — VALUE */}
                  <AccordionSection
                    n={4}
                    title="Value"
                    hint={fields.currentValue ? `$${fields.currentValue}` : "Pricing and market insights"}
                    open={openSections.has(4)}
                    onToggle={() => toggleSection(4)}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={LABEL_CLS}>Current value ($)</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={fields.currentValue}
                          onChange={(e) => setFields((p) => ({ ...p, currentValue: e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Purchase price ($)</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={fields.purchasePrice}
                          onChange={(e) => setFields((p) => ({ ...p, purchasePrice: e.target.value }))}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-[color:var(--muted2)]">
                      Market comparables and value history arrive with the pricing engine — for now,
                      set your own estimate.
                    </p>
                  </AccordionSection>

                  {/* 5 — DOCUMENTS */}
                  <AccordionSection
                    n={5}
                    title="Documents"
                    hint="Certificates, receipts, and more"
                    open={openSections.has(5)}
                    onToggle={() => toggleSection(5)}
                  >
                    <p className="text-xs leading-5 text-[color:var(--muted)]">
                      After saving, open the item to attach certificates, receipts, and extra photos,
                      and to build its insurance packet.
                    </p>
                  </AccordionSection>

                  {/* Save row */}
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="inline-flex min-h-12 items-center justify-center rounded-full px-7 text-sm font-black text-[#0B0B0B]"
                      style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)" }}
                    >
                      Save to Vault
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
            title="Add Item"
            description="Point at the item and snap. VLTD fills in the rest."
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
