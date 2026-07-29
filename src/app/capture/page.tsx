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
  certCompany: string;
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
  certCompany: "",
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
const INPUT_STYLE = { borderColor: "var(--theme-border, rgba(203,208,213,0.12))" } as const;
const SERIF = "var(--font-serif, 'Cormorant Garamond', Georgia, serif)";

const CERT_COMPANIES = ["PSA", "CGC", "BGS", "SGC", "CBCS", "WATA", "VGA", "Other"];
const CONDITIONS = ["Mint", "Near Mint", "Excellent", "Very Good", "Good", "Fair", "Poor"];

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
          ? "var(--theme-gold-border, rgba(203,208,213,0.35))"
          : "var(--theme-gold-border, rgba(203,208,213,0.16))",
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
          style={{ border: "1px solid var(--theme-gold-border, rgba(203,208,213,0.35))", color: "var(--theme-gold, #C8CDD2)" }}
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
          style={{ borderColor: "var(--theme-gold-border, rgba(203,208,213,0.12))" }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* ── Helpers ────────────────────────────────────────────────────── */

function ActionButton({ label, icon, onClick, disabled }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-[10px] border px-3.5 py-2 text-xs font-semibold text-text-primary transition hover:bg-[color:var(--theme-gold-subtle,rgba(203,208,213,0.08))] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      style={{ borderColor: "var(--theme-gold-border, rgba(203,208,213,0.28))" }}
    >
      <span style={{ color: "var(--theme-gold, #C8CDD2)" }}>{icon}</span>
      {label}
    </button>
  );
}

