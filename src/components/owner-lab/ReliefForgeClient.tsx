"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileImage, FlipVertical2, Ruler, Sparkles, Upload } from "lucide-react";
import earcut from "earcut";

type HeightMode = "light" | "dark";
type ReliefStyle = "logo" | "height";

type MeshResult = {
  aspect: number;
  depthMm: number;
  maxHeightMm: number;
  sampleSize: number;
  stl: string;
  triangles: number;
};

type Point3 = [number, number, number];
type Box = { x0: number; y0: number; x1: number; y1: number; z0: number; z1: number };
type GridPoint = { x: number; y: number };
type PolygonMesh = { vertices: Point3[]; triangles: [number, number, number][] };

const DEFAULT_WIDTH_MM = 120;
const DEFAULT_BASE_MM = 2.4;
const DEFAULT_RELIEF_MM = 8;
const DEFAULT_DETAIL = 160;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sub(a: Point3, b: Point3): Point3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function normal(a: Point3, b: Point3, c: Point3): Point3 {
  const u = sub(b, a);
  const v = sub(c, a);
  const n: Point3 = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const length = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / length, n[1] / length, n[2] / length];
}

function facet(a: Point3, b: Point3, c: Point3) {
  const n = normal(a, b, c);
  const vertex = (p: Point3) => `      vertex ${p[0].toFixed(4)} ${p[1].toFixed(4)} ${p[2].toFixed(4)}`;
  return [
    `  facet normal ${n[0].toFixed(6)} ${n[1].toFixed(6)} ${n[2].toFixed(6)}`,
    "    outer loop",
    vertex(a),
    vertex(b),
    vertex(c),
    "    endloop",
    "  endfacet",
  ].join("\n");
}

function addBoxFacets(facets: string[], box: Box) {
  const p000: Point3 = [box.x0, box.y0, box.z0];
  const p100: Point3 = [box.x1, box.y0, box.z0];
  const p110: Point3 = [box.x1, box.y1, box.z0];
  const p010: Point3 = [box.x0, box.y1, box.z0];
  const p001: Point3 = [box.x0, box.y0, box.z1];
  const p101: Point3 = [box.x1, box.y0, box.z1];
  const p111: Point3 = [box.x1, box.y1, box.z1];
  const p011: Point3 = [box.x0, box.y1, box.z1];

  facets.push(facet(p001, p101, p111), facet(p001, p111, p011));
  facets.push(facet(p010, p110, p100), facet(p010, p100, p000));
  facets.push(facet(p000, p100, p101), facet(p000, p101, p001));
  facets.push(facet(p100, p110, p111), facet(p100, p111, p101));
  facets.push(facet(p110, p010, p011), facet(p110, p011, p111));
  facets.push(facet(p010, p000, p001), facet(p010, p001, p011));
}

function gridKey(x: number, y: number) {
  return `${x},${y}`;
}

function polygonArea(points: GridPoint[]) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function pointInPolygon(point: GridPoint, polygon: GridPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    const intersects =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / ((pj.y - pi.y) || 1e-9) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function simplifyLoop(points: GridPoint[]) {
  if (points.length <= 4) return points;
  const simplified: GridPoint[] = [];

  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i - 1 + points.length) % points.length];
    const cur = points[i];
    const next = points[(i + 1) % points.length];
    const cross = (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
    if (Math.abs(cross) > 0.0001) simplified.push(cur);
  }

  return simplified.length >= 3 ? simplified : points;
}

