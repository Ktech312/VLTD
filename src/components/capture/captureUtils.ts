export type BlurAssessment = {
  score: number;
  isBlurry: boolean;
};

const BLUR_THRESHOLD = 18;

export function assessCanvasBlur(canvas: HTMLCanvasElement): BlurAssessment {
  const width = Math.min(240, canvas.width);
  const height = Math.min(240, canvas.height);
  if (width < 3 || height < 3) return { score: 0, isBlurry: false };

  const scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { score: 0, isBlurry: false };

  ctx.drawImage(canvas, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  let total = 0;
  let samples = 0;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const center = luminance(data, width, x, y);
      const horizontal = Math.abs(center * 2 - luminance(data, width, x - 1, y) - luminance(data, width, x + 1, y));
      const vertical = Math.abs(center * 2 - luminance(data, width, x, y - 1) - luminance(data, width, x, y + 1));
      total += horizontal + vertical;
      samples += 1;
    }
  }

  const score = samples > 0 ? total / samples : 0;
  return { score, isBlurry: score < BLUR_THRESHOLD };
}

function luminance(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4;
  return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
}

export async function applyCssFilterToFile(file: File, filter: string) {
  if (!filter.trim()) return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.filter = filter;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, file.type || "image/jpeg", 0.92);
  });

  if (!blob) return file;

  return new File([blob], file.name, {
    type: blob.type || file.type || "image/jpeg",
    lastModified: Date.now(),
  });
}
