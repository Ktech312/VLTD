export type CaptureAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  sharpness: number;
};

export type CaptureFilterPreset = {
  id: string;
  label: string;
  filter: string;
};

export const DEFAULT_CAPTURE_ADJUSTMENTS: CaptureAdjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  sharpness: 0,
};

export const CAPTURE_FILTER_PRESETS: CaptureFilterPreset[] = [
  { id: "original", label: "Original", filter: "" },
  { id: "clean", label: "Clean", filter: "contrast(1.08) saturate(1.06)" },
  { id: "slab", label: "Slab", filter: "brightness(1.04) contrast(1.12) saturate(0.96)" },
  { id: "paper", label: "Paper", filter: "brightness(1.05) contrast(1.05) sepia(0.08)" },
  { id: "vivid", label: "Vivid", filter: "contrast(1.1) saturate(1.22)" },
  { id: "cool", label: "Cool", filter: "brightness(1.02) contrast(1.05) hue-rotate(-8deg)" },
  { id: "warm", label: "Warm", filter: "brightness(1.03) contrast(1.04) sepia(0.14) saturate(1.08)" },
];

export function hasCaptureAdjustments(adjustments: CaptureAdjustments) {
  return (
    adjustments.brightness !== DEFAULT_CAPTURE_ADJUSTMENTS.brightness ||
    adjustments.contrast !== DEFAULT_CAPTURE_ADJUSTMENTS.contrast ||
    adjustments.saturation !== DEFAULT_CAPTURE_ADJUSTMENTS.saturation ||
    adjustments.warmth !== DEFAULT_CAPTURE_ADJUSTMENTS.warmth ||
    adjustments.sharpness !== DEFAULT_CAPTURE_ADJUSTMENTS.sharpness
  );
}

export function buildCaptureFilterCss(
  preset: CaptureFilterPreset,
  adjustments: CaptureAdjustments
) {
  const contrastWithSharpness = adjustments.contrast + adjustments.sharpness;
  const warmth =
    adjustments.warmth > 0
      ? `sepia(${adjustments.warmth / 180}) saturate(${1 + adjustments.warmth / 180})`
      : adjustments.warmth < 0
        ? `hue-rotate(${adjustments.warmth / 4}deg) saturate(${1 + Math.abs(adjustments.warmth) / 360})`
        : "";

  return [
    preset.filter,
    `brightness(${adjustments.brightness}%)`,
    `contrast(${contrastWithSharpness}%)`,
    `saturate(${adjustments.saturation}%)`,
    warmth,
  ]
    .filter(Boolean)
    .join(" ");
}

export function isOriginalCaptureTreatment(
  preset: CaptureFilterPreset,
  adjustments: CaptureAdjustments
) {
  return preset.id === "original" && !hasCaptureAdjustments(adjustments);
}
