export type ScanCropRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

/**
 * Fit a crop rect around the visible subject of an image by reading its alpha
 * channel — used after background removal, where everything outside the item
 * is transparent. Returns edge insets (0–1); a small margin keeps it from being
 * razor-tight. Falls back to a full crop if the image can't be read or is empty.
 */
export async function computeSubjectCrop(
  file: File,
  opts: { alphaThreshold?: number; margin?: number } = {},
): Promise<ScanCropRect> {
  const full: ScanCropRect = { left: 0, top: 0, right: 0, bottom: 0 };
  if (typeof document === "undefined") return full;
  const alphaThreshold = opts.alphaThreshold ?? 24;
  const margin = opts.margin ?? 0.04;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image load failed"));
      el.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return full;

    // Downscale for a fast scan; the bbox is proportional so precision holds.
    const scale = Math.min(1, 512 / Math.max(w, h));
    const sw = Math.max(1, Math.round(w * scale));
    const sh = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return full;
    ctx.drawImage(img, 0, 0, sw, sh);
    const data = ctx.getImageData(0, 0, sw, sh).data;

    let minX = sw;
    let minY = sh;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (data[(y * sw + x) * 4 + 3] > alphaThreshold) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    // Fully transparent (or opaque everywhere) → nothing useful to fit.
    if (maxX < 0 || maxY < 0) return full;

    const clampInset = (v: number) => Math.min(0.45, Math.max(0, v));
    return {
      left: clampInset(minX / sw - margin),
      top: clampInset(minY / sh - margin),
      right: clampInset(1 - (maxX + 1) / sw - margin),
      bottom: clampInset(1 - (maxY + 1) / sh - margin),
    };
  } catch {
    return full;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeCrop(crop: ScanCropRect) {
  const minSize = 0.02;
  const left = clamp(Number(crop.left ?? 0), 0, 1 - minSize);
  const top = clamp(Number(crop.top ?? 0), 0, 1 - minSize);
  const right = clamp(Number(crop.right ?? 0), 0, 1 - left - minSize);
  const bottom = clamp(Number(crop.bottom ?? 0), 0, 1 - top - minSize);

  return { left, top, right, bottom };
}

async function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image for cropping."));
      img.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function cropImageFile(
  file: File,
  crop: ScanCropRect
): Promise<File> {
  const image = await loadImageFromFile(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const normalizedCrop = normalizeCrop(crop);

  const sx = Math.max(0, Math.floor(width * normalizedCrop.left));
  const sy = Math.max(0, Math.floor(height * normalizedCrop.top));
  const sw = Math.max(1, Math.floor(width * (1 - normalizedCrop.left - normalizedCrop.right)));
  const sh = Math.max(1, Math.floor(height * (1 - normalizedCrop.top - normalizedCrop.bottom)));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable for scan crop.");

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (next) resolve(next);
        else reject(new Error("Failed to export cropped image."));
      },
      file.type || "image/jpeg",
      0.92
    );
  });

  return new File([blob], file.name || "scan-crop.jpg", {
    type: blob.type || file.type || "image/jpeg",
    lastModified: Date.now(),
  });
}
