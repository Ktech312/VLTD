"use client";

import React from "react";

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

export default function NeonBarChart({
  labels,
  values,
  height = 220,
}: {
  labels: string[];
  values: number[];
  height?: number;
}) {
  const w = 1100;
  const h = Math.max(160, height);

  const padL = 56;
  const padR = 18;
  const padT = 18;
  const padB = 44;

  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const safe = values.map((v) => (Number.isFinite(v) ? v : 0));
  const max = Math.max(1, ...safe.map((v) => Math.abs(v)));

  const barCount = Math.max(1, labels.length);
  const gap = Math.max(10, Math.floor(chartW / (barCount * 7)));
  const barW = Math.max(18, Math.floor((chartW - gap * (barCount - 1)) / barCount));

  const gridLines = 5;

  return (
    <div className="w-full overflow-hidden rounded-2xl ring-1 ring-[color:var(--border)]">
      <div
        className="p-3"
        style={{
          background:
            "radial-gradient(120% 90% at 30% 0%, rgba(150,21,219,0.18), transparent 55%), radial-gradient(90% 90% at 85% 15%, rgba(82,214,244,0.16), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.25))",
        }}
      >
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
          <defs>
            {/* neon gradients */}
            <linearGradient id="vltdBar" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(82,214,244,0.95)" />
              <stop offset="45%" stopColor="rgba(150,21,219,0.90)" />
              <stop offset="100%" stopColor="rgba(255,120,200,0.85)" />
            </linearGradient>

            <linearGradient id="vltdGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(82,214,244,0.35)" />
              <stop offset="100%" stopColor="rgba(150,21,219,0.18)" />
            </linearGradient>

            <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.7 0"
                result="glow"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* grid */}
          {Array.from({ length: gridLines + 1 }).map((_, idx) => {
            const y = padT + (chartH * idx) / gridLines;
            return (
              <line
                key={idx}
                x1={padL}
                x2={w - padR}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
            );
          })}

          {/* axis labels */}
          <text x={padL} y={padT - 4} fill="rgba(255,255,255,0.55)" fontSize="12" fontFamily="Arial">
            {fmtShortMoney(max)}
          </text>
          <text x={padL} y={padT + chartH + 22} fill="rgba(255,255,255,0.35)" fontSize="12" fontFamily="Arial">
            0
          </text>

          {/* bars */}
          {labels.map((label, i) => {
            const v = clamp(values[i] ?? 0);
            const mag = Math.abs(v) / max;
            const barH = Math.max(2, Math.round(chartH * mag));
            const x = padL + i * (barW + gap);
            const y = padT + (chartH - barH);

            return (
              <g key={label}>
                {/* glow layer */}
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={10}
                  fill="url(#vltdGlow)"
                  filter="url(#softGlow)"
                  opacity={0.9}
                />

                {/* main bar */}
                <rect x={x} y={y} width={barW} height={barH} rx={10} fill="url(#vltdBar)" opacity={0.9} />

                {/* value */}
                <text
                  x={x + barW / 2}
                  y={y - 8}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.78)"
                  fontSize="12"
                  fontFamily="Arial"
                >
                  {fmtShortMoney(v)}
                </text>

                {/* label */}
                <text
                  x={x + barW / 2}
                  y={padT + chartH + 30}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.55)"
                  fontSize="12"
                  fontFamily="Arial"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}