import type { CSSProperties } from "react";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";

// Backward-compatible shim. The real icon system now lives in AppIcon.tsx
// (one shared component, semantic names, compact/feature variants) so it
// can be changed in one place. This file exists only so the ~50 existing
// `import { Glyph } from "@/components/ui/Glyph"` call sites keep working
// unchanged — new code should import AppIcon directly.
export { emojiGlyphName, universeGlyphName, type AppIconName as GlyphName } from "@/components/ui/AppIcon";

export function Glyph({
  name,
  size = 24,
  className,
  style,
  strokeWidth = 1.6,
}: {
  name: AppIconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}) {
  return <AppIcon name={name} variant="compact" size={size} className={className} style={style} strokeWidth={strokeWidth} />;
}
