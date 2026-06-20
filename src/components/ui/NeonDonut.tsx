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

export default function NeonDonut({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: Array<{ label: string; value: number }>;
}) {
  const w = 1100;
  const h = 260;

  const cx = 200;
  const cy = 130;
  const r = 78;
  const stroke = 20;

  const cleaned = data.map((d) => ({ ...d, value: Math.max(0, clamp(d.value)) }));
  const total = cleaned.reduce((s, d) => s + d.value, 0) || 1;

  // build arc segments (simple polar math)
  let start = -Math.PI / 2;

  function polar(angle: number, radius: number) {
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  }

  function arcPath(a0: number, a1: number) {
    const p0 = polar(a0, r);
    const p1 = polar(a1, r);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl ring-1 ring-[color:var(--border)]">
      <div
        className="p-4"
        style={{
          background:
            "radial-gradient(120% 90% at 30% 0%, rgba(150,21,219,0.18), transparent 55%), radial-gradient(90% 90% at 85% 15%, rgba(82,214,244,0.16), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.25))",
        }}
      >
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
          <defs>
            <linearGradient id="donutGradA" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(82,214,244,0.95)" />
              <stop offset="55%" stopColor="rgba(150,21,219,0.90)" />
              <stop offset="100%" stopColor="rgba(255,120,200,0.85)" />
            </linearGradient>

            <linearGradient id="donutGradB" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(82,214,244,0.85)" />
              <stop offset="55%" stopColor="rgba(255,120,200,0.80)" />
              <stop offset="100%" stopColor="rgba(150,21,219,0.85)" />
            </linearGradient>

            <filter id="donutGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="7" result="blur" />
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

          {/* Left: donut */}
          <g>
            {/* base ring */}
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={stroke}
            />

            {/* segments */}
            {cleaned.map((d, idx) => {
              const frac = d.value / total;
              const a0 = start;
              const a1 = start + frac * Math.PI * 2;
              start = a1;

              return (
                <path
                  key={`${d.label}-${idx}`}
                  d={arcPath(a0, a1)}
                  fill="none"
                  stroke={idx % 2 === 0 ? "url(#donutGradA)" : "url(#donutGradB)"}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  filter="url(#donutGlow)"
                  opacity={0.95}
                />
              );
            })}

            {/* center label */}
            <text x={cx} y={cy - 6} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize="18" fontFamily="Arial">
              {title}
            </text>
            <text x={cx} y={cy + 18} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="12" fontFamily="Arial">
              Total {fmtShortMoney(cleaned.reduce((s, d) => s + d.value, 0))}
            </text>
          </g>

          {/* Right: legend */}
          <g transform="translate(360, 34)">
            <text x="0" y="0" fill="rgba(255,255,255,0.85)" fontSize="16" fontFamily="Arial">
              {subtitle ?? "Breakdown"}
            </text>

            {cleaned.map((d, idx) => {
              const pct = (d.value / total) * 100;
              const y = 28 + idx * 26;
              return (
                <g key={`legend-${d.label}-${idx}`} transform={`translate(0, ${y})`}>
                  <rect
                    x="0"
                    y="-12"
                    width="14"
                    height="14"
                    rx="6"
                    fill={idx % 2 === 0 ? "rgba(82,214,244,0.85)" : "rgba(150,21,219,0.85)"}
                    opacity={0.9}
                  />
                  <text x="22" y="0" fill="rgba(255,255,255,0.75)" fontSize="13" fontFamily="Arial">
                    {d.label}
                  </text>
                  <text x="340" y="0" textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="13" fontFamily="Arial">
                    {fmtShortMoney(d.value)} • {pct.toFixed(1)}%
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}