function maskToLoops(mask: number[][]) {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const starts = new Map<string, GridPoint[]>();
  const addSegment = (start: GridPoint, end: GridPoint) => {
    const key = gridKey(start.x, start.y);
    const list = starts.get(key) ?? [];
    list.push(end);
    starts.set(key, list);
  };
  const solid = (x: number, y: number) => y >= 0 && y < rows && x >= 0 && x < cols && mask[y][x] > 0;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!solid(x, y)) continue;
      if (!solid(x, y - 1)) addSegment({ x, y }, { x: x + 1, y });
      if (!solid(x + 1, y)) addSegment({ x: x + 1, y }, { x: x + 1, y: y + 1 });
      if (!solid(x, y + 1)) addSegment({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
      if (!solid(x - 1, y)) addSegment({ x, y: y + 1 }, { x, y });
    }
  }

  const loops: GridPoint[][] = [];

  while (starts.size > 0) {
    const firstKey = starts.keys().next().value as string | undefined;
    if (!firstKey) break;
    const [sx, sy] = firstKey.split(",").map(Number);
    const loop: GridPoint[] = [{ x: sx, y: sy }];
    let current = { x: sx, y: sy };
    let guard = 0;

    while (guard < rows * cols * 8) {
      guard += 1;
      const key = gridKey(current.x, current.y);
      const list = starts.get(key);
      const next = list?.shift();
      if (!list || list.length === 0) starts.delete(key);
      if (!next) break;
      if (next.x === sx && next.y === sy) break;
      loop.push(next);
      current = next;
    }

    const simple = simplifyLoop(loop);
    if (simple.length >= 3 && Math.abs(polygonArea(simple)) >= 2) loops.push(simple);
  }

  return loops;
}

function buildPolygonMesh(
  outer: GridPoint[],
  holes: GridPoint[][],
  cols: number,
  rows: number,
  widthMm: number,
  depthMm: number,
  z0: number,
  z1: number
): PolygonMesh | null {
  const loops = [outer, ...holes];
  const flat: number[] = [];
  const holeIndices: number[] = [];
  const vertices2d: Point3[] = [];
  const toPoint = (p: GridPoint, z: number): Point3 => [
    (p.x / cols - 0.5) * widthMm,
    (0.5 - p.y / rows) * depthMm,
    z,
  ];

  for (const loop of loops) {
    if (vertices2d.length > 0) holeIndices.push(vertices2d.length);
    for (const point of loop) {
      const p = toPoint(point, z1);
      flat.push(p[0], p[1]);
      vertices2d.push(p);
    }
  }

  const indices = earcut(flat, holeIndices, 2);
  if (indices.length < 3) return null;

  const vertices: Point3[] = [];
  const topStart = vertices.length;
  vertices.push(...vertices2d);
  const bottomStart = vertices.length;
  vertices.push(...vertices2d.map((p) => [p[0], p[1], z0] as Point3));

  const triangles: [number, number, number][] = [];
  for (let i = 0; i < indices.length; i += 3) {
    triangles.push([topStart + indices[i], topStart + indices[i + 1], topStart + indices[i + 2]]);
    triangles.push([bottomStart + indices[i + 2], bottomStart + indices[i + 1], bottomStart + indices[i]]);
  }

  let loopOffset = 0;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i += 1) {
      const a = loopOffset + i;
      const b = loopOffset + ((i + 1) % loop.length);
      triangles.push([topStart + a, bottomStart + a, bottomStart + b]);
      triangles.push([topStart + a, bottomStart + b, topStart + b]);
    }
    loopOffset += loop.length;
  }

  return { vertices, triangles };
}

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the selected image."));
    img.src = src;
  });
}

function estimateBackgroundLuma(data: Uint8ClampedArray, width: number, height: number) {
  const samples: number[] = [];
  const scan = Math.max(4, Math.floor(Math.min(width, height) * 0.08));
  const add = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    samples.push((0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]) / 255);
  };

  for (let y = 0; y < scan; y += 1) {
    for (let x = 0; x < scan; x += 1) {
      add(x, y);
      add(width - 1 - x, y);
      add(x, height - 1 - y);
      add(width - 1 - x, height - 1 - y);
    }
  }

  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)] ?? 1;
}

function getSignal(luma: number, alpha: number, mode: HeightMode, style: ReliefStyle, bgLuma: number) {
  if (style === "logo") {
    const backgroundDelta = mode === "dark" ? bgLuma - luma : luma - bgLuma;
    return clamp(backgroundDelta * 1.55 * alpha, 0, 1);
  }
  return (mode === "light" ? luma : 1 - luma) * alpha;
}

