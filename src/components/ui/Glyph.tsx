import type { CSSProperties, ReactNode } from "react";

// Themed line-art icon set — the house style (thin stroke, currentColor, round
// caps) matching the bottom-nav icons. Use this instead of emoji for UI icons.
// (EK's rule: no generic/emoji icons.)

export type GlyphName =
  | "bell"
  | "message"
  | "exhibition"
  | "bug"
  | "chart"
  | "target"
  | "trophy"
  | "tag"
  | "heart"
  | "bag"
  | "gavel"
  | "search"
  | "box"
  | "sofa"
  | "sparkle"
  | "flame"
  | "key"
  | "cart"
  | "shield"
  | "cards"
  | "music"
  | "gem"
  | "game"
  | "leaf"
  | "star"
  | "car"
  | "palette"
  | "burst"
  | "users"
  | "check"
  | "share"
  | "clock"
  | "eye"
  | "building"
  | "warning"
  | "lock"
  | "megaphone"
  | "camera"
  | "moon"
  | "sun"
  | "frame";

const PATHS: Record<GlyphName, ReactNode> = {
  bell: (<><path d="M6 16v-5a6 6 0 0 1 12 0v5" /><path d="M4.5 16h15" /><path d="M10.4 19a1.7 1.7 0 0 0 3.2 0" /></>),
  message: (<><path d="M5 5h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M8.5 9.5h7M8.5 12h4" /></>),
  exhibition: (<><path d="M4 9 12 4l8 5H4z" /><path d="M6.5 9v8M10 9v8M14 9v8M17.5 9v8" /><path d="M4 18.5h16" /></>),
  bug: (<><path d="M9 4.3 8 2.8M15 4.3 16 2.8" /><circle cx="12" cy="6" r="1.5" /><ellipse cx="12" cy="13.5" rx="4.6" ry="6" /><path d="M12 8v11" /><path d="M7.4 10.5 4.3 9M7.4 13.5 4 13.5M7.4 16.5 4.3 18M16.6 10.5 19.7 9M16.6 13.5 20 13.5M16.6 16.5 19.7 18" /></>),
  chart: (<><path d="M4 20h16" /><path d="M7.5 20v-5M12 20V8.5M16.5 20v-8" /></>),
  target: (<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.7" fill="currentColor" stroke="none" /></>),
  trophy: (<><path d="M8 4h8v4a4 4 0 0 1-8 0z" /><path d="M8 6H5.5v1a3 3 0 0 0 3 3M16 6h2.5v1a3 3 0 0 1-3 3" /><path d="M12 12v4" /><path d="M9 20h6M9.8 20l.7-4M14.2 20l-.7-4" /></>),
  tag: (<><path d="M4 4.5h7l9 9-6.5 6.5-9-9z" /><circle cx="8" cy="8.5" r="1.4" /></>),
  heart: (<><path d="M12 20s-7-4.4-7-9.4A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 7 2.6C19 15.6 12 20 12 20z" /></>),
  bag: (<><path d="M6.5 8h11l-1 11.5h-9z" /><path d="M9 8a3 3 0 0 1 6 0" /></>),
  gavel: (<><path d="M13.5 4.5l6 6-3 3-6-6z" /><path d="M10.5 7.5 4.5 13.5" /><path d="M4 20h9" /><path d="M6.5 16l3 3" /></>),
  search: (<><circle cx="11" cy="11" r="6.2" /><path d="M20 20l-4.4-4.4" /></>),
  box: (<><path d="M4 8 12 4l8 4-8 4z" /><path d="M4 8v8l8 4 8-4V8" /><path d="M12 12v8" /></>),
  sofa: (<><path d="M4 14v-2.5A2.5 2.5 0 0 1 6.5 9h11A2.5 2.5 0 0 1 20 11.5V14" /><rect x="3.5" y="13.5" width="17" height="4.5" rx="1.3" /><path d="M6.5 18v1.6M17.5 18v1.6" /></>),
  sparkle: (<><path d="M12 4l1.7 4.6L18 10l-4.3 1.4L12 16l-1.7-4.6L6 10l4.3-1.4z" /></>),
  flame: (<><path d="M12 4c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 .4 1 1 1.6 2 2 0-2-1-4 0-6z" /></>),
  key: (<><circle cx="8" cy="8" r="3.4" /><path d="M10.4 10.4 20 20" /><path d="M16 16l2-2M18.5 18.5l1.5-1.5" /></>),
  cart: (<><path d="M4 5h2l2 10h9l2-7H7" /><circle cx="9" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>),
  shield: (<><path d="M12 3 5 6v5c0 4.4 3 7.4 7 8.9 4-1.5 7-4.5 7-8.9V6z" /><path d="M9.2 12l1.9 1.9 3.7-3.8" /></>),
  cards: (<><rect x="5" y="7" width="9" height="12.5" rx="1.6" /><path d="M8.6 7 15 5l3 11" /><path d="M7.5 11h4M7.5 14h2.5" /></>),
  music: (<><path d="M9 17V6l10-2v9" /><circle cx="6.5" cy="17" r="2.5" /><circle cx="16.5" cy="15" r="2.5" /></>),
  gem: (<><path d="M6 4h12l4 5-10 11L2 9z" /><path d="M2 9h20" /><path d="M9 4 12 20 15 4" /></>),
  game: (<><rect x="3" y="8.5" width="18" height="8" rx="4" /><path d="M7 11.5v3M5.5 13h3" /><circle cx="15.5" cy="12" r="0.9" fill="currentColor" stroke="none" /><circle cx="18" cy="14" r="0.9" fill="currentColor" stroke="none" /></>),
  leaf: (<><path d="M5 19C5 11 10 6 19 5c1 9-4 15-14 14z" /><path d="M6 18c3-4 6-7 9-8" /></>),
  star: (<><path d="M12 4l2.3 5.2 5.7.5-4.3 3.8 1.3 5.5L12 16.9 7 19l1.3-5.5L4 9.7l5.7-.5z" /></>),
  car: (<><path d="M4 15l1.6-5h12.8L20 15" /><path d="M3.5 15h17v3h-2.5v-1.2H6V18H3.5z" /><circle cx="8" cy="16.5" r="1.4" /><circle cx="16" cy="16.5" r="1.4" /></>),
  palette: (<><path d="M12 4a8 8 0 1 0 0 16c.9 0 1.4-.7 1.4-1.6 0-1.4 1-1.9 2.3-1.9A4 4 0 0 0 20 12a8 8 0 0 0-8-8z" /><circle cx="8.5" cy="10.5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="8.5" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="10.5" r="1" fill="currentColor" stroke="none" /></>),
  burst: (<><path d="M12 3l1.7 3.3 3.5-1.1-.8 3.6 3.6.6-2.5 2.8 2.5 2.8-3.6.6.8 3.6-3.5-1.1L12 21l-1.7-3.3-3.5 1.1.8-3.6-3.6-.6 2.5-2.8-2.5-2.8 3.6-.6-.8-3.6 3.5 1.1z" /></>),
  users: (<><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6M15.5 13.2a5.5 5.5 0 0 1 5 5.8" /></>),
  check: (<><circle cx="12" cy="12" r="8.5" /><path d="M8 12l2.6 2.6L16 9.2" /></>),
  share: (<><path d="M4 12.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6.5" /><path d="M12 15V4M8 8l4-4 4 4" /></>),
  clock: (<><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>),
  eye: (<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.6" /></>),
  building: (<><path d="M5 20V7l7-3 7 3v13" /><path d="M3 20h18" /><path d="M9 10h1M14 10h1M9 13.5h1M14 13.5h1" /><path d="M10.5 20v-3.5h3V20" /></>),
  warning: (<><path d="M12 3.5 21 19H3z" /><path d="M12 9.5v4.5M12 16.8h.01" /></>),
  lock: (<><rect x="4.5" y="11" width="15" height="9.5" rx="1.8" /><path d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11" /></>),
  megaphone: (<><path d="M3 10v4a1 1 0 0 0 1 1h2l9 4.5V4.5L6 9H4a1 1 0 0 0-1 1z" /><path d="M17 9.5a3.5 3.5 0 0 1 0 5" /></>),
  camera: (<><path d="M4 8h2.5l1.3-2h8.4l1.3 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.2" /></>),
  moon: (<><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" /></>),
  sun: (<><circle cx="12" cy="12" r="4.2" /><path d="M12 3v2.2M12 18.8V21M4.2 12H3M21 12h-1.2M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M5.9 18.1l1.5-1.5M16.6 7.4l1.5-1.5" /></>),
  frame: (<><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="m7.5 15.5 3-3.5 2.5 2.5 3.5-4.5 2.5 3.5" /></>),
};

// Map a common emoji to the closest themed glyph (for legacy emoji lookups).
export function emojiGlyphName(emoji: string): GlyphName {
  const map: Record<string, GlyphName> = {
    "👥": "users", "📊": "chart", "📈": "chart", "✅": "check", "🎯": "target",
    "🏷️": "tag", "🏷": "tag", "🔍": "search", "📤": "share", "🕐": "clock",
    "🗝️": "key", "🗝": "key", "🛒": "cart", "🃏": "cards", "🏆": "trophy",
    "🎵": "music", "💎": "gem", "🎮": "game", "🎭": "burst", "🎨": "palette",
    "🌿": "leaf", "🚗": "car", "🔨": "gavel", "🔔": "bell", "🐛": "bug",
    "⚠": "warning", "⚠️": "warning", "🔒": "lock", "🔐": "lock", "📣": "megaphone",
    "📷": "camera", "📸": "camera", "🎬": "camera", "🌙": "moon", "☀️": "sun",
    "🖼": "frame", "🖼️": "frame", "⭐": "star", "🔥": "flame", "👁": "eye",
    "👁️": "eye", "⏱": "clock", "⏱️": "clock", "⏰": "clock", "📲": "share",
  };
  return map[emoji] ?? "star";
}

// Map a universe/category key to a themed glyph (replaces the old emoji map).
export function universeGlyphName(universe: string): GlyphName {
  const u = (universe || "").toUpperCase();
  if (u.includes("POP") || u.includes("COMIC")) return "burst";
  if (u.includes("SPORT")) return "trophy";
  if (u === "TCG" || u.includes("CARD")) return "cards";
  if (u.includes("MUSIC") || u.includes("VINYL")) return "music";
  if (u.includes("JEWEL") || u.includes("APPAREL")) return "gem";
  if (u.includes("GAME")) return "game";
  if (u.includes("BOTANY") || u.includes("BUILT")) return "leaf";
  if (u.includes("AUTO")) return "car";
  if (u.includes("ART")) return "palette";
  return "star";
}

export function Glyph({
  name,
  size = 24,
  className,
  style,
  strokeWidth = 1.6,
}: {
  name: GlyphName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {PATHS[name]}
    </svg>
  );
}
