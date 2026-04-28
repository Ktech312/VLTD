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
const OUTER_PADDING = 48;
const CONTENT_WIDTH = CANVAS_SIZE - OUTER_PADDING * 2;
const IMAGE_TOP = 48;
const IMAGE_HEIGHT = 720;
const FOOTER_TOP = 800;
const FOOTER_HEIGHT = 232;

function formatMoney(value: number) {
  const rounded = Math.round(Number(value) || 0);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}$${Math.abs(rounded).toLocaleString("en-US")}`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safe = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safe, y);
  ctx.lineTo(x + width - safe, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safe);
  ctx.lineTo(x + width, y + height - safe);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safe, y + height);
  ctx.lineTo(x + safe, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safe);
  ctx.lineTo(x, y + safe);
  ctx.quadraticCurveTo(x, y, x + safe, y);
  ctx.closePath();
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  bg.addColorStop(0, "#09131B");
  bg.addColorStop(0.55, "#0B0F14");
  bg.addColorStop(1, "#05070B");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.fillStyle = "rgba(34,211,238,0.05)";
  ctx.beginPath();
  ctx.arc(905, 150, 210, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  roundedRect(ctx, OUTER_PADDING, OUTER_PADDING, CONTENT_WIDTH, CANVAS_SIZE - OUTER_PADDING * 2, 32);
  ctx.fill();
}

function drawFooterPanel(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "rgba(10,15,22,0.88)";
  roundedRect(ctx, OUTER_PADDING, FOOTER_TOP, CONTENT_WIDTH, FOOTER_HEIGHT, 28);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  roundedRect(ctx, OUTER_PADDING, FOOTER_TOP, CONTENT_WIDTH, FOOTER_HEIGHT, 28);
  ctx.stroke();
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
  let current = words[0];

  for (let i = 1; i < words.length; i += 1) {
    const test = `${current} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
      continue;
    }
    lines.push(current);
    current = words[i];
    if (lines.length === maxLines - 1) break;
  }

  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  const remainingWords = words.slice(consumed);
  if (remainingWords.length > 0 && lines.length < maxLines) {
    let lastLine = remainingWords.join(" ");
    while (ctx.measureText(lastLine).width > maxWidth && lastLine.includes(" ")) {
      lastLine = lastLine.replace(/\s+\S+$/, "");
    }
    if (consumed + remainingWords.length < words.length || lastLine !== remainingWords.join(" ")) {
      lastLine = `${lastLine.replace(/\s+$/, "")}…`;
    }
    lines.push(lastLine);
  }

  lines.slice(0, maxLines).forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return Math.min(lines.length, maxLines);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image."));
    img.src = src;
  });
}

function imageFrameForAspect(ratio: number) {
  if (ratio <= 1.1) {
    const width = 720;
    return {
      x: (CANVAS_SIZE - width) / 2,
      y: IMAGE_TOP,
      width,
      height: IMAGE_HEIGHT,
      radius: 28,
    };
  }

  return {
    x: OUTER_PADDING,
    y: IMAGE_TOP,
    width: CONTENT_WIDTH,
    height: 670,
    radius: 28,
  };
}

function drawImagePlaceholder(ctx: CanvasRenderingContext2D) {
  const frame = {
    x: 180,
    y: IMAGE_TOP,
    width: 720,
    height: IMAGE_HEIGHT,
    radius: 28,
  };

  ctx.fillStyle = "rgba(7,10,15,0.95)";
  roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius);
  ctx.stroke();

  ctx.fillStyle = "#8A94A6";
  ctx.font = "700 30px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("VLTD ITEM", CANVAS_SIZE / 2, 390);
  ctx.textAlign = "left";
}

function drawContained(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const inset = 10;
  const innerX = x + inset;
  const innerY = y + inset;
  const innerWidth = width - inset * 2;
  const innerHeight = height - inset * 2;

  const imgRatio = img.width / img.height;
  const boxRatio = innerWidth / innerHeight;

  let drawWidth: number;
  let drawHeight: number;
  if (imgRatio > boxRatio) {
    drawWidth = innerWidth;
    drawHeight = drawWidth / imgRatio;
  } else {
    drawHeight = innerHeight;
    drawWidth = drawHeight * imgRatio;
  }

  const drawX = innerX + (innerWidth - drawWidth) / 2;
  const drawY = innerY + (innerHeight - drawHeight) / 2;

  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

async function drawItemImage(ctx: CanvasRenderingContext2D, image?: string) {
  if (!image) {
    drawImagePlaceholder(ctx);
    return;
  }

  try {
    const img = await loadImage(image);
    const frame = imageFrameForAspect(img.width / img.height);

    ctx.fillStyle = "rgba(7,10,15,0.96)";
    roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 2;
    roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius);
    ctx.stroke();

    ctx.save();
    roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, frame.radius);
    ctx.clip();
    drawContained(ctx, img, frame.x, frame.y, frame.width, frame.height);
    ctx.restore();
  } catch {
    drawImagePlaceholder(ctx);
  }
}

function drawTextLayer(ctx: CanvasRenderingContext2D, item: ShareImageInput) {
  drawFooterPanel(ctx);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 52px Inter, system-ui, sans-serif";
  drawWrappedText(ctx, item.title || "Untitled Item", 84, 870, 650, 58, 2);

  if (item.subtitle) {
    ctx.fillStyle = "#9CA3AF";
    ctx.font = "500 28px Inter, system-ui, sans-serif";
    drawWrappedText(ctx, item.subtitle, 84, 948, 650, 34, 1);
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 64px Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(formatMoney(item.value), 980, 905);

  ctx.fillStyle = item.profit >= 0 ? "#22C55E" : "#EF4444";
  ctx.font = "800 34px Inter, system-ui, sans-serif";
  ctx.fillText(`${item.profit >= 0 ? "+" : ""}${formatMoney(item.profit)}`, 980, 950);

  ctx.fillStyle = "#7A8495";
  ctx.font = "700 22px Inter, system-ui, sans-serif";
  if (item.username) {
    ctx.textAlign = "left";
    ctx.fillText(`@${item.username.replace(/^@+/, "")}`, 84, 996);
  }

  if (item.watermark !== false) {
    ctx.textAlign = "right";
    ctx.fillText("VLTD", 980, 996);
  }

  ctx.textAlign = "left";
}

async function render(ctx: CanvasRenderingContext2D, item: ShareImageInput, includeImage: boolean) {
  drawBackground(ctx);
  if (includeImage) {
    await drawItemImage(ctx, item.image);
  } else {
    drawImagePlaceholder(ctx);
  }
  drawTextLayer(ctx, item);
}

export async function generateShareImage(item: ShareImageInput) {
  if (typeof document === "undefined") return undefined;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  await render(ctx, item, true);

  try {
    return canvas.toDataURL("image/png");
  } catch {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    await render(ctx, item, false);
    return canvas.toDataURL("image/png");
  }
}