function confidenceBadge(c: number) {
  if (c >= 0.75) return { bg: "rgba(84,201,138,0.10)", color: "#54C98A", glow: "0 0 14px rgba(84,201,138,0.30)", label: "High confidence" };
  if (c >= 0.45) return { bg: "rgba(203,208,213,0.10)", color: "#C8CDD2", glow: "0 0 12px rgba(203,208,213,0.28)", label: "Medium confidence" };
  return { bg: "rgba(224,82,82,0.10)", color: "#E05252", glow: "0 0 14px rgba(224,82,82,0.30)", label: "Low confidence" };
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
    certCompany: "",
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

  // Builder-first: the form + image panel is always shown. `analyzing` drives the
  // AI spinner; `phase` stays "review" so the legacy camera-first block never renders.
  const [phase, setPhase] = useState<Phase>("review");
  const [analyzing, setAnalyzing] = useState(false);
  // True only after an AI identify has actually run — gates the confidence badge.
  const [identified, setIdentified] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [fields, setFields] = useState<ReviewFields>(EMPTY_FIELDS);
  const [capturedImageFile, setCapturedImageFile] = useState<File | null>(null);
  // The live camera is embedded inline on the Add screen (below), so it no
  // longer opens as a modal on load. The modal is only used on demand — e.g.
  // re-scanning a barcode from the review screen.
  const [isCameraPanelOpen, setIsCameraPanelOpen] = useState(false);

  /* ── AI flow triggered by photo capture ── */
  // Capture-first: attach the photo instantly. AI identify is opt-in (the
  // "Identify with AI" / "Auto ID" buttons), so taking a photo never blocks
  // on the vision call or spends a scan you didn't ask for.
  const handleCapture = useCallback((file: File) => {
    setCapturedImageFile(file);
    setIsCameraPanelOpen(false);
    setErrorMsg("");
    setIdentified(false); // fresh photo, no AI result yet
  }, []);

  // Opt-in AI: identify + fill fields on demand from the captured photo.
  const runAiIdentify = useCallback(async (fileArg?: File) => {
    const file = fileArg ?? capturedImageFile;
    if (!file || analyzing) return;
    setAnalyzing(true);
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

      // Only fill fields the AI actually returned — never wipe what you typed.
      const merged = mergeResults(vision, upcData);
      setFields((prev) => {
        const next: ReviewFields = { ...prev };
        (Object.keys(merged) as (keyof ReviewFields)[]).forEach((k) => {
          const v = merged[k] as unknown;
          const has = typeof v === "string" ? v.trim() !== "" : v != null;
          if (has) (next as Record<string, unknown>)[k] = v;
        });
        return next;
      });
      setIdentified(true);
      setAnalyzing(false);
    } catch (err) {
      console.error("[Capture] Error:", err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Could not identify item. Please fill in details manually."
      );
      setAnalyzing(false);
    }
  }, [capturedImageFile, analyzing]);

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
        grade: [fields.certCompany, fields.grade].filter(Boolean).join(" ").trim() || undefined,
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

  const universeKey = isUniverseKey(fields.universe) ? fields.universe as UniverseKey : null;
  const categoryOptions = universeKey ? getCategories(universeKey) : [];
  const subcategoryOptions = universeKey && fields.categoryLabel
    ? getSubcategories(universeKey, fields.categoryLabel)
    : [];

  const badge = confidenceBadge(fields.confidence);

  /* ── Render ── */
  return (
    <main className="px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <section className="relative">

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

              {/* ── IDLE: bulk path + the express/pro alternatives, tucked ── */}
              {phase === "idle" && (
                <>
                  <Link
                    href="/vault/bulk"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-[color:var(--theme-gold-subtle,rgba(203,208,213,0.08))] lg:mt-6"
                    style={{ borderColor: "var(--theme-gold-border, rgba(203,208,213,0.3))" }}
                  >
                    <span className="text-sm font-black text-[color:var(--theme-gold,#C8CDD2)]">+</span>
                    Adding a lot? Bulk upload photos
                  </Link>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--muted2)]">
                    <span className="uppercase tracking-[0.14em]">Rather type it?</span>
                    <Link href="/vault/quick" className="font-semibold underline-offset-2 hover:text-text-primary hover:underline">
                      Quick Add
                    </Link>
                    <Link href="/vault/add" className="font-semibold underline-offset-2 hover:text-text-primary hover:underline">
                      Full manual entry
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
                        background: "var(--theme-gold, #C8CDD2)",
                        boxShadow: "0 0 14px rgba(203,208,213,0.6)",
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
                  bulkToggle={false}
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
                    borderColor: "var(--theme-gold-border, rgba(203,208,213,0.35))",
                    background: "radial-gradient(circle at 50% 30%, rgba(203,208,213,0.08), rgba(5,11,21,0.72) 70%)",
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
                        background: "rgba(203,208,213,0.12)",
                        border: "1px solid rgba(203,208,213,0.35)",
                      }}
                    >
                      <span
                        className="h-5 w-5 rounded-full border-[2.5px] border-transparent border-t-[#C8CDD2] animate-spin"
                        style={{ borderTopColor: "#C8CDD2", borderRightColor: "rgba(203,208,213,0.3)" }}
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
              {/* Header — concept-19 */}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-[34px] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-text-primary sm:text-[42px]">
                    New Vault Item
                  </h1>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    Capture, identify, and prepare your item for your private vault.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ActionButton
                    label="Scan Barcode"
                    onClick={() => setIsCameraPanelOpen(true)}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 5v14M7 5v14M11 5v14M14 5v14M18 5v14M21 5v14" /></svg>}
                  />
                  <ActionButton
                    label="Import"
                    onClick={() => uploadInputRef.current?.click()}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M8 8l4-4 4 4M4 20h16" /></svg>}
                  />
                  <ActionButton
                    label="Clear"
                    onClick={() => { setFields(EMPTY_FIELDS); setCapturedImageFile(null); setErrorMsg(""); setIdentified(false); }}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>}
                  />
                </div>
              </div>

              {/* Two columns: preview | accordion */}
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,480px)_1fr] lg:items-start">
                {/* Left: framed image viewer (concept-19) */}
                <div>
                  <div
                    className="relative overflow-hidden rounded-[16px] border"
                    style={{
                      borderColor: "var(--theme-gold-border, rgba(203,208,213,0.28))",
                      background: "radial-gradient(circle at 50% 22%, rgba(203,208,213,0.06), rgba(2,9,12,0.85) 72%)",
                    }}
                  >
                    <div className="flex aspect-[4/5] w-full items-center justify-center p-4">
                      {previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={previewUrl} alt="Captured item" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center gap-3.5 px-6 text-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(203,208,213,0.10)", border: "1px solid var(--theme-gold-border, rgba(203,208,213,0.3))", color: "var(--theme-gold, #C8CDD2)" }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                          </div>
                          <div className="text-sm font-semibold text-text-primary">Add a photo — optional</div>
                          <p className="max-w-[240px] text-xs leading-5 text-[color:var(--muted)]">Snap or upload one — then tap <b className="font-semibold text-[color:var(--fg)]">Identify with AI</b> to auto-fill, or just type the details in. No photo required.</p>
                          <div className="flex flex-wrap justify-center gap-2">
                            <button type="button" onClick={() => setIsCameraPanelOpen(true)} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-[#0B0B0B]" style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)" }}>Take photo</button>
                            <button type="button" onClick={() => uploadInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-[color:var(--theme-gold-subtle,rgba(203,208,213,0.08))]" style={{ borderColor: "var(--theme-gold-border, rgba(203,208,213,0.3))" }}>Upload</button>
                          </div>
                        </div>
                      )}
                    </div>
                    {previewUrl ? (
                      <>
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Expand image"
                          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-[8px] border"
                          style={{ borderColor: "var(--theme-gold-border, rgba(203,208,213,0.3))", background: "rgba(2,9,12,0.6)", color: "var(--theme-gold, #C8CDD2)" }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                        </a>
                        <span
                          className="absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{ background: "rgba(2,9,12,0.7)", color: "var(--muted)", border: "1px solid var(--theme-gold-border, rgba(203,208,213,0.2))" }}
                        >
                          1 / 1
                        </span>
                      </>
                    ) : null}
                    {analyzing ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: "rgba(2,9,12,0.74)" }}>
                        <span className="h-8 w-8 rounded-full border-[3px] animate-spin" style={{ borderColor: "rgba(203,208,213,0.25)", borderTopColor: "#C8CDD2" }} />
                        <span className="text-sm font-black text-text-primary">Identifying…</span>
                        <span className="text-xs text-[color:var(--muted)]">Running vision + barcode scan</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Opt-in AI identify — capture first, let AI fill it in after */}
                  {previewUrl && !analyzing ? (
                    <button
                      type="button"
                      onClick={() => void runAiIdentify()}
                      className="vltd-primary-button mt-3 w-full rounded-[6px] py-2.5 text-sm font-black"
                    >
                      Identify with AI
                    </button>
                  ) : null}

                  {/* Thumbnail rail */}
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {previewUrl ? (
                      <div className="aspect-square overflow-hidden rounded-[10px] border" style={{ borderColor: "var(--theme-gold-border, rgba(203,208,213,0.5))" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsCameraPanelOpen(true)}
                      className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[10px] border border-dashed text-center text-[10px] font-semibold leading-tight text-[color:var(--muted)] transition hover:text-text-primary"
                      style={{ borderColor: "var(--theme-gold-border, rgba(203,208,213,0.3))" }}
                    >
                      <span className="text-base" style={{ color: "var(--theme-gold, #C8CDD2)" }}>+</span>
                      Add photos<br />or video
                    </button>
                  </div>

                  <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-[color:var(--muted2)]">
                    <span className="mt-px shrink-0" style={{ color: "var(--theme-gold, #C8CDD2)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4z" /></svg>
                    </span>
                    <span><b className="font-semibold text-[color:var(--muted)]">Tip:</b> Use good lighting and avoid glare. Clear, straight-on photos work best.</span>
                  </p>
                  {errorMsg && !analyzing ? (
                    <p className="mt-2 text-[11px] leading-4 text-[#EF4444]">
                      {errorMsg} You can still fill it in by hand.
                    </p>
                  ) : null}
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
                    badge={identified ? (
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                        style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}`, boxShadow: badge.glow }}
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: badge.color }} />
                        {badge.label}
                      </span>
                    ) : null}
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
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
                        <label className={LABEL_CLS}>Set / Series</label>
                        <input
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={fields.number}
                          onChange={(e) => setFields((p) => ({ ...p, number: e.target.value }))}
                          placeholder="e.g. 1986 Fleer Basketball"
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Certification Company</label>
                        <select
                          className={INPUT_CLS}
                          style={INPUT_STYLE}
                          value={fields.certCompany}
                          onChange={(e) => setFields((p) => ({ ...p, certCompany: e.target.value }))}
                        >
                          <option value="">—</option>
                          {CERT_COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Certification #</label>
                        <div className="relative">
                          <input
                            className={INPUT_CLS}
                            style={INPUT_STYLE}
                            value={fields.certNumber}
                            onChange={(e) => setFields((p) => ({ ...p, certNumber: e.target.value }))}
                            placeholder="Cert number"
                          />
                          {fields.certNumber.trim() ? (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#22C55E" }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                            </span>
                          ) : null}
                        </div>
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
                          <select
                            className={INPUT_CLS}
                            style={INPUT_STYLE}
                            value={fields.condition}
                            onChange={(e) => setFields((p) => ({ ...p, condition: e.target.value }))}
                          >
                            <option value="">—</option>
                            {[fields.condition, ...CONDITIONS].filter((v, i, a) => v && a.indexOf(v) === i).map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Notes</label>
                        <textarea
                          className={INPUT_CLS}
                          style={{ ...INPUT_STYLE, minHeight: 68, resize: "vertical", fontWeight: 400 }}
                          value={fields.description}
                          maxLength={500}
                          onChange={(e) => setFields((p) => ({ ...p, description: e.target.value }))}
                          placeholder="Add any details about this item…"
                        />
                        <div className="mt-1 text-right text-[10px] text-[color:var(--muted2)]">{fields.description.length} / 500</div>
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

                  {/* Save bar — concept-19 */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border-t pt-4" style={{ borderColor: "var(--theme-border, rgba(203,208,213,0.14))" }}>
                    <Link
                      href="/vault/bulk"
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
                    >
                      <span className="text-base font-black text-[color:var(--theme-gold,#C8CDD2)]">+</span>
                      Adding a lot? Bulk upload
                    </Link>
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        onClick={handleSave}
                        className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[4px] px-9 text-[15px] font-black text-[#06171d]"
                        style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%, rgba(255,255,255,0.18) 100%), linear-gradient(180deg, #79E7FB 0%, #41C6E4 55%, #2CB1D1 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 10px rgba(0,0,0,0.4), 0 0 18px rgba(79,211,238,0.25)" }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h12l4 4v12H4z" /><path d="M8 4v6h8" /><path d="M9 15h6" /></svg>
                        Save to Vault
                      </button>
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--muted2)]">
                        <span style={{ color: "#22C55E" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span>
                        Private — only you can see your vault
                      </span>
                    </div>
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
            bulkToggle={false}
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
