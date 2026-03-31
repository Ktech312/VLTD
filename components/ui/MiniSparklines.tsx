"use client";

import React from "react";
import type { UniverseKey } from "@/lib/taxonomy";

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}
function fmtShortMoney(n: number) {
  const v = clamp(n);
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function sparkPath(values: number[], w: number, h: number, pad = 6) {
  const v = values.map(clamp);
  const max = Math.max(1, ...v.map((x) => Math.abs(x)));
  const n = Math.max(2, v.length);

  const xStep = (w - pad * 2) / (n - 1);

  const pts = v.map((val, i) => {
    const mag = Math.abs(val) / max;
    const x = pad + i * xStep;
    const y = pad + (1 - mag) * (h - pad * 2);
    return { x, y };
  });

  return `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
}

function Sparkline({
  values,
  width = 320,
  height = 56,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const path = sparkPath(values, width, height, 7);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(82,214,244,0.95)" />
          <stop offset="55%" stopColor="rgba(150,21,219,0.92)" />
          <stop offset="100%" stopColor="rgba(255,120,200,0.88)" />
        </linearGradient>

        <filter id="sparkGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.8" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 0.65 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* subtle grid */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1="0"
          x2={width}
          y1={t * height}
          y2={t * height}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}

      {/* line */}
      <path d={path} fill="none" stroke="url(#sparkGrad)" strokeWidth="3.5" filter="url(#sparkGlow)" />
    </svg>
  );
}

export default function MiniSparklines({
  monthLabels,
  overall,
  perUniverse,
  universeLabels,
  universes,
  modeLabel,
}: {
  monthLabels: string[];
  overall: number[];
  perUniverse: Record<string, number[]>;
  universeLabels: Record<UniverseKey, string>;
  universes: UniverseKey[];
  modeLabel: string;
}) {
  const totalNow = overall.reduce((s, x) => s + clamp(x), 0);

  return (
    <div className="w-full overflow-hidden rounded-2xl ring-1 ring-[color:var(--border)]">
      <div
        className="p-4"
        style={{
          background:
            "radial-gradient(120% 90% at 30% 0%, rgba(150,21,219,0.18), transparent 55%), radial-gradient(90% 90% at 85% 15%, rgba(82,214,244,0.16), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.25))",
        }}
      >
        {/* overall */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs tracking-widest text-white/50">OVERALL</div>
            <div className="mt-1 text-sm text-white/80">
              12-month {modeLabel} trend • Total {fmtShortMoney(totalNow)}
            </div>
          </div>
          <div className="text-xs text-white/45">{monthLabels.join(" ")}</div>
        </div>

        <div className="mt-3 rounded-2xl bg-black/15 ring-1 ring-white/10 p-3">
          <Sparkline values={overall} width={980} height={70} />
        </div>

        {/* minis */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {universes.map((u) => {
            const series = perUniverse[u] ?? [];
            const sum = series.reduce((s, x) => s + clamp(x), 0);

            return (
              <div key={u} className="rounded-2xl bg-black/12 ring-1 ring-white/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs tracking-widest text-white/50">{universeLabels[u]}</div>
                  <div className="text-xs text-white/60">{fmtShortMoney(sum)}</div>
                </div>
                <div className="mt-2">
                  <Sparkline values={series} width={420} height={54} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}