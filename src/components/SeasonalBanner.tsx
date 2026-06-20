"use client";

import Link from "next/link";
import { useSeasonalTheme } from "@/components/SeasonalThemeProvider";

export default function SeasonalBanner() {
  const { theme } = useSeasonalTheme();

  if (!theme?.banner_enabled) return null;

  const accent = theme.accent_color ?? "#E8B84B";
  const secondary = theme.accent_secondary ?? "#1a1a2e";

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-5 py-4 mb-4"
      style={{
        background: `linear-gradient(135deg, ${secondary}cc, ${accent}33)`,
        border: `1px solid ${accent}44`,
      }}
    >
      {/* Accent particles */}
      <SeasonalAccents style={theme.accent_style} color={accent} />

      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {theme.banner_emoji && (
            <span className="text-3xl flex-shrink-0">{theme.banner_emoji}</span>
          )}
          <div className="min-w-0">
            {theme.banner_heading && (
              <p className="font-bold text-white text-sm leading-tight truncate">
                {theme.banner_heading}
              </p>
            )}
            {theme.banner_subtext && (
              <p className="text-xs mt-0.5 leading-snug" style={{ color: `${accent}cc` }}>
                {theme.banner_subtext}
              </p>
            )}
          </div>
        </div>

        {theme.banner_cta_label && theme.banner_cta_href && (
          <Link
            href={theme.banner_cta_href}
            className="flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition hover:opacity-90"
            style={{ background: accent, color: "#000" }}
          >
            {theme.banner_cta_label}
          </Link>
        )}
      </div>
    </div>
  );
}

function SeasonalAccents({ style, color }: { style: string; color: string }) {
  if (style === "snowflakes") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
        {["10%", "25%", "45%", "65%", "80%", "92%"].map((left, i) => (
          <span
            key={i}
            className="absolute text-lg animate-bounce"
            style={{ left, top: `${(i * 17) % 70}%`, animationDelay: `${i * 0.3}s` }}
          >
            ❄️
          </span>
        ))}
      </div>
    );
  }
  if (style === "confetti") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
        {["8%", "20%", "35%", "55%", "70%", "85%"].map((left, i) => (
          <span
            key={i}
            className="absolute text-sm animate-pulse"
            style={{ left, top: `${(i * 20) % 80}%`, animationDelay: `${i * 0.2}s` }}
          >
            {["🟩", "🟦", "🟨", "⚽", "🏆", "⚽"][i]}
          </span>
        ))}
      </div>
    );
  }
  if (style === "leaves") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-25">
        {["5%", "22%", "40%", "60%", "78%", "90%"].map((left, i) => (
          <span
            key={i}
            className="absolute animate-pulse"
            style={{ left, top: `${(i * 15) % 75}%`, animationDelay: `${i * 0.4}s` }}
          >
            {["🍂", "🍁", "🎃", "🍂", "🍁", "🎃"][i]}
          </span>
        ))}
      </div>
    );
  }
  if (style === "stars") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
        {["12%", "30%", "50%", "68%", "84%"].map((left, i) => (
          <span
            key={i}
            className="absolute animate-ping"
            style={{ left, top: `${(i * 20) % 70}%`, animationDelay: `${i * 0.5}s`, color }}
          >
            ✦
          </span>
        ))}
      </div>
    );
  }
  return null;
}
