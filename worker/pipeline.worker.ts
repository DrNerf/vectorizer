/// <reference lib="webworker" />
// Pipeline orchestrator (plan §3). Loads opencv.js lazily, then runs the
// stages on each vectorize request and posts back preview + SVG + stats.
// M2: quantize -> trace -> emit (no cleanup). M3 fills in the middle stages.

import { loadOpenCv } from "./cvLoader";
import { quantize } from "./stages/quantize";
import { smooth } from "./stages/smooth";
import { faceDetect } from "./stages/faceDetect";
import { despeckle } from "./stages/despeckle";
import { trace } from "./stages/trace";
import { emitSvg } from "./stages/emitSvg";
import { isSimplePolygon } from "@/lib/geometry";
import type { WorkerRequest, WorkerResponse, RawImage, VectorizeParams, FaceBox } from "@/lib/types";

declare const self: DedicatedWorkerGlobalScope;

function post(msg: WorkerResponse, transfer?: Transferable[]) {
  self.postMessage(msg, transfer ?? []);
}

function progress(id: number, stage: string, pct: number) {
  post({ type: "progress", id, stage, pct });
}

// Cache of the expensive stages (quantize -> smooth -> face -> despeckle),
// keyed by image identity + the params that affect them. Lets cheap-param
// tweaks (EPS, dilate, hole-min, fill-rule, output width) re-trace/emit only.
interface StageCache {
  key: string;
  labels: Uint8Array;
  paletteRgb: [number, number, number][];
  faceBox: FaceBox | null;
}
let cache: StageCache | null = null;

function expensiveKey(imageId: number, w: number, h: number, p: VectorizeParams): string {
  return JSON.stringify([
    imageId, w, h, p.k, p.paletteMode, p.palette, p.smoothingPasses,
    p.preserveFace, p.faceThreshold, p.bodyThreshold,
  ]);
}

async function run(id: number, imageId: number, image: RawImage, params: VectorizeParams) {
  const t0 = performance.now();
  const { data, width, height } = image;

  progress(id, "Loading engine", 0.05);
  const cv = await loadOpenCv();

  const key = expensiveKey(imageId, width, height, params);
  const cached = !!cache && cache.key === key;
  let labels: Uint8Array;
  let paletteRgb: [number, number, number][];
  let faceBox: FaceBox | null;

  if (cache && cache.key === key) {
    progress(id, "Reusing layers", 0.5);
    ({ labels, paletteRgb, faceBox } = cache);
  } else {
    progress(id, "Quantizing", 0.15);
    const { labels: rawLabels, paletteRgb: pal } = quantize(data, width, height, params);
    paletteRgb = pal;
    const colorCount = paletteRgb.length;

    progress(id, "Smoothing", 0.3);
    const smoothed = smooth(rawLabels, width, height, colorCount, params.smoothingPasses);

    progress(id, "Detecting face", 0.4);
    faceBox = params.preserveFace ? faceDetect(data, width, height) : null;

    progress(id, "Despeckling", 0.5);
    labels = despeckle({
      labels: smoothed,
      preSmooth: rawLabels,
      width,
      height,
      faceBox,
      faceThreshold: params.faceThreshold,
      bodyThreshold: params.bodyThreshold,
      preserveFace: params.preserveFace,
    });
    cache = { key, labels, paletteRgb, faceBox };
  }

  const colorCount = paletteRgb.length;
  progress(id, "Tracing", 0.7);
  const contours = trace(cv, labels, colorCount, width, height, {
    edgeOverlap: params.edgeOverlap,
    simplifyEps: params.simplifyEps,
    holeMin: params.holeMin,
  });

  progress(id, "Emitting SVG", 0.9);
  const { svg, layers, subpaths } = emitSvg(
    contours,
    paletteRgb,
    image.outScale,
    image.outWidth,
    image.outHeight,
    params.fillRule,
  );

  // Sanity counts: every subpath is closed (M..Z), so open == 0; the simplify
  // guard should leave no self-intersections — verify rather than assume.
  let selfIntersections = 0;
  for (const color of contours) {
    for (const sp of color) if (!isSimplePolygon(sp)) selfIntersections++;
  }

  // Quantized RGBA preview for the canvas stage.
  const pxCount = width * height;
  const preview = new Uint8ClampedArray(pxCount * 4);
  for (let i = 0; i < pxCount; i++) {
    const [r, g, b] = paletteRgb[labels[i]];
    const o = i * 4;
    preview[o] = r;
    preview[o + 1] = g;
    preview[o + 2] = b;
    preview[o + 3] = 255;
  }

  const result: WorkerResponse = {
    type: "result",
    id,
    result: {
      svg,
      preview: { data: preview, width, height },
      palette: paletteRgb.map(([r, g, b]) =>
        `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
      ),
      faceBox,
      layers,
      stats: {
        colorCount: paletteRgb.length,
        subpaths,
        openSubpaths: 0,
        selfIntersections,
        svgBytes: svg.length,
        elapsedMs: Math.round(performance.now() - t0),
        cached,
      },
    },
  };

  post(result, [preview.buffer]);
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      await loadOpenCv();
      post({ type: "ready" });
    } else if (msg.type === "vectorize") {
      await run(msg.id, msg.imageId, msg.image, msg.params);
    }
  } catch (err) {
    const id = msg.type === "vectorize" ? msg.id : null;
    post({
      type: "error",
      id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
