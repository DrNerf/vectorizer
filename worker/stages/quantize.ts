// Stage 2 — quantize (plan §4.2).
// Auto: KMeans in Lab on a subsample, then assign every pixel.
// Fixed: snap every pixel to the nearest palette color in Lab.

import { kmeans } from "ml-kmeans";
import { rgbToLab, labToRgb, hexToRgb } from "@/lib/color";
import type { VectorizeParams } from "@/lib/types";

export interface QuantizeResult {
  /** Per-pixel palette index, length = width*height. */
  labels: Uint8Array;
  /** Palette colors as [r,g,b]. */
  paletteRgb: [number, number, number][];
}

const SUBSAMPLE_TARGET = 80_000;

function nearest(lab: number[], centroids: number[][]): number {
  let best = 0;
  let bestD = Infinity;
  for (let c = 0; c < centroids.length; c++) {
    const cc = centroids[c];
    const dl = lab[0] - cc[0];
    const da = lab[1] - cc[1];
    const db = lab[2] - cc[2];
    const d = dl * dl + da * da + db * db;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function quantize(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: VectorizeParams,
): QuantizeResult {
  const pxCount = width * height;
  const labels = new Uint8Array(pxCount);

  // Precompute Lab for every pixel once (reused for sampling + assignment).
  const lab = new Float32Array(pxCount * 3);
  for (let i = 0; i < pxCount; i++) {
    const o = i * 4;
    const [L, a, b] = rgbToLab(data[o], data[o + 1], data[o + 2]);
    lab[i * 3] = L;
    lab[i * 3 + 1] = a;
    lab[i * 3 + 2] = b;
  }

  let centroids: number[][];

  if (params.paletteMode === "fixed" && params.palette.length >= 2) {
    centroids = params.palette.map((hex) => {
      const [r, g, b] = hexToRgb(hex);
      return rgbToLab(r, g, b) as number[];
    });
  } else {
    // Auto / Extract — KMeans on a strided subsample for speed.
    const stride = Math.max(1, Math.floor(pxCount / SUBSAMPLE_TARGET));
    const sample: number[][] = [];
    for (let i = 0; i < pxCount; i += stride) {
      sample.push([lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]]);
    }
    const k = Math.max(2, Math.min(16, params.k));
    const res = kmeans(sample, k, { initialization: "kmeans++", seed: 1 });
    centroids = res.centroids as number[][];
  }

  // Assign every pixel to its nearest centroid in Lab.
  const tmp: number[] = [0, 0, 0];
  for (let i = 0; i < pxCount; i++) {
    tmp[0] = lab[i * 3];
    tmp[1] = lab[i * 3 + 1];
    tmp[2] = lab[i * 3 + 2];
    labels[i] = nearest(tmp, centroids);
  }

  const paletteRgb = centroids.map(
    (c) => labToRgb(c[0], c[1], c[2]) as [number, number, number],
  );

  return { labels, paletteRgb };
}
