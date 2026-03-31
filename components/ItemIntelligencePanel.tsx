"use client";

import type { VaultItem } from "@/lib/vaultModel";
import type { ItemIntelligence } from "@/lib/itemIntelligence";

type Props = {
  item: VaultItem;
  intelligence?: ItemIntelligence | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function totalCost(item: VaultItem) {
  return (
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0)
  );
}

function itemGain(item: VaultItem) {
  return Number(item.currentValue ?? 0) - totalCost(item);
}

function readinessTone(readiness: "Low" | "Moderate" | "High") {
  if (readiness === "High") return "High";
  if (readiness === "Moderate") return "Moderate";
  return "Low";
}

function Signal({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="vltd-panel-soft rounded-[18px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
      <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      {sublabel ? (
        <div className="mt-1 text-sm text-[color:var(--muted)]">{sublabel}</div>
      ) : null}
    </div>
  );
}

function ScoreBar({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const width = Math.max(6, Math.min(100, value));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-black/15 ring-1 ring-[color:var(--border)]">
        <div
          className="h-full rounded-full bg-[color:var(--pill-active-bg)]"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function ItemIntelligencePanel({
  item,
  intelligence,
}: Props) {
  const currentValue = Number(item.currentValue ?? 0);
  const cost = totalCost(item);
  const gain = itemGain(item);

  const provenanceSignals = [
    item.certNumber?.trim() ? "Certification logged" : "",
    item.purchaseSource?.trim() ? "Source logged" : "",
    item.storageLocation?.trim() ? "Storage tracked" : "",
    item.notes?.trim() ? "Notes present" : "",
  ].filter(Boolean);

  const readiness = intelligence?.readiness ?? "Low";

  return (
    <section className="vltd-panel-main rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
        ITEM INTELLIGENCE
      </div>

      <h2 className="mt-2 text-2xl font-semibold">Item Strength Profile</h2>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
        A quick view of rank, gain, readiness, and item-level confidence signals.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Signal
          label="CURRENT VALUE"
          value={formatMoney(currentValue)}
          sublabel="Tracked market value"
        />
        <Signal
          label="TOTAL COST"
          value={formatMoney(cost)}
          sublabel="Purchase basis"
        />
        <Signal
          label="NET GAIN"
          value={`${gain >= 0 ? "+" : ""}${formatMoney(gain)}`}
          sublabel="Current delta"
        />
        <Signal
          label="READINESS"
          value={readinessTone(readiness)}
          sublabel="Item intelligence readiness"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]">
          <div className="text-sm font-semibold">Rank Signals</div>

          {intelligence ? (
            <div className="mt-4 grid gap-4">
              <ScoreBar label="Value Score" value={intelligence.valueScore} />
              <ScoreBar label="Gain Score" value={intelligence.gainScore} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="vltd-panel-soft rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
                  <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
                    VALUE RANK
                  </div>
                  <div className="mt-2 text-xl font-semibold">
                    #{intelligence.valueRank}
                  </div>
                </div>

                <div className="vltd-panel-soft rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
                  <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
                    GAIN RANK
                  </div>
                  <div className="mt-2 text-xl font-semibold">
                    #{intelligence.gainRank}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-[color:var(--muted)]">
              Rank signals appear once the item intelligence map is connected.
            </div>
          )}
        </div>

        <div className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]">
          <div className="text-sm font-semibold">Confidence Signals</div>

          <div className="mt-4 grid gap-3">
            <div className="vltd-panel-soft rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
              <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
                ITEM DETAILS
              </div>
              <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {[item.subtitle, item.number, item.grade].filter(Boolean).join(" • ") || "No additional detail fields yet."}
              </div>
            </div>

            <div className="vltd-panel-soft rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
              <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
                PROVENANCE / STORAGE
              </div>

              {provenanceSignals.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {provenanceSignals.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-[color:var(--muted)]">
                  Add certs, source, notes, and storage to strengthen item confidence.
                </div>
              )}
            </div>

            <div className="vltd-panel-soft rounded-[18px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
              <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
                NOTES
              </div>
              <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {item.notes?.trim() || "No item notes yet."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}