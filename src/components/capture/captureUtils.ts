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

export type CaptureBackground = {
  id: string;
  label: string;
  swatch: string;
  fill: string;
};

export const CAPTURE_BACKGROUNDS: CaptureBackground[] = [
  {
    id: "transparent",
    label: "Clear",
    swatch: "repeating-conic-gradient(#3f3f46 0% 25%, #27272a 0% 50%) 0 0 / 14px 14px",
    fill: "transparent",
  },
  { id: "black", label: "Black", swatch: "#050505", fill: "#050505" },
  { id: "white", label: "White", swatch: "#f8fafc", fill: "#f8fafc" },
  {
    id: "vault",
    label: "Vault",
    swatch: "linear-gradient(135deg, #090806 0%, #231808 100%)",
    fill: "vault",
  },
  {
    id: "gold",
    label: "Gold",
    swatch: "linear-gradient(135deg, #171006 0%, #4a3309 100%)",
    fill: "gold",
  },
  {
    id: "slate",
    label: "Slate",
    swatch: "linear-gradient(135deg, #111827 0%, #334155 100%)",
    fill: "slate",
  },
  {
    id: "ruby",
    label: "Ruby",
    swatch: "linear-gradient(135deg, #2b0606 0%, #7f1d1d 100%)",
    fill: "ruby",
  },
  {
    id: "cobalt",
    label: "Cobalt",
    swatch: "linear-gradient(135deg, #0f1d46 0%, #1d4ed8 100%)",
    fill: "cobalt",
  },
];

export async function removeBackgroundFromFile(file: File) {
  const { removeBackground } = await import("@imgly/background-removal");
  const result = await removeBackground(file);
  return new File([result], replaceExtension(file.name, "png"), {
    type: "image/png",
    lastModified: Date.now(),
  });
}

export async function compositeBackgroundToFile(file: File, background: CaptureBackground) {
  if (background.id === "transparent") return file;

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  paintBackground(ctx, canvas.width, canvas.height, background.fill);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });

  if (!blob) return file;

  return new File([blob], replaceExtension(file.name, "jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fill: string
) {
  if (fill.startsWith("#")) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  if (fill === "gold") {
    gradient.addColorStop(0, "#171006");
    gradient.addColorStop(0.6, "#2f2208");
    gradient.addColorStop(1, "#5f440d");
  } else if (fill === "slate") {
    gradient.addColorStop(0, "#111827");
    gradient.addColorStop(1, "#334155");
  } else if (fill === "ruby") {
    gradient.addColorStop(0, "#2b0606");
    gradient.addColorStop(1, "#7f1d1d");
  } else if (fill === "cobalt") {
    gradient.addColorStop(0, "#0f1d46");
    gradient.addColorStop(1, "#1d4ed8");
  } else {
    gradient.addColorStop(0, "#090806");
    gradient.addColorStop(1, "#231808");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function replaceExtension(name: string, extension: "jpg" | "png") {
  const base = name.replace(/\.[^.]+$/, "") || "camera-capture";
  return `${base}.${extension}`;
}
