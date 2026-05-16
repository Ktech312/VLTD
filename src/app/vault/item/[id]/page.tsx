"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

import ConditionAssessmentPanel from "@/components/ConditionAssessmentPanel";
import CostToSellPanel from "@/components/CostToSellPanel";
import ExportListingButton from "@/components/ExportListingButton";
import InsurancePdfButton from "@/components/InsurancePdfButton";
import ItemMedia from "@/components/ItemMedia";
import NotableBadge from "@/components/NotableBadge";
import PricingMvpCard from "@/components/PricingMvpCard";
import ShareBar from "@/components/ShareBar";
import { removeBackgroundStub } from "@/lib/imageAI";
import { getStoredActiveProfileId } from "@/lib/auth";
import { isNotable, notableReason } from "@/lib/itemIntelligence";
import { buildPricingPatch, displayPrimaryValue, type PricingMvpFields } from "@/lib/pricingMvp";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  deleteVaultImageFromSupabase,
  hasSupabaseEnv,
  uploadVaultImageToSupabase,
  upsertVaultItemToSupabase,
} from "@/lib/vaultCloud";
import {
  appendImage,
  deleteImageAtIndex,
  getOrderedImageUrls,
  getOrderedImages,
  loadItems,
  markItemViewed,
  reorderImages,
  saveItem,
  type VaultImage,
  type VaultItem,
} from "@/lib/vaultModel";
import {
  getCategories,
  getDefaultCategory,
  getSubcategories,
  getUniverses,
  isUniverseKey,
  UNIVERSE_LABEL,
  type UniverseKey,
} from "@/lib/taxonomy";

const SALES_KEY = "vltd_sales_history";

type SaleRecord = VaultItem & {
  soldPrice?: number;
  soldAt?: number;
};

function getSales(): SaleRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as SaleRecord[]) : [];
  } catch {
    return [];
  }
}

function writeSales(records: SaleRecord[]) {
  try {
    localStorage.setItem(SALES_KEY, JSON.stringify(records));
  } catch {
    // Local sale history is only a compatibility cache.
  }
}

function removeSaleRecord(itemId: string) {
  writeSales(getSales().filter((sale) => String(sale.id) !== String(itemId)));
}

