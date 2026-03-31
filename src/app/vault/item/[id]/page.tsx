"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

import ItemMedia from "@/components/ItemMedia";
import PricingMvpCard from "@/components/PricingMvpCard";
import { removeBackgroundStub } from "@/lib/imageAI";
import { getStoredActiveProfileId } from "@/lib/auth";
import { buildPricingPatch } from "@/lib/pricingMvp";
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
  type VaultItem,
} from "@/lib/vaultModel";
import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

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
  const raw = String(value ?? "").toUpperCase();
  if (raw === "POP_CULTURE" || raw === "SPORTS" || raw === "TCG" || raw === "MUSIC" || raw === "JEWELRY_APPAREL" || raw === "GAMES" || raw === "MISC") return raw;
  return "MISC";
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
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const next = loadItems({ includeAllProfiles: true });
    setItems(next);
    markItemViewed(id);
  }, [id]);

  const item = useMemo(() => items.find((entry) => String(entry.id) === String(id)) ?? null, [items, id]);
  const images = useMemo(() => (item ? getOrderedImageUrls(item) : []), [item]);

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

  async function handleRemoveBackground(index: number) {
    if (!item || !images[index]) return;
    setMediaMessage("Background removal hook is running...");

    try {
      const resultUrl = await removeBackgroundStub(images[index]);
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

  async function handleSavePricing(patch: {
    estimatedValue?: number;
    lastCompValue?: number;
    priceSource?: string;
    priceConfidence?: "low" | "medium" | "high";
    priceNotes?: string;
  }) {
    const pricingPatch = buildPricingPatch({
      estimatedValue: patch.estimatedValue,
      lastCompValue: patch.lastCompValue,
      priceSource: patch.priceSource,
      priceConfidence: patch.priceConfidence,
      priceNotes: patch.priceNotes,
    });

    const nextItem: VaultItem = {
      ...item,
      estimatedValue: pricingPatch.estimatedValue,
      lastCompValue: pricingPatch.lastCompValue,
      priceSource: pricingPatch.priceSource,
      priceConfidence: pricingPatch.priceConfidence,
      priceUpdatedAt: pricingPatch.priceUpdatedAt,
      priceNotes: pricingPatch.priceNotes,
      currentValue:
        pricingPatch.estimatedValue ??
        pricingPatch.lastCompValue ??
        item.currentValue,
    };

    await persist(nextItem);
    setMediaMessage("Pricing updated.");
  }

  const universe = normUniverse(item.universe);
  const addedAt = createdAtMs(item);

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div>
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">ITEM</div>
            <h1 className="mt-2 text-4xl font-semibold leading-tight">{item.title}</h1>
            <div className="mt-2 text-sm text-[color:var(--muted)]">
              {UNIVERSE_LABEL[universe]} • {categoryLabel(item)}
              {item.subcategoryLabel ? ` • ${item.subcategoryLabel}` : ""}
              {" • "}Added {fmtDate(addedAt)}
            </div>

            <div className="mt-4">
              <Link href="/vault" className="inline-flex h-10 items-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium ring-1 ring-[color:var(--border)]">
                ← Vault
              </Link>
            </div>

            <div className="mt-4">
              <Section title="MEDIA">
                <ItemMedia
                  images={images}
                  activeIndex={activeImageIndex}
                  onSelect={setActiveImageIndex}
                  onAddImages={handleAddImages}
                  onMoveImage={handleMoveImage}
                  onDeleteImage={handleDeleteImage}
                  onRemoveBackground={handleRemoveBackground}
                />

                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <div className="text-[color:var(--muted)]">
                    {uploading ? "Uploading..." : "Primary image sync is cloud-first. Local fallback stays on this device if Supabase blocks writes."}
                  </div>
                  {mediaMessage ? <div className="text-[color:var(--fg)]">{mediaMessage}</div> : null}
                </div>
              </Section>
            </div>
          </div>

          <div>
            <Section title="ITEM SUMMARY">
              <div className="text-3xl font-semibold leading-tight">{item.title}</div>
              <div className="mt-2 text-sm text-[color:var(--muted)]">
                {item.subtitle || "Collector piece"}
                {item.number ? ` • ${item.number}` : ""}
                {item.grade ? ` • ${item.grade}` : ""}
              </div>

              <div className="mt-5 border-t border-[color:var(--border)] pt-4">
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

              <div className="mt-5 rounded-[20px] bg-black/10 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">MARKET</div>
                <div className="mt-3 text-[40px] font-semibold leading-none">{fmtMoney(effectiveMarketValue(item))}</div>
                <div className="mt-4 border-t border-white/8 pt-3">
                  <DetailGrid
                    rows={[
                      { label: "ROI", value: fmtPct(roi(item)) },
                      { label: "Total cost", value: fmtMoney(totalCost(item)) },
                      { label: "Gain", value: fmtMoney(gain(item)) },
                    ]}
                  />
                </div>
              </div>
            </Section>
          </div>
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
            }}
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
