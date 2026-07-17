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
  | "shield";

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
};

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
