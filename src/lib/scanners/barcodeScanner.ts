import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  RGBLuminanceSource,
} from "@zxing/library";

export type BarcodeScanResult = {
  rawValue: string;
  digits: string;
  format: "UPC_A" | "UPC_E" | "EAN_13" | "EAN_8" | "UNKNOWN";
  region: string;
};

type ScanRegion = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  scale?: number;
};

function digitsOnly(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
}

async function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image for barcode scan."));
      img.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function drawRegionToCanvas(
  image: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  scale = 1
) {
  const canvas = makeCanvas(sw * scale, sh * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function createReader() {
  const reader = new MultiFormatReader();
  const hints = new Map();

  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
  ]);

  hints.set(DecodeHintType.TRY_HARDER, true);

  reader.setHints(hints);
  return reader;
}

function normalizeFormatName(rawFormat: unknown): BarcodeScanResult["format"] {
  const text = String(rawFormat ?? "").toUpperCase();

  if (text.includes("UPC_A")) return "UPC_A";
  if (text.includes("UPC_E")) return "UPC_E";
  if (text.includes("EAN_13")) return "EAN_13";
  if (text.includes("EAN_8")) return "EAN_8";

  return "UNKNOWN";
}

function decodeCanvas(canvas: HTMLCanvasElement, region: string): BarcodeScanResult | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const source = new RGBLuminanceSource(imageData.data, width, height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const reader = createReader();

  try {
    const result = reader.decode(bitmap);
    const rawValue = String(result.getText?.() ?? "");
    const digits = digitsOnly(rawValue);

    if (!digits) return null;

    return {
      rawValue,
      digits,
      format: normalizeFormatName(result.getBarcodeFormat?.()),
      region,
    };
  } catch (error) {
    if (error instanceof NotFoundException) return null;
    return null;
  } finally {
    reader.reset();
  }
}

function toGrayscaleCanvas(sourceCanvas: HTMLCanvasElement, contrastBoost = 0) {
  const canvas = makeCanvas(sourceCanvas.width, sourceCanvas.height);
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx || !ctx) return sourceCanvas;

  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const data = new Uint8ClampedArray(imageData.data);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    let y = Math.round(r * 0.299 + g * 0.587 + b * 0.114);

    if (contrastBoost !== 0) {
      y = y < 128 ? Math.max(0, y - contrastBoost) : Math.min(255, y + contrastBoost);
    }

    data[i] = y;
    data[i + 1] = y;
    data[i + 2] = y;
  }

  ctx.putImageData(new ImageData(data, sourceCanvas.width, sourceCanvas.height), 0, 0);
  return canvas;
}

function tryDecodeVariants(canvas: HTMLCanvasElement, region: string): BarcodeScanResult | null {
  const direct = decodeCanvas(canvas, region);
  if (direct) return direct;

  const gray = toGrayscaleCanvas(canvas, 0);
  const grayResult = decodeCanvas(gray, region);
  if (grayResult) return grayResult;

  const boosted = toGrayscaleCanvas(canvas, 45);
  const boostedResult = decodeCanvas(boosted, region);
  if (boostedResult) return boostedResult;

  return null;
}

function buildRegions(width: number, height: number): ScanRegion[] {
  return [
    {
      name: "full",
      x: 0,
      y: 0,
      w: width,
      h: height,
      scale: 1.4,
    },
    {
      name: "full_2x",
      x: 0,
      y: 0,
      w: width,
      h: height,
      scale: 2,
    },
    {
      name: "bottom_half",
      x: 0,
      y: Math.floor(height * 0.5),
      w: width,
      h: Math.floor(height * 0.5),
      scale: 2,
    },
    {
      name: "bottom_right",
      x: Math.floor(width * 0.55),
      y: Math.floor(height * 0.55),
      w: Math.floor(width * 0.45),
      h: Math.floor(height * 0.45),
      scale: 2.6,
    },
    {
      name: "bottom_right_tight",
      x: Math.floor(width * 0.68),
      y: Math.floor(height * 0.68),
      w: Math.floor(width * 0.32),
      h: Math.floor(height * 0.32),
      scale: 3.2,
    },
    {
      name: "bottom_band",
      x: Math.floor(width * 0.1),
      y: Math.floor(height * 0.72),
      w: Math.floor(width * 0.8),
      h: Math.floor(height * 0.2),
      scale: 2.8,
    },
  ];
}

export async function scanBarcodeFromFile(file: File | Blob): Promise<BarcodeScanResult | null> {
  if (typeof window === "undefined") return null;

  const image = await loadImageFromFile(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) return null;

  const regions = buildRegions(width, height);

  for (const region of regions) {
    if (region.w < 40 || region.h < 40) continue;

    const canvas = drawRegionToCanvas(
      image,
      region.x,
      region.y,
      region.w,
      region.h,
      region.scale ?? 1
    );

    const result = tryDecodeVariants(canvas, region.name);
    if (result) return result;
  }

  return null;
}