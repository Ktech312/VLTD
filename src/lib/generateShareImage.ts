export type ShareImageInput = {
  title: string;
  subtitle?: string;
  value: number;
  profit: number;
  image?: string;
  watermark?: boolean;
  username?: string;
};

const CANVAS_SIZE = 1080;
const BG = "#0B0F14";
const SURFACE = "#111827";
const BORDER = "rgba(255,255,255,0.12)";

function formatMoney(value: number) {
  const rounded = Math.round(Number(value) || 0);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function drawCoverImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const imgRatio = img.width / img.height;
  const boxRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > boxRatio) {
    drawHeight = height;
    drawWidth = height * imgRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / imgRatio;
    offsetY = (height - drawHeight) / 2;
  }

  ctx.drawImage(img, x + offsetX, y + offsetY, drawWidth, drawHeight);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image could not be loaded for share card."));
    img.src = src;
  });
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }

    if (current) lines.push(current);
    current = word;

    if (lines.length === maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);

  lines.slice(0, maxLines).forEach((line, index) => {
    const safeLine = index === maxLines - 1 && lines.length === maxLines && words.length > line.split(/\s+/).length
      ? `${line.replace(/\s+\S+$/, "")}…`
      : line;
    ctx.fillText(safeLine, x, y + index * lineHeight);
  });

  return lines.length;
}

function drawBase(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  gradient.addColorStop(0, "#06151E");
  gradient.addColorStop(0.5, BG);
  gradient.addColorStop(1, "#05070A");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.fillStyle = "rgba(34,211,238,0.08)";
  ctx.beginPath();
  ctx.arc(880, 120, 260, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.035)";
  roundedRect(ctx, 70, 70, 940, 940, 44);
  ctx.fill();

  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  roundedRect(ctx, 70, 70, 940, 940, 44);
  ctx.stroke();
}

function drawImagePlaceholder(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = SURFACE;
  roundedRect(ctx, 140, 120, 800, 500, 32);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  roundedRect(ctx, 140, 120, 800, 500, 32);
  ctx.stroke();
  ctx.fillStyle = "#6B7280";
  ctx.font = "700 32px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("VLTD ITEM", 540, 385);
  ctx.textAlign = "left";
}

async function drawShareCard(ctx: CanvasRenderingContext2D, item: ShareImageInput, includeImage: boolean) {
  drawBase(ctx);

  if (includeImage && item.image) {
    try {
      const img = await loadImage(item.image);
      ctx.save();
      roundedRect(ctx, 140, 120, 800, 500, 32);
      ctx.clip();
      drawCoverImage(ctx, img, 140, 120, 800, 500);
      ctx.restore();
    } catch {
      drawImagePlaceholder(ctx);
    }
  } else {
    drawImagePlaceholder(ctx);
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 54px Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  drawWrappedText(ctx, item.title || "Untitled Item", 140, 710, 800, 60, 2);

  if (item.subtitle) {
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "500 30px Inter, system-ui, sans-serif";
    drawWrappedText(ctx, item.subtitle, 140, 820, 800, 38, 1);
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 68px Inter, system-ui, sans-serif";
  ctx.fillText(formatMoney(item.value), 140, 910);

  ctx.fillStyle = item.profit >= 0 ? "#22C55E" : "#EF4444";
  ctx.font = "800 38px Inter, system-ui, sans-serif";
  ctx.fillText(`${item.profit >= 0 ? "+" : ""}${formatMoney(item.profit)}`, 140, 960);

  if (item.username) {
    ctx.fillStyle = "#CBD5E1";
    ctx.font = "600 26px Inter, system-ui, sans-serif";
    ctx.fillText(`@${item.username.replace(/^@+/, "")}`, 140, 1000);
  }

  if (item.watermark !== false) {
    ctx.fillStyle = "#6B7280";
    ctx.font = "800 32px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("VLTD", 940, 1000);
    ctx.textAlign = "left";
  }
}

export async function generateShareImage(item: ShareImageInput) {
  if (typeof document === "undefined") return undefined;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  await drawShareCard(ctx, item, true);

  try {
    return canvas.toDataURL("image/png");
  } catch {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    await drawShareCard(ctx, item, false);
    return canvas.toDataURL("image/png");
  }
}