function clamp(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function categoryLabel(item: VaultItem) {
  return item.categoryLabel ?? (item.category === "CUSTOM" ? item.customCategoryLabel ?? "Collector’s Choice" : "Collector’s Choice");
}

function normUniverse(value: unknown): UniverseKey {
  const raw = String(value ?? "").trim().toUpperCase();
  return isUniverseKey(raw) ? raw : "MISC";
}

function categoryCode(label: string) {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "COLLECTORS_CHOICE";
}

function safeCategoryForUniverse(universe: UniverseKey, value: unknown) {
  const requested = String(value ?? "").trim();
  return requested || getDefaultCategory(universe);
}

function createdAtMs(item: VaultItem) {
  if (typeof item.createdAt === "number" && Number.isFinite(item.createdAt)) return item.createdAt;
  const maybe = Number(item.id);
  return Number.isFinite(maybe) ? maybe : Date.now();
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function totalCost(item: VaultItem) {
  return clamp(item.purchasePrice) + clamp(item.purchaseTax) + clamp(item.purchaseShipping) + clamp(item.purchaseFees);
}

function effectiveMarketValue(item: VaultItem) {
  if (typeof item.valueMedian === "number" && Number.isFinite(item.valueMedian)) {
    return item.valueMedian;
  }
  if (typeof item.estimatedValue === "number" && Number.isFinite(item.estimatedValue)) {
    return item.estimatedValue;
  }
  return clamp(item.currentValue);
}

function gain(item: VaultItem) {
  return effectiveMarketValue(item) - totalCost(item);
}

function roi(item: VaultItem) {
  const cost = totalCost(item);
  if (cost <= 0) return 0;
  return (gain(item) / cost) * 100;
}

function detailValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">{title}</div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailGrid({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="grid gap-3 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4">
          <div className="text-[color:var(--muted)]">{row.label}</div>
          <div className="text-right text-[color:var(--fg)]">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [items, setItems] = useState<VaultItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mediaMessage, setMediaMessage] = useState("");
  const [recordMessage, setRecordMessage] = useState("");
  const [recordDraft, setRecordDraft] = useState({
    universe: "MISC" as UniverseKey,
    categoryLabel: "Collectors Choice",
    subcategoryLabel: "",
    title: "",
    subject: "",
  });
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [sale, setSale] = useState<SaleRecord | null>(null);
  const [isSoldView, setIsSoldView] = useState(false);

  useEffect(() => {
    const next = loadItems({ includeAllProfiles: true });
    setItems(next);
    markItemViewed(id);

    const params = new URLSearchParams(window.location.search);
    const sold = params.get("sold") === "1";
    setIsSoldView(sold);
    setSale(null);

    if (sold) {
      const sales = getSales();
      const match = sales.find((s) => String(s.id) === String(id));
      if (match) setSale(match);
    }
  }, [id]);

  const item = useMemo(() => items.find((entry) => String(entry.id) === String(id)) ?? sale ?? null, [items, id, sale]);
  const images = useMemo(() => (item ? getOrderedImageUrls(item) : []), [item]);

  useEffect(() => {
    if (!item) return;
    const nextUniverse = normUniverse(item.universe);
    const nextCategory = safeCategoryForUniverse(nextUniverse, item.categoryLabel || item.category);
    setRecordDraft({
      universe: nextUniverse,
      categoryLabel: nextCategory,
      subcategoryLabel: item.subcategoryLabel ?? "",
      title: item.title ?? "",
      subject: item.subject ?? "",
    });
  }, [item]);

  useEffect(() => {
    if (activeImageIndex > images.length - 1) {
      setActiveImageIndex(Math.max(0, images.length - 1));
    }
  }, [images.length, activeImageIndex]);

  if (!item) {
    return (
      <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-5xl rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]">
          Item not found.
        </div>
      </main>
    );
  }

  async function persist(nextItem: VaultItem) {
    saveItem(nextItem);
    setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));

    if (hasSupabaseEnv()) {
      await upsertVaultItemToSupabase({
        ...nextItem,
        profile_id: nextItem.profile_id || getStoredActiveProfileId(),
      });
    }

    window.dispatchEvent(new Event("vltd:vault-updated"));
  }

  function setDraftUniverse(nextUniverse: UniverseKey) {
    const nextCategory = getDefaultCategory(nextUniverse);
    setRecordDraft((prev) => ({
      ...prev,
      universe: nextUniverse,
      categoryLabel: nextCategory,
      subcategoryLabel: "",
    }));
  }

  function setDraftCategory(nextCategory: string) {
    setRecordDraft((prev) => ({
      ...prev,
      categoryLabel: nextCategory,
      subcategoryLabel: "",
    }));
  }

  async function handleSaveBasicRecord() {
    if (!item) return;
    const title = recordDraft.title.trim();
    if (!title) {
      setRecordMessage("Title is required.");
      return;
    }

    const universe = normUniverse(recordDraft.universe);
    const categoryLabelValue = safeCategoryForUniverse(universe, recordDraft.categoryLabel);
    const subcategoryOptions = getSubcategories(universe, categoryLabelValue);
    const requestedSubcategory = recordDraft.subcategoryLabel.trim();
    const subcategoryLabel =
      requestedSubcategory && subcategoryOptions.length && !subcategoryOptions.includes(requestedSubcategory)
        ? ""
        : requestedSubcategory;

    const nextItem: VaultItem = {
      ...item,
      title,
      universe,
      category: categoryCode(categoryLabelValue),
      categoryLabel: categoryLabelValue,
      subcategoryLabel: subcategoryLabel || undefined,
      subject: recordDraft.subject.trim() || undefined,
    };

    await persist(nextItem);
    setRecordMessage("Basic item record saved.");
  }

  async function handleAddImages(files: File[]) {
    if (!item || files.length === 0) return;

    setUploading(true);
    setMediaMessage("Uploading image(s)...");

    try {
      let nextItem = { ...item };

      for (const file of files) {
        try {
          if (hasSupabaseEnv()) {
            const uploaded = await uploadVaultImageToSupabase({
              itemId: item.id,
              file,
              fileName: file.name,
            });
            nextItem = appendImage(nextItem, uploaded.publicUrl, uploaded.path, { localOnly: false });
          } else {
            const localUrl = URL.createObjectURL(file);
            nextItem = appendImage(nextItem, localUrl, localUrl, { localOnly: true });
          }
        } catch (uploadError) {
          const localUrl = URL.createObjectURL(file);
          nextItem = appendImage(nextItem, localUrl, localUrl, { localOnly: true });
          setMediaMessage(
            uploadError instanceof Error
              ? `${uploadError.message} Saved locally on this device.`
              : "Cloud upload failed. Saved locally on this device."
          );
        }
      }

      try {
        await persist(nextItem);
        if (!mediaMessage) setMediaMessage("Images saved.");
      } catch (persistError) {
        saveItem(nextItem);
        setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));
        setMediaMessage(
          persistError instanceof Error
            ? `${persistError.message} Local fallback kept the images on this device.`
            : "Cloud save failed. Local fallback kept the images on this device."
        );
      }

      setActiveImageIndex(Math.max(0, (nextItem.images?.length ?? 1) - 1));
    } finally {
      setUploading(false);
    }
  }

  async function handleMoveImage(fromIndex: number, toIndex: number) {
    if (!item) return;
    const nextItem = reorderImages(item, fromIndex, toIndex);
    saveItem(nextItem);
    setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));
    setActiveImageIndex(toIndex);
    setMediaMessage("Image order updated.");

    if (hasSupabaseEnv()) {
      try {
        await upsertVaultItemToSupabase({
          ...nextItem,
          profile_id: nextItem.profile_id || getStoredActiveProfileId(),
        });
      } catch (error) {
        setMediaMessage(
          error instanceof Error
            ? `${error.message} Order changed locally only.`
            : "Order changed locally only."
        );
      }
    }
  }

  async function handleDeleteImage(index: number) {
    if (!item) return;

    const beforeImages = getOrderedImages(item);
    const target = beforeImages[index];
    const nextItem = deleteImageAtIndex(item, index);

    saveItem(nextItem);
    setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));
    setActiveImageIndex((prev) => Math.max(0, Math.min(prev, (nextItem.images?.length ?? 1) - 1)));
    setMediaMessage("Image deleted.");

    if (hasSupabaseEnv()) {
      try {
        if (target && target.storageKey && !target.localOnly) {
          await deleteVaultImageFromSupabase(target.storageKey);
        }

        await upsertVaultItemToSupabase({
          ...nextItem,
          profile_id: nextItem.profile_id || getStoredActiveProfileId(),
        });
      } catch (error) {
        setMediaMessage(
          error instanceof Error
            ? `${error.message} Delete applied locally only.`
            : "Delete applied locally only."
        );
      }
    }
  }

  async function handleReplaceImage(index: number, file: File) {
    if (!item) return;

    const orderedImages = getOrderedImages(item);
    const target = orderedImages[index];
    if (!target) return;

    setUploading(true);
    setMediaMessage("Saving edited photo...");

    try {
      let replacement: VaultImage;

      try {
        if (hasSupabaseEnv()) {
          const uploaded = await uploadVaultImageToSupabase({
            itemId: item.id,
            file,
            fileName: file.name || "edited-photo.jpg",
          });
          replacement = {
            ...target,
            id: uploaded.path,
            storageKey: uploaded.path,
            url: uploaded.publicUrl,
            localOnly: false,
          };
        } else {
          const localUrl = URL.createObjectURL(file);
          replacement = {
            ...target,
            id: localUrl,
            storageKey: localUrl,
            url: localUrl,
            localOnly: true,
          };
        }
      } catch (uploadError) {
        const localUrl = URL.createObjectURL(file);
        replacement = {
          ...target,
          id: localUrl,
          storageKey: localUrl,
          url: localUrl,
          localOnly: true,
        };
        setMediaMessage(
          uploadError instanceof Error
            ? `${uploadError.message} Edited photo saved locally on this device.`
            : "Cloud upload failed. Edited photo saved locally on this device."
        );
      }

      const nextImages = orderedImages.map((image, imageIndex) =>
        imageIndex === index ? { ...replacement, order: imageIndex } : { ...image, order: imageIndex }
      );
      const replacingPrimary =
        target.storageKey === item.primaryImageKey || target.url === item.imageFrontUrl || index === 0;
      const nextItem: VaultItem = {
        ...item,
        images: nextImages,
        primaryImageKey: replacingPrimary ? replacement.storageKey : item.primaryImageKey,
        imageFrontUrl: replacingPrimary ? replacement.url : item.imageFrontUrl,
        imageFrontStoragePath:
          replacingPrimary && !replacement.localOnly
            ? replacement.storageKey
            : replacingPrimary
              ? undefined
              : item.imageFrontStoragePath,
      };

      await persist(nextItem);

      if (hasSupabaseEnv() && target.storageKey && !target.localOnly && target.storageKey !== replacement.storageKey) {
        try {
          await deleteVaultImageFromSupabase(target.storageKey);
        } catch {
          // The edited image is saved; old-file cleanup can fail safely.
        }
      }

      setMediaMessage("Edited photo saved.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveBackground(index: number) {
    if (!item || !images[index]) return;
    setMediaMessage("Background removal hook is running...");

    try {
      const result = await removeBackgroundStub(images[index]);
      const resultUrl = typeof result === "string" ? result : URL.createObjectURL(result);
      const nextImages = [...(item.images ?? [])];
      if (nextImages[index]) {
        nextImages[index] = {
          ...nextImages[index],
          url: resultUrl,
          storageKey: nextImages[index].storageKey || resultUrl,
        };
      }

      const finalItem = {
        ...item,
        images: nextImages,
      };

      saveItem(finalItem);
      setItems((prev) => prev.map((entry) => (entry.id === finalItem.id ? finalItem : entry)));

      if (hasSupabaseEnv()) {
        try {
          await upsertVaultItemToSupabase({
            ...finalItem,
            profile_id: finalItem.profile_id || getStoredActiveProfileId(),
          });
        } catch (error) {
          setMediaMessage(
            error instanceof Error
              ? `${error.message} BG result saved locally only.`
              : "BG result saved locally only."
          );
          return;
        }
      }

      setMediaMessage("Background removal hook completed.");
    } catch (error) {
      setMediaMessage(error instanceof Error ? error.message : "Background removal failed.");
    }
  }

  async function handleSavePricing(patch: PricingMvpFields) {
    if (!item) return;

    const pricingPatch = buildPricingPatch(patch);

    const nextItem: VaultItem = {
      ...item,
      id: item.id,
      title: item.title,
      estimatedValue: pricingPatch.estimatedValue,
      lastCompValue: pricingPatch.lastCompValue,
      priceSource: pricingPatch.priceSource,
      priceConfidence: pricingPatch.priceConfidence,
      priceUpdatedAt: pricingPatch.priceUpdatedAt,
      priceNotes: pricingPatch.priceNotes,
      valueLow: pricingPatch.valueLow,
      valueMedian: pricingPatch.valueMedian,
      valueHigh: pricingPatch.valueHigh,
      comparables: pricingPatch.comparables,
      priceSources: pricingPatch.priceSources,
      currentValue: displayPrimaryValue(pricingPatch) ?? item.currentValue,
    };

    await persist(nextItem);
    setMediaMessage("Pricing updated.");
  }

  async function handleReturnToVault() {
    if (!item) return;
    const confirmed = window.confirm("Return this item to the Vault and remove its sold status?");
    if (!confirmed) return;

    const nextItem: VaultItem = {
      ...item,
      status: "COLLECTION",
      soldPrice: undefined,
      soldAt: undefined,
    };

    saveItem(nextItem);
    removeSaleRecord(item.id);
    setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));
    setSale(null);
    setIsSoldView(false);
    window.history.replaceState(null, "", `/vault/item/${encodeURIComponent(item.id)}`);

    if (hasSupabaseEnv()) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { error } = await supabase
          .from("vault_items")
          .update({
            status: "COLLECTION",
            sold_price: null,
            sold_at: null,
          })
          .eq("id", item.id);

        if (error) {
          setMediaMessage(`${error.message} Item restored locally only.`);
          return;
        }
      }
    }

    setMediaMessage("Returned to Vault.");
    window.dispatchEvent(new Event("vltd:vault-updated"));
  }

  async function handleToggleForSale() {
    if (!item || item.status === "SOLD") return;
    const nextStatus = item.status === "FOR_SALE" ? "COLLECTION" : "FOR_SALE";
    const nextItem: VaultItem = {
      ...item,
      status: nextStatus,
      askingPrice:
        nextStatus === "FOR_SALE"
          ? item.askingPrice ?? effectiveMarketValue(item)
          : item.askingPrice,
    };

    await persist(nextItem);
    setMediaMessage(nextStatus === "FOR_SALE" ? "Marked for sale." : "Removed from For Sale.");
  }

  async function handleAskingPriceBlur(value: string) {
    if (!item) return;
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    const askingPrice = trimmed && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    await persist({ ...item, askingPrice });
    setMediaMessage(askingPrice ? "Asking price saved." : "Asking price cleared.");
  }

  async function handleUpdateCondition(patch: {
    grade?: string;
    conditionReason?: string;
    conditionSource?: "ai" | "manual";
  }) {
    if (!item) return;
    await persist({ ...item, ...patch });
    setMediaMessage("Condition updated.");
  }

  const universe = normUniverse(item.universe);
  const addedAt = createdAtMs(item);
  const displayedSale: SaleRecord | null =
    sale ??
    (item.status === "SOLD" || item.soldAt || item.soldPrice !== undefined
      ? {
          ...item,
          soldPrice: item.soldPrice,
          soldAt: item.soldAt,
        }
      : null);
  const saleProfit =
    displayedSale ? Number(displayedSale.soldPrice ?? 0) - totalCost(item) : 0;
  const recordSelectedCategory = safeCategoryForUniverse(recordDraft.universe, recordDraft.categoryLabel);
  const baseRecordCategoryOptions = getCategories(recordDraft.universe);
  const recordCategoryOptions =
    recordSelectedCategory && !baseRecordCategoryOptions.includes(recordSelectedCategory)
      ? [recordSelectedCategory, ...baseRecordCategoryOptions]
      : baseRecordCategoryOptions;
  const recordSubcategoryOptions = getSubcategories(recordDraft.universe, recordSelectedCategory);
  const notable = isNotable(item);

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div>
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">ITEM</div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold leading-tight">{item.title}</h1>
              {notable ? <NotableBadge reason={notableReason(item)} /> : null}
            </div>
            <div className="mt-2 text-sm text-[color:var(--muted)]">
              {UNIVERSE_LABEL[universe]} • {categoryLabel(item)}
              {item.subcategoryLabel ? ` • ${item.subcategoryLabel}` : ""}
              {" • "}Added {fmtDate(addedAt)}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href="/vault" className="inline-flex h-10 items-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium ring-1 ring-[color:var(--border)]">
                ← Vault
              </Link>
              <Link
                href={`/vault/item/${encodeURIComponent(item.id)}/present`}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ring-1 transition"
                style={{ background: "var(--surface)", color: "var(--muted)", borderColor: "var(--border)" }}
              >
                Stream
              </Link>
              <InsurancePdfButton
                items={[item]}
                label="Insurance PDF"
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ring-1 transition"
              />
            </div>

            {displayedSale ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => void handleReturnToVault()}
                  className="inline-flex h-10 items-center rounded-full bg-gold/15 px-4 text-sm font-medium text-cyan-100 ring-1 ring-gold/25"
                >
                  Return to Vault
                </button>
              </div>
            ) : null}

            <div className="mt-4">
              <ShareBar title={item.title} />
            </div>

            {isSoldView && displayedSale && (
              <div className="mb-5 mt-4">
                <Section title="SALE DETAILS">
                  <DetailGrid
                    rows={[
                      { label: "Sold Price", value: fmtMoney(clamp(displayedSale.soldPrice)) },
                      {
                        label: "Profit / Loss",
                        value: (
                          <span className={saleProfit >= 0 ? "text-green-400" : "text-red-400"}>
                            {saleProfit >= 0 ? "+" : ""}
                            {fmtMoney(saleProfit)}
                          </span>
                        ),
                      },
                      {
                        label: "Sold Date",
                        value: displayedSale.soldAt ? fmtDate(displayedSale.soldAt) : "—",
                      },
                    ]}
                  />
                </Section>
              </div>
            )}

            <div id="media" className="mt-4 scroll-mt-24">
              <Section title="MEDIA">
                <ItemMedia
                  images={images}
                  activeIndex={activeImageIndex}
                  onSelect={setActiveImageIndex}
                  onAddImages={handleAddImages}
                  onMoveImage={handleMoveImage}
                  onDeleteImage={handleDeleteImage}
                  onReplaceImage={handleReplaceImage}
                  onRemoveBackground={handleRemoveBackground}
                />

                {(uploading || mediaMessage) && (
                  <div className="mt-3 text-sm text-[color:var(--muted)]">
                    {uploading ? "Uploading..." : mediaMessage}
                  </div>
                )}
              </Section>
            </div>
          </div>

          <div>
            <Section title="ITEM SUMMARY">
              <div className="pt-1">
                <DetailGrid
                  rows={[
                    { label: "Universe", value: UNIVERSE_LABEL[universe] },
                    { label: "Category", value: categoryLabel(item) },
                    { label: "Subcategory", value: detailValue(item.subcategoryLabel) },
                    { label: "Cert #", value: detailValue(item.certNumber) },
                    { label: "Added", value: fmtDate(addedAt) },
                  ]}
                />
              </div>

              <div className="mt-5 rounded-[20px] bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">MARKET</div>
                <div className="mt-3 text-[40px] font-semibold leading-none">{fmtMoney(effectiveMarketValue(item))}</div>
                <div className="mt-4 border-t border-[color:var(--theme-border)] pt-3">
                  <DetailGrid
                    rows={[
                      { label: "ROI", value: fmtPct(roi(item)) },
                      { label: "Total cost", value: fmtMoney(totalCost(item)) },
                      { label: "Gain", value: fmtMoney(gain(item)) },
                    ]}
                  />
                </div>
              </div>

              {item.status !== "SOLD" ? (
                <div className="mt-5 rounded-[20px] bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[13px] font-semibold">
                        {item.status === "FOR_SALE" ? "Listed for sale" : "Mark for sale"}
                      </div>
                      <div className="mt-1 text-[11px] text-[color:var(--muted)]">
                        {item.status === "FOR_SALE"
                          ? "Keeps this item in your vault while enabling listing tools."
                          : "Adds a For Sale badge and unlocks listing copy."}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleToggleForSale()}
                      aria-pressed={item.status === "FOR_SALE"}
                      className="relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors"
                      style={{
                        background:
                          item.status === "FOR_SALE"
                            ? "var(--theme-gold)"
                            : "var(--pill)",
                      }}
                    >
                      <span
                        className="mt-1 inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
                        style={{
                          transform:
                            item.status === "FOR_SALE"
                              ? "translateX(24px)"
                              : "translateX(4px)",
                        }}
                      />
                    </button>
                  </div>

                  {item.status === "FOR_SALE" ? (
                    <label className="mt-4 grid gap-1.5">
                      <span className="text-[11px] font-semibold tracking-[0.16em] text-[color:var(--muted2)]">
                        Asking Price
                      </span>
                      <input
                        type="number"
                        defaultValue={item.askingPrice ?? effectiveMarketValue(item) ?? ""}
                        onBlur={(event) => void handleAskingPriceBlur(event.target.value)}
                        className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                        placeholder={String(effectiveMarketValue(item) || "")}
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}
            </Section>

            <div className="mt-5">
              <CostToSellPanel
                price={effectiveMarketValue(item)}
                costBasis={totalCost(item)}
                shippingCost={clamp(item.purchaseShipping)}
                category={categoryLabel(item)}
              />
            </div>

            <div className="mt-5">
              <ConditionAssessmentPanel
                item={item}
                onUpdate={(patch) => void handleUpdateCondition(patch)}
              />
            </div>

            <div className="mt-5">
              {item.status === "FOR_SALE" ? (
                <ExportListingButton item={item} />
              ) : (
                <div className="rounded-[24px] bg-[color:var(--surface)] p-5 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
                  <div className="text-sm text-[color:var(--muted)]">
                    Mark this item for sale to generate marketplace listing copy.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Section title="BASIC ITEM RECORD">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--muted2)]">Universe</span>
                <select
                  className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                  value={recordDraft.universe}
                  onChange={(event) => setDraftUniverse(normUniverse(event.target.value))}
                >
                  {getUniverses().map((key) => (
                    <option key={key} value={key}>
                      {UNIVERSE_LABEL[key]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--muted2)]">Category</span>
                <select
                  className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                  value={recordSelectedCategory}
                  onChange={(event) => setDraftCategory(event.target.value)}
                >
                  {recordCategoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--muted2)]">Subcategory</span>
                {recordSubcategoryOptions.length ? (
                  <select
                    className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                    value={recordDraft.subcategoryLabel}
                    onChange={(event) => setRecordDraft((prev) => ({ ...prev, subcategoryLabel: event.target.value }))}
                  >
                    <option value="">Optional</option>
                    {recordSubcategoryOptions.map((subcategory) => (
                      <option key={subcategory} value={subcategory}>
                        {subcategory}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                    value={recordDraft.subcategoryLabel}
                    onChange={(event) => setRecordDraft((prev) => ({ ...prev, subcategoryLabel: event.target.value }))}
                    placeholder="Optional"
                  />
                )}
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--muted2)]">Title</span>
                <input
                  className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                  value={recordDraft.title}
                  onChange={(event) => setRecordDraft((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Batman"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--muted2)]">Subject</span>
                <input
                  className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                  value={recordDraft.subject}
                  onChange={(event) => setRecordDraft((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder="Player, character, artist, franchise"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleSaveBasicRecord()}
                className="inline-flex h-10 items-center rounded-full bg-gold/15 px-4 text-sm font-medium text-cyan-100 ring-1 ring-gold/25"
              >
                Save basic record
              </button>
              {recordMessage ? <div className="text-sm text-[color:var(--muted)]">{recordMessage}</div> : null}
            </div>
          </Section>
        </div>

        <div className="mt-5">
          <PricingMvpCard
            title="PRICING MVP"
            value={{
              estimatedValue: item.estimatedValue,
              lastCompValue: item.lastCompValue,
              priceSource: item.priceSource,
              priceConfidence: item.priceConfidence,
              priceUpdatedAt: item.priceUpdatedAt,
              priceNotes: item.priceNotes,
              valueLow: item.valueLow,
              valueMedian: item.valueMedian,
              valueHigh: item.valueHigh,
              comparables: item.comparables,
              priceSources: item.priceSources,
            }}
            universe={item.universe}
            categoryLabel={categoryLabel(item)}
            grade={item.grade}
            itemTitle={item.title}
            onSave={handleSavePricing}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <Section title="DETAILS">
            <DetailGrid
              rows={[
                { label: "Subtitle", value: detailValue(item.subtitle) },
                { label: "Number / Model", value: detailValue(item.number) },
                { label: "Grade", value: detailValue(item.grade) },
                { label: "Serial #", value: detailValue(item.serialNumber) },
              ]}
            />
            {(item.edition || item.variant || item.printRun || item.isFirstEdition) && (
              <div className="mt-4 rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">
                  Edition / Variant
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.isFirstEdition ? (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold ring-1"
                      style={{
                        background: "var(--theme-gold-subtle)",
                        borderColor: "var(--theme-gold-border)",
                        color: "var(--theme-gold)",
                      }}
                    >
                      1st Edition
                    </span>
                  ) : null}
                  {item.edition && !item.isFirstEdition ? (
                    <span
                      className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
                      style={{ color: "var(--fg)" }}
                    >
                      {item.edition}
                    </span>
                  ) : null}
                  {item.variant ? (
                    <span
                      className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
                      style={{ color: "var(--fg)" }}
                    >
                      {item.variant}
                    </span>
                  ) : null}
                  {item.printRun ? (
                    <span
                      className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
                      style={{ color: "var(--fg)" }}
                    >
                      # {item.printRun}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
            {item.subject ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted2)" }}>
                  Subject
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1"
                  style={{
                    background: "var(--theme-gold-subtle)",
                    borderColor: "var(--theme-gold-border)",
                    color: "var(--theme-gold)",
                  }}
                >
                  {item.subject}
                </span>
              </div>
            ) : null}
          </Section>

          <Section title="PURCHASE">
            <DetailGrid
              rows={[
                { label: "Purchase price", value: fmtMoney(clamp(item.purchasePrice)) },
                { label: "Tax", value: fmtMoney(clamp(item.purchaseTax)) },
                { label: "Shipping", value: fmtMoney(clamp(item.purchaseShipping)) },
                { label: "Fees", value: fmtMoney(clamp(item.purchaseFees)) },
                { label: "Source", value: detailValue(item.purchaseSource) },
                { label: "Location", value: detailValue(item.purchaseLocation) },
                { label: "Order #", value: detailValue(item.orderNumber) },
              ]}
            />
          </Section>

          <Section title="STORAGE + TRACKING">
            <DetailGrid
              rows={[
                { label: "Storage location", value: detailValue(item.storageLocation) },
                { label: "Value source", value: detailValue(item.valueSource) },
                { label: "Value updated", value: detailValue(item.valueUpdatedAt ? fmtDate(item.valueUpdatedAt) : "—") },
                { label: "Confidence", value: typeof item.valueConfidence === "number" ? `${item.valueConfidence}%` : "—" },
              ]}
            />
          </Section>
        </div>

        <div className="mt-5">
          <Section title="NOTES">
            <div className="whitespace-pre-wrap text-sm leading-6">
              {item.notes?.trim() ? item.notes : "No notes yet."}
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
