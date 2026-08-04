"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PillButton } from "@/components/ui/PillButton";
import { Suspense, useEffect, useState } from "react";
import {
  deleteDraft,
  getDraft,
  upsertDraft,
  type AICatalogDraft,
} from "@/lib/aiCatalogDrafts";
import { saveItem } from "@/lib/vaultModel";
import { dispatchItemGraded } from "@/hooks/useAutoShareTrigger";

// ─── helpers ─────────────────────────────────────────────────────────────────

function money(v?: number) {
  if (!v) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full rounded-xl px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none focus:ring-[color:var(--theme-gold)]"
        style={{ background: "var(--pill)", color: "var(--fg)" }}
      />
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label}
      </label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none focus:ring-[color:var(--theme-gold)]"
        style={{ background: "var(--pill)", color: "var(--fg)", resize: "vertical" }}
      />
    </div>
  );
}

// ─── ReviewInner ──────────────────────────────────────────────────────────────

function ReviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";

  const [draft, setDraft] = useState<AICatalogDraft | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [grade, setGrade] = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [subject, setSubject] = useState("");
  const [number, setNumber] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!id) return;
    const d = getDraft(id);
    if (!d) return;
    setDraft(d);
    setTitle(d.title ?? "");
    setSubtitle(d.subtitle ?? "");
    setCategoryLabel(d.categoryLabel ?? "");
    setGrade(d.grade ?? "");
    setCertNumber(d.certNumber ?? "");
    setSubject(d.subject ?? "");
    setNumber(d.number ?? "");
    setPurchasePrice(d.purchasePrice != null ? String(d.purchasePrice) : "");
    setCurrentValue(d.currentValue != null ? String(d.currentValue) : "");
    setNotes(d.notes ?? "");
    setReviewNotes(d.reviewNotes ?? "");
  }, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  function buildUpdatedDraft(): AICatalogDraft {
    return {
      ...draft!,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      categoryLabel: categoryLabel.trim() || undefined,
      grade: grade.trim() || undefined,
      certNumber: certNumber.trim() || undefined,
      subject: subject.trim() || undefined,
      number: number.trim() || undefined,
      purchasePrice: purchasePrice ? Number(purchasePrice.replace(/[^0-9.]/g, "")) || undefined : undefined,
      currentValue: currentValue ? Number(currentValue.replace(/[^0-9.]/g, "")) || undefined : undefined,
      notes: notes.trim() || undefined,
      reviewNotes: reviewNotes.trim() || undefined,
    };
  }

  function handleSaveDraft(status: AICatalogDraft["status"]) {
    const updated = { ...buildUpdatedDraft(), status, reviewedAt: new Date().toISOString() };
    upsertDraft(updated);
    setDraft(updated);
    showToast(status === "NEEDS_REVIEW" ? "Draft flagged for more info." : "Draft saved.");
  }

  function handleApproveAndSave() {
    if (!title.trim()) { showToast("Title is required."); return; }

    const vaultItem = {
      id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      categoryLabel: categoryLabel.trim() || undefined,
      category: draft?.category,
      universe: draft?.universe,
      grade: grade.trim() || undefined,
      certNumber: certNumber.trim() || undefined,
      subject: subject.trim() || undefined,
      number: number.trim() || undefined,
      notes: notes.trim() || undefined,
      purchasePrice: purchasePrice ? Number(purchasePrice.replace(/[^0-9.]/g, "")) || undefined : undefined,
      currentValue: currentValue ? Number(currentValue.replace(/[^0-9.]/g, "")) || undefined : undefined,
      imageFrontUrl: draft?.frontImageUrl,
      status: "COLLECTION" as const,
      createdAt: Date.now(),
      conditionSource: "ai" as const,
    };

    saveItem(vaultItem);
    window.dispatchEvent(new Event("vltd:vault-updated"));
    if (vaultItem.grade) dispatchItemGraded(vaultItem, vaultItem.grade);

    const converted = { ...buildUpdatedDraft(), status: "CONVERTED" as const, reviewedAt: new Date().toISOString() };
    upsertDraft(converted);
    setDraft(converted);

    showToast("✓ Saved to vault!");
    setTimeout(() => router.push("/ai/drafts"), 1800);
  }

  function handleReject() {
    const rejected = { ...buildUpdatedDraft(), status: "REJECTED" as const, reviewedAt: new Date().toISOString() };
    upsertDraft(rejected);
    deleteDraft(id);
    router.push("/ai/drafts");
  }

  if (!id) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: "var(--muted)" }}>
        No draft ID specified. <Link href="/ai/drafts" style={{ color: "var(--theme-gold)" }}>Back to queue →</Link>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: "var(--muted)" }}>
        Draft not found. <Link href="/ai/drafts" style={{ color: "var(--theme-gold)" }}>Back to queue →</Link>
      </div>
    );
  }

  const isConverted = draft.status === "CONVERTED";
  const confidenceColor = draft.confidenceScore >= 80 ? "#4ade80" : draft.confidenceScore >= 60 ? "var(--theme-gold)" : "#f87171";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Toast */}
      {toast && (
        <div
          className="mb-4 rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 ring-[color:var(--border)]"
          style={{ background: "var(--surface)", color: "var(--fg)" }}
        >
          {toast}
        </div>
      )}

      {/* Confidence card */}
      <div className="rounded-2xl p-4 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              AI confidence
            </div>
            <div className="mt-1 text-2xl font-black" style={{ color: confidenceColor }}>
              {draft.confidenceScore}%
            </div>
            <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
              {draft.confidenceLabel} · via {draft.createdByLabel}
            </div>
          </div>
          <div className="text-right text-xs" style={{ color: "var(--muted)" }}>
            <div>Detected</div>
            <div>{new Date(draft.createdAt).toLocaleString()}</div>
          </div>
        </div>

        {draft.missingFields.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>Missing fields</div>
            <div className="flex flex-wrap gap-1">
              {draft.missingFields.map((f) => (
                <span
                  key={f}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
                >
                  ⚠ {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {isConverted && (
          <div className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "rgba(129,140,248,0.15)", color: "#818cf8" }}>
            ✓ This draft has been saved to the vault.
          </div>
        )}
      </div>

      {/* Edit form */}
      <div className="mt-4 rounded-2xl p-5 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted)" }}>
          Review & edit fields
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title *" name="title" value={title} onChange={setTitle} />
          </div>
          <Field label="Subtitle" name="subtitle" value={subtitle} onChange={setSubtitle} />
          <Field label="Category" name="category" value={categoryLabel} onChange={setCategoryLabel} />
          <Field label="Condition / Grade" name="grade" value={grade} onChange={setGrade} placeholder="e.g. PSA 9, VF/NM" />
          <Field label="Cert / Serial Number" name="certNumber" value={certNumber} onChange={setCertNumber} />
          <Field label="Subject / Featured" name="subject" value={subject} onChange={setSubject} />
          <Field label="Number / Issue #" name="number" value={number} onChange={setNumber} />
          <Field label="Purchase price ($)" name="purchasePrice" value={purchasePrice} onChange={setPurchasePrice} type="number" placeholder="0" />
          <Field label="Current value ($)" name="currentValue" value={currentValue} onChange={setCurrentValue} type="number" placeholder="0" />
          <div className="sm:col-span-2">
            <TextArea label="Notes" value={notes} onChange={setNotes} />
          </div>
          <div className="sm:col-span-2">
            <TextArea label="Reviewer notes (internal)" value={reviewNotes} onChange={setReviewNotes} />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {!isConverted && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleApproveAndSave}
            className="flex-1 rounded-[8px] py-3 text-sm font-bold transition sm:flex-none sm:px-8"
            style={{ background: "linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)", color: "#06171d" }}
          >
            ✓ Approve & save to vault
          </button>
          <PillButton onClick={() => handleSaveDraft("NEEDS_REVIEW")}>
            Flag: needs more info
          </PillButton>
          <PillButton
            onClick={handleReject}
            style={{ background: "transparent", color: "#f87171", boxShadow: "none" }}
          >
            Reject
          </PillButton>
        </div>
      )}

      {isConverted && (
        <div className="mt-4 flex gap-3">
          <Link
            href="/vault"
            className="flex-1 rounded-full py-3 text-center text-sm font-bold"
            style={{ background: "linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)", color: "#06171d" }}
          >
            View vault →
          </Link>
          <Link href="/ai/drafts" className="rounded-full px-5 py-3 text-sm ring-1" style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}>
            Back to queue
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIReviewPage() {
  return (
    <div className="" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <div className="border-b border-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="flex items-center gap-3">
            <Link href="/vault" className="text-sm" style={{ color: "var(--muted)" }}>Vault</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <Link href="/ai/drafts" className="text-sm" style={{ color: "var(--muted)" }}>AI Drafts</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Review</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold" style={{ color: "var(--fg)" }}>Review Draft</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Verify AI-detected fields, fill in any gaps, then approve to save to your vault.
          </p>
        </div>
      </div>

      <Suspense fallback={
        <div className="py-16 text-center text-sm" style={{ color: "var(--muted)" }}>Loading…</div>
      }>
        <ReviewInner />
      </Suspense>
    </div>
  );
}
