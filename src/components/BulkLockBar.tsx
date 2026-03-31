"use client";

import type { BulkAddFieldKey, BulkAddLocks } from "@/lib/bulkAddState";

type BulkLockGroup = {
  title: string;
  fields: Array<{
    key: BulkAddFieldKey;
    label: string;
  }>;
};

const GROUPS: BulkLockGroup[] = [
  {
    title: "Core",
    fields: [
      { key: "title", label: "Title" },
      { key: "subtitle", label: "Subtitle" },
      { key: "number", label: "Number" },
      { key: "grade", label: "Grade" },
    ],
  },
  {
    title: "Money",
    fields: [
      { key: "purchasePrice", label: "Cost" },
      { key: "currentValue", label: "Value" },
    ],
  },
  {
    title: "Classification",
    fields: [
      { key: "universe", label: "Universe" },
      { key: "category", label: "Category" },
      { key: "categoryLabel", label: "Category Label" },
      { key: "subcategoryLabel", label: "Subcategory" },
    ],
  },
  {
    title: "Ownership",
    fields: [
      { key: "storageLocation", label: "Storage" },
      { key: "purchaseSource", label: "Source" },
      { key: "purchaseLocation", label: "Location" },
    ],
  },
  {
    title: "Reference",
    fields: [
      { key: "certNumber", label: "Cert #" },
      { key: "serialNumber", label: "Serial #" },
      { key: "notes", label: "Notes" },
    ],
  },
];

function countLocked(locks: BulkAddLocks) {
  let total = 0;
  for (const value of Object.values(locks)) {
    if (value) total += 1;
  }
  return total;
}

export default function BulkLockBar({
  locks,
  onToggleLock,
  onLockAll,
  onUnlockAll,
}: {
  locks: BulkAddLocks;
  onToggleLock: (key: BulkAddFieldKey) => void;
  onLockAll?: () => void;
  onUnlockAll?: () => void;
}) {
  const lockedCount = countLocked(locks);

  return (
    <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
            BULK LOCKS
          </div>
          <div className="mt-1 text-sm text-[color:var(--muted)]">
            Keep repeat fields locked while entering the next item.
          </div>
          <div className="mt-2 text-xs text-[color:var(--fg)]">
            {lockedCount} field{lockedCount === 1 ? "" : "s"} locked
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {onLockAll ? (
            <button
              type="button"
              onClick={onLockAll}
              className="inline-flex h-9 items-center rounded-full bg-[color:var(--pill)] px-3 text-xs font-medium ring-1 ring-[color:var(--border)]"
            >
              Lock All
            </button>
          ) : null}
          {onUnlockAll ? (
            <button
              type="button"
              onClick={onUnlockAll}
              className="inline-flex h-9 items-center rounded-full bg-[color:var(--pill)] px-3 text-xs font-medium ring-1 ring-[color:var(--border)]"
            >
              Unlock All
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-5">
        {GROUPS.map((group) => (
          <div
            key={group.title}
            className="rounded-[14px] bg-black/10 p-3 ring-1 ring-white/8"
          >
            <div className="text-[10px] tracking-[0.18em] text-[color:var(--muted2)]">
              {group.title}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {group.fields.map((field) => {
                const locked = locks[field.key];

                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => onToggleLock(field.key)}
                    className={[
                      "inline-flex min-h-[30px] items-center rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                      locked
                        ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
                        : "bg-[color:var(--pill)] text-[color:var(--muted)] ring-[color:var(--border)] hover:text-[color:var(--fg)]",
                    ].join(" ")}
                    title={locked ? `Unlock ${field.label}` : `Lock ${field.label}`}
                    aria-pressed={locked}
                  >
                    {locked ? "● " : "○ "}
                    {field.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}