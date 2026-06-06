// Shared types across UI, worker, and pipeline.

/** A raster image loaded into the browser, ready to feed the pipeline. */
export interface SourceImage {
  /** Decoded pixels, drawable to canvas / transferable to the worker. */
  bitmap: ImageBitmap;
  /** Natural pixel dimensions of the source. */
  width: number;
  height: number;
  /** Original file name (used to derive export filename). */
  name: string;
}

export type PaletteMode = "auto" | "fixed" | "extract";
export type FillRule = "nonzero" | "evenodd";

/** Every pipeline parameter (plan §5). Worker uses the subset it has implemented. */
export interface VectorizeParams {
  /** Color count for Auto/Extract modes. */
  k: number;
  paletteMode: PaletteMode;
  /** Hex colors for Fixed mode. */
  palette: string[];
  smoothingPasses: number;
  preserveFace: boolean;
  faceThreshold: number;
  bodyThreshold: number;
  holeMin: number;
  /** approxPolyDP epsilon, px. */
  simplifyEps: number;
  /** Dilate radius, px. */
  edgeOverlap: number;
  fillRule: FillRule;
  /** Long-edge cap for the working resolution. */
  workingResCap: number;
  /** Output SVG width in px; defaults to source width when undefined. */
  outputWidth?: number;
}

export const DEFAULT_PARAMS: VectorizeParams = {
  k: 8,
  paletteMode: "auto",
  palette: [],
  smoothingPasses: 1,
  preserveFace: true,
  faceThreshold: 12,
  bodyThreshold: 150,
  holeMin: 70,
  simplifyEps: 1.0,
  edgeOverlap: 1,
  fillRule: "nonzero",
  workingResCap: 1600,
};

/** Quality / sanity numbers shown in the stats panel (plan §6). */
export interface VectorizeStats {
  colorCount: number;
  subpaths: number;
  openSubpaths: number;
  selfIntersections: number;
  svgBytes: number;
  /** Wall-clock pipeline time, ms. */
  elapsedMs: number;
  /** True when the expensive stages were served from the worker cache. */
  cached: boolean;
}

/** Axis-aligned box in working-res (preview) pixel coords. */
export interface FaceBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Worker result for one vectorize run. */
export interface VectorizeResult {
  /** Full SVG document string (used for download). */
  svg: string;
  /** Quantized RGBA pixels at working res, for fast canvas preview. */
  preview: { data: Uint8ClampedArray; width: number; height: number };
  /** Resolved palette as hex strings, in path order. */
  palette: string[];
  /** Detected face box in working-res coords, or null. */
  faceBox: FaceBox | null;
  /** One standalone SVG per color layer, for per-layer export. */
  layers: { hex: string; svg: string }[];
  stats: VectorizeStats;
}

// ---- Worker message protocol ----

export interface RawImage {
  data: Uint8ClampedArray; // RGBA at working res
  width: number;
  height: number;
  /** Scale factor from working res to output res (outputW / workingW). */
  outScale: number;
  /** Output viewBox dimensions. */
  outWidth: number;
  outHeight: number;
}

export type WorkerRequest =
  | { type: "init" }
  | { type: "vectorize"; id: number; imageId: number; image: RawImage; params: VectorizeParams };

export type WorkerResponse =
  | { type: "ready" }
  | { type: "progress"; id: number; stage: string; pct: number }
  | { type: "result"; id: number; result: VectorizeResult }
  | { type: "error"; id: number | null; message: string };
