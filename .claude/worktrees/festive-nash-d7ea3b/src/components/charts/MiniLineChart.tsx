// Path: src/components/charts/MiniLineChart.tsx
"use client";

import * as React from "react";

export default function MiniLineChart({
  values,
  height = 80,
  width = 600,
  stroke = "rgba(82,214,244,0.95)",
}: {
  values: number[];
  height?: number;
  width?: number;
  stroke?: string;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // IMPORTANT:
  // - Render the SAME thing on SSR and the first client render
  // - Then upgrade to SVG after mount to avoid hydration mismatch.
  if (!mounted || !values || values.length < 2) {
    return <div className="text-sm text-[color:var(--muted)]">—</div>;
  }

  const w = Math.max(1, width);
  const h = Math.max(1, height);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-9, max - min);

  const stepX = w / (values.length - 1);

  const pts = values
    .map((v, i) => {
      const x = i * stepX;
      const y = h - ((v - min) / span) * (h - 6) - 3; // 3px vertical padding
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full block opacity-95" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2.5" />
    </svg>
  );
}