async function buildReliefStl(
  imageUrl: string,
  widthMm: number,
  baseMm: number,
  reliefMm: number,
  sampleSize: number,
  mode: HeightMode,
  style: ReliefStyle,
  contrast: number,
  threshold: number,
  previewCanvas: HTMLCanvasElement | null
): Promise<MeshResult> {
  const img = await loadImage(imageUrl);
  const sourceMax = 720;
  const sourceScale = Math.min(1, sourceMax / Math.max(img.width, img.height));
  const sourceWidth = Math.max(8, Math.round(img.width * sourceScale));
  const sourceHeight = Math.max(8, Math.round(img.height * sourceScale));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) throw new Error("Canvas processing is not available in this browser.");

  sourceCtx.fillStyle = "#fff";
  sourceCtx.fillRect(0, 0, sourceWidth, sourceHeight);
  sourceCtx.drawImage(img, 0, 0, sourceWidth, sourceHeight);

  const sourceData = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight).data;
  const bgLuma = estimateBackgroundLuma(sourceData, sourceWidth, sourceHeight);
  const thresholdUnit = threshold / 100;
  let cropMinX = sourceWidth;
  let cropMinY = sourceHeight;
  let cropMaxX = 0;
  let cropMaxY = 0;

  if (style === "logo") {
    for (let y = 0; y < sourceHeight; y += 1) {
      for (let x = 0; x < sourceWidth; x += 1) {
        const idx = (y * sourceWidth + x) * 4;
        const alpha = sourceData[idx + 3] / 255;
        const luma = (0.2126 * sourceData[idx] + 0.7152 * sourceData[idx + 1] + 0.0722 * sourceData[idx + 2]) / 255;
        if (getSignal(luma, alpha, mode, style, bgLuma) > thresholdUnit) {
          cropMinX = Math.min(cropMinX, x);
          cropMinY = Math.min(cropMinY, y);
          cropMaxX = Math.max(cropMaxX, x);
          cropMaxY = Math.max(cropMaxY, y);
        }
      }
    }
  }

  const hasCrop = cropMaxX > cropMinX && cropMaxY > cropMinY;
  const pad = hasCrop ? Math.round(Math.max(cropMaxX - cropMinX, cropMaxY - cropMinY) * 0.08) : 0;
  const sx = hasCrop ? clamp(cropMinX - pad, 0, sourceWidth - 1) : 0;
  const sy = hasCrop ? clamp(cropMinY - pad, 0, sourceHeight - 1) : 0;
  const sw = hasCrop ? clamp(cropMaxX - cropMinX + pad * 2, 8, sourceWidth - sx) : sourceWidth;
  const sh = hasCrop ? clamp(cropMaxY - cropMinY + pad * 2, 8, sourceHeight - sy) : sourceHeight;
  const aspect = sh > 0 ? sw / sh : 1;
  const depthMm = widthMm / aspect;
  const cols = sampleSize;
  const rows = Math.max(12, Math.round(sampleSize / aspect));
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas processing is not available in this browser.");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, cols, rows);
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, cols, rows);

  const data = ctx.getImageData(0, 0, cols, rows).data;
  const heights: number[][] = [];
  const contrastPower = clamp(contrast / 50, 0.2, 3);
  const mask: number[][] = [];

  for (let y = 0; y < rows; y += 1) {
    const row: number[] = [];
    const maskRow: number[] = [];
    for (let x = 0; x < cols; x += 1) {
      const idx = (y * cols + x) * 4;
      const alpha = data[idx + 3] / 255;
      const luma = (0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2]) / 255;
      const signal = getSignal(luma, alpha, mode, style, bgLuma);
      const normalized = clamp((signal - thresholdUnit) / Math.max(0.01, 1 - thresholdUnit), 0, 1);
      const raised = style === "logo" ? (normalized > 0 ? 1 : 0) : Math.pow(normalized, contrastPower);
      row.push(baseMm + reliefMm * raised);
      maskRow.push(raised);
    }
    heights.push(row);
    mask.push(maskRow);
  }

  if (style === "logo") {
    for (let y = 1; y < rows - 1; y += 1) {
      for (let x = 1; x < cols - 1; x += 1) {
        if (mask[y][x] <= 0) continue;
        const neighborCount =
          mask[y - 1][x] + mask[y + 1][x] + mask[y][x - 1] + mask[y][x + 1] +
          mask[y - 1][x - 1] + mask[y - 1][x + 1] + mask[y + 1][x - 1] + mask[y + 1][x + 1];
        if (neighborCount < 8) {
          heights[y][x] = baseMm + reliefMm * 0.72;
        }
      }
    }
  }

  if (previewCanvas) {
    previewCanvas.width = cols;
    previewCanvas.height = rows;
    const previewCtx = previewCanvas.getContext("2d");
    if (previewCtx) {
      const preview = previewCtx.createImageData(cols, rows);
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const left = heights[y][Math.max(0, x - 1)];
          const right = heights[y][Math.min(cols - 1, x + 1)];
          const up = heights[Math.max(0, y - 1)][x];
          const down = heights[Math.min(rows - 1, y + 1)][x];
          const rawShade = style === "logo"
            ? (heights[y][x] > baseMm ? 226 : 48)
            : 168 + (left - right) * 16 + (up - down) * 10 + heights[y][x] * 5;
          const shade = clamp(rawShade, 34, 245);
          const i = (y * cols + x) * 4;
          preview.data[i] = shade;
          preview.data[i + 1] = shade;
          preview.data[i + 2] = shade;
          preview.data[i + 3] = 255;
        }
      }
      previewCtx.putImageData(preview, 0, 0);
    }
  }

  const xAt = (x: number) => (x / (cols - 1) - 0.5) * widthMm;
  const yAt = (y: number) => (0.5 - y / (rows - 1)) * depthMm;
  const facets: string[] = ["solid vltd_relief"];

  if (style === "logo") {
    addBoxFacets(facets, {
      x0: -widthMm / 2,
      y0: -depthMm / 2,
      x1: widthMm / 2,
      y1: depthMm / 2,
      z0: 0,
      z1: baseMm,
    });

    const loops = maskToLoops(mask);
    const outers = loops
      .map((points) => ({ points, area: polygonArea(points) }))
      .filter((entry) => entry.area > 0)
      .sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
    const holes = loops
      .map((points) => ({ points, area: polygonArea(points) }))
      .filter((entry) => entry.area < 0);

    for (const outer of outers) {
      const matchingHoles = holes
        .filter((hole) => pointInPolygon(hole.points[0], outer.points))
        .filter((hole) => {
          const smallerOuter = outers.find(
            (candidate) =>
              candidate !== outer &&
              Math.abs(candidate.area) < Math.abs(outer.area) &&
              Math.abs(candidate.area) > Math.abs(hole.area) &&
              pointInPolygon(hole.points[0], candidate.points)
          );
          return !smallerOuter;
        })
        .map((hole) => hole.points);
      const mesh = buildPolygonMesh(
        outer.points,
        matchingHoles,
        cols,
        rows,
        widthMm,
        depthMm,
        baseMm,
        baseMm + reliefMm
      );
      if (!mesh) continue;
      for (const triangle of mesh.triangles) {
        facets.push(facet(mesh.vertices[triangle[0]], mesh.vertices[triangle[1]], mesh.vertices[triangle[2]]));
      }
    }

    if (facets.length === 13) {
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (heights[y][x] <= baseMm) continue;
          const cellW = widthMm / cols;
          const cellH = depthMm / rows;
          addBoxFacets(facets, {
            x0: -widthMm / 2 + x * cellW,
            y0: depthMm / 2 - (y + 1) * cellH,
            x1: -widthMm / 2 + (x + 1) * cellW,
            y1: depthMm / 2 - y * cellH,
            z0: baseMm,
            z1: baseMm + reliefMm,
          });
        }
      }
    }

    facets.push("endsolid vltd_relief");

    return {
      aspect,
      depthMm,
      maxHeightMm: baseMm + reliefMm,
      sampleSize: cols * rows,
      stl: facets.join("\n"),
      triangles: facets.length - 2,
    };
  }

  const top = (x: number, y: number): Point3 => [xAt(x), yAt(y), heights[y][x]];
  const bottom = (x: number, y: number): Point3 => [xAt(x), yAt(y), 0];

  for (let y = 0; y < rows - 1; y += 1) {
    for (let x = 0; x < cols - 1; x += 1) {
      facets.push(facet(top(x, y), top(x + 1, y), top(x + 1, y + 1)));
      facets.push(facet(top(x, y), top(x + 1, y + 1), top(x, y + 1)));
      facets.push(facet(bottom(x, y + 1), bottom(x + 1, y + 1), bottom(x + 1, y)));
      facets.push(facet(bottom(x, y + 1), bottom(x + 1, y), bottom(x, y)));
    }
  }

  for (let x = 0; x < cols - 1; x += 1) {
    facets.push(facet(bottom(x, 0), bottom(x + 1, 0), top(x + 1, 0)));
    facets.push(facet(bottom(x, 0), top(x + 1, 0), top(x, 0)));
    facets.push(facet(bottom(x + 1, rows - 1), bottom(x, rows - 1), top(x, rows - 1)));
    facets.push(facet(bottom(x + 1, rows - 1), top(x, rows - 1), top(x + 1, rows - 1)));
  }

  for (let y = 0; y < rows - 1; y += 1) {
    facets.push(facet(bottom(0, y + 1), bottom(0, y), top(0, y)));
    facets.push(facet(bottom(0, y + 1), top(0, y), top(0, y + 1)));
    facets.push(facet(bottom(cols - 1, y), bottom(cols - 1, y + 1), top(cols - 1, y + 1)));
    facets.push(facet(bottom(cols - 1, y), top(cols - 1, y + 1), top(cols - 1, y)));
  }

  facets.push("endsolid vltd_relief");

  return {
    aspect,
    depthMm,
    maxHeightMm: baseMm + reliefMm,
    sampleSize: cols * rows,
    stl: facets.join("\n"),
    triangles: facets.length - 2,
  };
}

