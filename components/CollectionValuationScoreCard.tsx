"use client";

import type { CollectionValuationScore } from "@/lib/collectionValuationScore";

type Props = {
  score: CollectionValuationScore;
};

function Ring({
  value,
  band,
}: {
  value: number;
  band: string;
}) {
  const safe = Math.max(0, Math.min(100, value));
  const angle = (safe / 100) * 360;

  return (
    <div
      className="relative h-40 w-40 rounded-full ring-1 ring-white/10"
      style={{
        background: `conic-gradient(rgba(82,214,244,0.95) 0deg ${angle}deg, rgba(255,255,255,0.08) ${angle}deg 360deg)`,
        boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
      }}
    >
      <div className="absolute inset-6 rounded-full bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]" />
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
            SCORE
          </div>
          <div className="mt-1 text-3xl font-semibold">{safe}</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">{band}</div>
        </div>
      </div>
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
  const width = Math.max(6, Math.min(100, (value / 25) * 100));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm font-semibold">{value}/25</div>
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

function Stat({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="vltd-panel-soft rounded-[20px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
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

export default function CollectionValuationScoreCard({ score }: Props) {
  return (
    <section className="vltd-panel-main rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
        COLLECTION VALUATION SCORE
      </div>

      <h2 className="mt-2 text-2xl font-semibold">Collection Strength Score</h2>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
        A platform-level score based on value, performance, diversification, and collection maturity.
      </p>

      <div className="mt-5 grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <div className="vltd-panel-soft flex flex-col items-center justify-center rounded-[22px] bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]">
          <Ring value={score.totalScore} band={score.band} />
          <div className="mt-4 text-center text-sm leading-6 text-[color:var(--muted)]">
            {score.summary}
          </div>
        </div>

        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat
              label="TOTAL VALUE"
              value={`$${Math.round(score.signals.totalValue).toLocaleString()}`}
              sublabel="Tracked collection value"
            />
            <Stat
              label="ROI"
              value={`${score.signals.roi >= 0 ? "+" : ""}${score.signals.roi.toFixed(1)}%`}
              sublabel="Current return on cost basis"
            />
            <Stat
              label="DIVERSITY"
              value={`${score.signals.universes} / ${score.signals.categories}`}
              sublabel="Universes / categories"
            />
            <Stat
              label="TOP SEGMENT"
              value={`${score.signals.topSegmentConcentrationPct}%`}
              sublabel="Largest value concentration"
            />
          </div>

          <div className="vltd-panel-soft rounded-[22px] bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]">
            <div className="text-sm font-semibold">Score Breakdown</div>

            <div className="mt-4 grid gap-4">
              <ScoreBar label="Value Strength" value={score.breakdown.valueStrength} />
              <ScoreBar label="Performance Strength" value={score.breakdown.performanceStrength} />
              <ScoreBar label="Diversification Strength" value={score.breakdown.diversificationStrength} />
              <ScoreBar label="Quality Strength" value={score.breakdown.qualityStrength} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}