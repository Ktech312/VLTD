export type ScanCropRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

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
