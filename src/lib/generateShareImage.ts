export type ShareImageInput = {
  title: string;
  subtitle?: string;
  value: number;
  profit: number;
  image?: string;
  watermark?: boolean;
  username?: string;
  includeFinancials?: boolean;
};

const SIZE = 1080;
const OUTER = 42;
const IMAGE_TOP = 48;
const IMAGE_HEIGHT = 720;
const FOOTER_Y = 800;
const FOOTER_H = 238;

function formatMoney(value: number) {
  const rounded = Math.round(Number(value) || 0);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
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
  if (words.length === 0) return 0;

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      current = testLine;
      continue;
    }

    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  if (current && lines.length < maxLines) {
    let finalLine = current;
    while (ctx.measureText(finalLine).width > maxWidth && finalLine.includes(" ")) {
      finalLine = finalLine.replace(/\s+\S+$/, "");
    }
    if (words.join(" ") !== [...lines, current].join(" ")) {
      finalLine = `${finalLine.replace(/\s+$/, "")}…`;
    }
    lines.push(finalLine);
  }

  lines.slice(0, maxLines).forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return Math.min(lines.length, maxLines);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = src;
  });
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  gradient.addColorStop(0, "#08131C");
  gradient.addColorStop(0.55, "#0B0F14");
  gradient.addColorStop(1, "#05070A");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.fillStyle = "rgba(34,211,238,0.05)";
  ctx.beginPath();
  ctx.arc(900, 150, 215, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  roundedRect(ctx, OUTER, OUTER, SIZE - OUTER * 2, SIZE - OUTER * 2, 28);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  roundedRect(ctx, OUTER, OUTER, SIZE - OUTER * 2, SIZE - OUTER * 2, 28);
  ctx.stroke();
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(8,12,18,0.9)";
  roundedRect(ctx, OUTER + 12, FOOTER_Y, SIZE - (OUTER + 12) * 2, FOOTER_H, 24);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1.5;
  roundedRect(ctx, OUTER + 12, FOOTER_Y, SIZE - (OUTER + 12) * 2, FOOTER_H, 24);
  ctx.stroke();
}

function getPortraitFrame(ratio: number) {
  const maxInnerHeight = IMAGE_HEIGHT - 12;
  const drawHeight = maxInnerHeight;
  const drawWidth = drawHeight * ratio;
  const frameWidth = Math.max(Math.min(drawWidth + 30, 860), 420);
  const frameX = (SIZE - frameWidth) / 2;
  return {
    x: frameX,
    y: IMAGE_TOP,
    width: frameWidth,
    height: IMAGE_HEIGHT,
    radius: 24,
  };
}

function getLandscapeFrame() {
  return {
    x: OUTER + 18,
    y: IMAGE_TOP,
    width: SIZE - (OUTER + 18) * 2,
    height: 650,
    radius: 24,
  };
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const pad = 8;
  const innerX = x + pad;
  const innerY = y + pad;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const imgRatio = image.width / image.height;
  const boxRatio = innerW / innerH;

  let drawW: number;
  let drawH: number;
  if (imgRatio > boxRatio) {
    drawW = innerW;
    drawH = drawW / imgRatio;
  } else {
    drawH = innerH;
    drawW = drawH * imgRatio;
  }

  const drawX = innerX + (innerW - drawW) / 2;
  const drawY = innerY + (innerH - drawH) / 2;

  ctx.drawImage(image, drawX, drawY, drawW, drawH);
}

function drawPlaceholder(ctx: CanvasRenderingContext2D) {
  const frame = { x: 300, y: IMAGE_TOP, width: 480, height: IMAGE_HEIGHT, radius: 24 };
  ctx.fillStyle = "rgba(6,10,16,0.96)";
  roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius);
  ctx.stroke();
  ctx.fillStyle = "#7D8797";
  ctx.font = "700 28px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("VLTD ITEM", SIZE / 2, 400);
  ctx.textAlign = "left";
}

async function drawImagePanel(ctx: CanvasRenderingContext2D, imageUrl?: string) {
  if (!imageUrl) {
    drawPlaceholder(ctx);
    return;
  }

  try {
    const img = await loadImage(imageUrl);
    const ratio = img.width / img.height;
    const frame = ratio <= 1.1 ? getPortraitFrame(ratio) : getLandscapeFrame();

    ctx.fillStyle = "rgba(6,10,16,0.96)";
    roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 1.5;
    roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius);
    ctx.stroke();

    ctx.save();
    roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius);
    ctx.clip();
    drawContainedImage(ctx, img, frame.x, frame.y, frame.width, frame.height);
    ctx.restore();
  } catch {
    drawPlaceholder(ctx);
  }
}

function drawText(ctx: CanvasRenderingContext2D, item: ShareImageInput) {
  drawFooter(ctx);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 54px Inter, system-ui, sans-serif";
  drawWrappedText(ctx, item.title || "Untitled Item", 84, 872, 580, 58, 2);

  if (item.subtitle) {
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "500 28px Inter, system-ui, sans-serif";
    drawWrappedText(ctx, item.subtitle, 84, 948, 580, 34, 1);
  }

  if (item.includeFinancials !== false) {
    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 62px Inter, system-ui, sans-serif";
    ctx.fillText(formatMoney(item.value), 978, 900);
    ctx.fillStyle = item.profit >= 0 ? "#22C55E" : "#EF4444";
    ctx.font = "800 34px Inter, system-ui, sans-serif";
    ctx.fillText(`${item.profit >= 0 ? "+" : ""}${formatMoney(item.profit)}`, 978, 946);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#7D8797";
  ctx.font = "700 22px Inter, system-ui, sans-serif";
  if (item.username) {
    ctx.textAlign = "left";
    ctx.fillText(`@${item.username.replace(/^@+/, "")}`, 84, 996);
  }
  if (item.watermark !== false) {
    ctx.textAlign = "right";
    ctx.fillText("VLTD", 978, 996);
  }
  ctx.textAlign = "left";
}

async function render(ctx: CanvasRenderingContext2D, item: ShareImageInput, withImage: boolean) {
  drawBackground(ctx);
  if (withImage) {
    await drawImagePanel(ctx, item.image);
  } else {
    drawPlaceholder(ctx);
  }
  drawText(ctx, item);
}

export async function generateShareImage(item: ShareImageInput) {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  await render(ctx, item, true);
  try {
    return canvas.toDataURL("image/png");
  } catch {
    ctx.clearRect(0, 0, SIZE, SIZE);
    await render(ctx, item, false);
    return canvas.toDataURL("image/png");
  }
}