export default function ReliefForgeClient() {
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const generationRef = useRef(0);
  const [imageUrl, setImageUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [widthMm, setWidthMm] = useState(DEFAULT_WIDTH_MM);
  const [baseMm, setBaseMm] = useState(DEFAULT_BASE_MM);
  const [reliefMm, setReliefMm] = useState(DEFAULT_RELIEF_MM);
  const [sampleSize, setSampleSize] = useState(DEFAULT_DETAIL);
  const [mode, setMode] = useState<HeightMode>("dark");
  const [style, setStyle] = useState<ReliefStyle>("logo");
  const [contrast, setContrast] = useState(90);
  const [threshold, setThreshold] = useState(22);
  const [result, setResult] = useState<MeshResult | null>(null);
  const [status, setStatus] = useState("Upload a flat image to generate a printable relief mesh.");
  const [isWorking, setIsWorking] = useState(false);

  const estimatedScale = useMemo(() => {
    if (!result) return `${widthMm.toFixed(0)} mm wide`;
    return `${widthMm.toFixed(0)} x ${result.depthMm.toFixed(0)} x ${result.maxHeightMm.toFixed(1)} mm`;
  }, [result, widthMm]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const nextUrl = URL.createObjectURL(file);
    setImageUrl(nextUrl);
    setFileName(file.name);
    setResult(null);
    setStatus("Image loaded. Tune the settings, then generate the relief STL.");
  }

  const generateRelief = useCallback(async (auto = false) => {
    if (!imageUrl) {
      setStatus("Choose an image first.");
      return;
    }
    const requestId = generationRef.current + 1;
    generationRef.current = requestId;
    setIsWorking(true);
    setStatus(auto ? "Updating relief from current settings..." : "Sampling image brightness and building a watertight STL mesh...");
    const readyStatus = auto
      ? "Relief updated. Download the latest STL when it looks right."
      : "Relief STL is ready. Download it and test it in your slicer.";
    try {
      const next = await buildReliefStl(
        imageUrl,
        widthMm,
        baseMm,
        reliefMm,
        sampleSize,
        mode,
        style,
        contrast,
        threshold,
        previewRef.current
      );
      if (generationRef.current !== requestId) return;
      setResult(next);
      setStatus(readyStatus);
    } catch (error) {
      if (generationRef.current !== requestId) return;
      setStatus(error instanceof Error ? error.message : "Could not generate the STL.");
    }
    if (generationRef.current === requestId) setIsWorking(false);
  }, [baseMm, contrast, imageUrl, mode, reliefMm, sampleSize, style, threshold, widthMm]);

  useEffect(() => {
    if (!imageUrl) return;
    const timer = window.setTimeout(() => {
      void generateRelief(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [baseMm, contrast, generateRelief, imageUrl, mode, reliefMm, sampleSize, style, threshold, widthMm]);

  function handleGenerate() {
    void generateRelief(false);
  }

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([result.stl], { type: "model/stl" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (fileName || "vltd-relief").replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]+/gi, "-");
    link.href = url;
    link.download = `${safeName || "vltd-relief"}-${widthMm.toFixed(0)}mm.stl`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] px-4 pb-28 pt-6 text-[color:var(--fg)] md:px-8 md:pt-10">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <section className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-[color:var(--border)] bg-[color:var(--input)]">
              <Sparkles size={19} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--muted2)]">VLTD Forge</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">Image relief to STL</h1>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                Free local prototype for flat art and sculpture references: clean logos become crisp raised relief STL files; photos stay experimental height maps.
              </p>
            </div>
          </div>

          <label className="mt-6 flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--input)] p-5 text-center transition hover:bg-[color:var(--input-hover)]">
            <Upload size={24} aria-hidden="true" />
            <span className="text-sm font-black">{fileName || "Upload PNG or JPG"}</span>
            <span className="text-xs text-[color:var(--muted)]">Best with high-contrast logos, icons, emblems, and clean flat art.</span>
            <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} />
          </label>

          <div className="mt-5 grid gap-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--muted2)]">
                <span>Process</span>
                <span>{style === "logo" ? "clean logo" : "height map"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`rounded-[6px] border px-3 py-2 text-sm font-bold ${style === "logo" ? "border-[color:var(--pill-active-ring)] bg-[color:var(--pill-active-bg)]" : "border-[color:var(--border)] bg-[color:var(--input)]"}`}
                  onClick={() => setStyle("logo")}
                  type="button"
                >
                  Clean logo
                </button>
                <button
                  className={`rounded-[6px] border px-3 py-2 text-sm font-bold ${style === "height" ? "border-[color:var(--pill-active-ring)] bg-[color:var(--pill-active-bg)]" : "border-[color:var(--border)] bg-[color:var(--input)]"}`}
                  onClick={() => setStyle("height")}
                  type="button"
                >
                  Photo map
                </button>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--muted2)]">
                <span>{style === "logo" ? "Background" : "Raised pixels"}</span>
                <span>{mode === "light" ? "dark surface" : "light surface"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`rounded-[6px] border px-3 py-2 text-sm font-bold ${mode === "light" ? "border-[color:var(--pill-active-ring)] bg-[color:var(--pill-active-bg)]" : "border-[color:var(--border)] bg-[color:var(--input)]"}`}
                  onClick={() => setMode("light")}
                  type="button"
                >
                  Dark bg
                </button>
                <button
                  className={`rounded-[6px] border px-3 py-2 text-sm font-bold ${mode === "dark" ? "border-[color:var(--pill-active-ring)] bg-[color:var(--pill-active-bg)]" : "border-[color:var(--border)] bg-[color:var(--input)]"}`}
                  onClick={() => setMode("dark")}
                  type="button"
                >
                  Light bg
                </button>
              </div>
            </div>

            <label className="grid gap-2 text-sm font-bold">
              <span className="flex items-center justify-between">
                <span className="flex items-center gap-2"><Ruler size={16} /> Width</span>
                <span>{widthMm} mm</span>
              </span>
              <input type="range" min="30" max="500" value={widthMm} onChange={(e) => setWidthMm(Number(e.target.value))} />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-2 text-sm font-bold">
                <span>Base</span>
                <input className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--input)] px-3 py-2" min="0.8" max="8" step="0.2" type="number" value={baseMm} onChange={(e) => setBaseMm(Number(e.target.value))} />
              </label>
              <label className="grid gap-2 text-sm font-bold">
                <span>Relief</span>
                <input className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--input)] px-3 py-2" min="1" max="40" step="0.5" type="number" value={reliefMm} onChange={(e) => setReliefMm(Number(e.target.value))} />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-bold">
              <span className="flex items-center justify-between">
                <span>Detail grid</span>
                <span>{sampleSize}px</span>
              </span>
              <input type="range" min="96" max="320" step="32" value={sampleSize} onChange={(e) => setSampleSize(Number(e.target.value))} />
            </label>

            {style === "height" && (
              <label className="grid gap-2 text-sm font-bold">
                <span className="flex items-center justify-between">
                  <span>Contrast</span>
                  <span>{contrast}</span>
                </span>
                <input type="range" min="20" max="140" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
              </label>
            )}

            <label className="grid gap-2 text-sm font-bold">
              <span className="flex items-center justify-between">
                <span>{style === "logo" ? "Cleanup" : "Threshold"}</span>
                <span>{threshold}%</span>
              </span>
              <input type="range" min="0" max="80" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[7px] border border-[rgba(79,211,238,0.42)] bg-[#EDEFF1] px-4 py-2 text-sm font-black text-[#0B0D10] shadow-[0_0_18px_rgba(79,211,238,0.16)] transition hover:bg-white disabled:cursor-not-allowed disabled:border-[color:var(--border)] disabled:bg-[color:var(--input)] disabled:text-[color:var(--muted2)] disabled:shadow-none disabled:opacity-70"
              disabled={isWorking || !imageUrl}
              onClick={handleGenerate}
              type="button"
            >
              <FlipVertical2 size={17} aria-hidden="true" />
              {isWorking ? "Generating..." : "Generate STL"}
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[7px] border border-[color:var(--border)] bg-[color:var(--input)] px-4 py-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!result}
              onClick={handleDownload}
              type="button"
            >
              <Download size={17} aria-hidden="true" />
              Download
            </button>
          </div>

          <p className="mt-4 rounded-[6px] border border-[color:var(--border)] bg-[color:var(--input)] px-3 py-2 text-sm text-[color:var(--muted)]">{status}</p>
        </section>

        <section className="grid gap-5">
          <div className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[color:var(--muted2)]">Preview</p>
                <h2 className="mt-1 text-xl font-black">Relief height map</h2>
              </div>
              <div className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--input)] px-3 py-2 text-sm font-black">{estimatedScale}</div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="grid min-h-[360px] place-items-center overflow-hidden rounded-[8px] border border-[color:var(--border)] bg-[#0b0d10] p-3">
                {imageUrl ? (
                  <div className="grid w-full gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="max-h-[260px] w-full object-contain" src={imageUrl} alt="Uploaded source" />
                    <div className="relative min-h-[116px] overflow-hidden rounded-[6px] border border-white/10 bg-black/30">
                      {!result && (
                        <div className="absolute inset-0 grid place-items-center px-4 text-center text-xs font-bold uppercase tracking-[0.14em] text-white/42">
                          Generate STL to render height map
                        </div>
                      )}
                      <canvas ref={previewRef} className="relative h-auto w-full [image-rendering:pixelated]" />
                    </div>
                  </div>
                ) : (
                  <div className="grid justify-items-center gap-3 text-center text-[color:var(--muted)]">
                    <FileImage size={44} aria-hidden="true" />
                    <p className="max-w-[320px] text-sm">Upload one of your test images and the generated relief preview will appear here.</p>
                  </div>
                )}
              </div>

              <div className="grid content-start gap-3">
                <div className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--input)] p-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--muted2)]">Output</p>
                  <p className="mt-2 text-2xl font-black">{result ? "STL" : "Waiting"}</p>
                </div>
                <div className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--input)] p-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--muted2)]">Triangles</p>
                  <p className="mt-2 text-2xl font-black">{result ? result.triangles.toLocaleString() : "0"}</p>
                </div>
                <div className="rounded-[6px] border border-[color:var(--border)] bg-[color:var(--input)] p-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--muted2)]">Samples</p>
                  <p className="mt-2 text-2xl font-black">{result ? result.sampleSize.toLocaleString() : "0"}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 text-sm leading-6 text-[color:var(--muted)]">
            <p className="font-black text-[color:var(--fg)]">What this prototype proves</p>
            <p className="mt-2">
              Clean Logo uses a free local mask-to-solid approach: auto-crop, background cleanup, a printable base plate, and crisp raised geometry. Photo Map keeps grayscale depth for rough sculpture experiments.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
