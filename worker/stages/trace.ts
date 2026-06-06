// Stages 6–10 — trace / grow / simplify / hole-suppress / winding
// (plan §4.6–4.10). Per color: split into 4-connected blobs, and for each blob
// in isolation grow 1px (cross kernel, no diagonal weld), trace with holes
// (RETR_CCOMP), simplify with the self-intersection guard, drop sub-printable
// holes, and fix winding (outer CCW, holes CW) so nonzero == evenodd.

import type { CV } from "../cvLoader";
import { simplifyContour } from "./simplify";
import { setWinding, polygonArea, type FlatPoly } from "@/lib/geometry";

/** One subpath per blob outer/hole, working-res coords, correctly wound. */
export type ContoursPerColor = FlatPoly[][];

interface TraceParams {
  edgeOverlap: number;
  simplifyEps: number;
  holeMin: number;
}

interface Blob {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  members: number[];
}

/** 4-connected blobs of a single label value. */
function blobsOfColor(
  labels: Uint8Array,
  comp: Int32Array,
  color: number,
  width: number,
  height: number,
): Blob[] {
  const n = width * height;
  const blobs: Blob[] = [];
  const stack: number[] = [];
  for (let start = 0; start < n; start++) {
    if (labels[start] !== color || comp[start] !== -1) continue;
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    const members: number[] = [];
    comp[start] = 1;
    stack.push(start);
    while (stack.length) {
      const idx = stack.pop()!;
      const x = idx % width;
      const y = (idx / width) | 0;
      members.push(idx);
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && comp[idx - 1] === -1 && labels[idx - 1] === color) { comp[idx - 1] = 1; stack.push(idx - 1); }
      if (x < width - 1 && comp[idx + 1] === -1 && labels[idx + 1] === color) { comp[idx + 1] = 1; stack.push(idx + 1); }
      if (y > 0 && comp[idx - width] === -1 && labels[idx - width] === color) { comp[idx - width] = 1; stack.push(idx - width); }
      if (y < height - 1 && comp[idx + width] === -1 && labels[idx + width] === color) { comp[idx + width] = 1; stack.push(idx + width); }
    }
    blobs.push({ x0, y0, x1, y1, members });
  }
  return blobs;
}

export function trace(
  cv: CV,
  labels: Uint8Array,
  colorCount: number,
  width: number,
  height: number,
  params: TraceParams,
): ContoursPerColor {
  const out: ContoursPerColor = [];
  const pad = params.edgeOverlap + 1;
  const kernel =
    params.edgeOverlap > 0
      ? cv.getStructuringElement(
          cv.MORPH_CROSS,
          new cv.Size(2 * params.edgeOverlap + 1, 2 * params.edgeOverlap + 1),
        )
      : null;

  for (let c = 0; c < colorCount; c++) {
    const subpaths: FlatPoly[] = [];
    // Fresh component map per color so blob ids don't collide across colors.
    const comp = new Int32Array(width * height).fill(-1);
    const blobs = blobsOfColor(labels, comp, c, width, height);

    for (const blob of blobs) {
      const bw = blob.x1 - blob.x0 + 1 + pad * 2;
      const bh = blob.y1 - blob.y0 + 1 + pad * 2;
      const mask = cv.Mat.zeros(bh, bw, cv.CV_8UC1);
      const md = mask.data;
      for (const idx of blob.members) {
        const x = (idx % width) - blob.x0 + pad;
        const y = ((idx / width) | 0) - blob.y0 + pad;
        md[y * bw + x] = 255;
      }
      if (kernel) cv.dilate(mask, mask, kernel);

      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(mask, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
      const hd = hierarchy.data32S as Int32Array;

      for (let k = 0; k < contours.size(); k++) {
        const cnt = contours.get(k);
        const raw = cnt.data32S as Int32Array;
        cnt.delete();
        if (raw.length < 6) continue;

        // submask coords -> global working-res coords.
        const pts: FlatPoly = new Array(raw.length);
        for (let i = 0; i < raw.length; i += 2) {
          pts[i] = raw[i] - pad + blob.x0;
          pts[i + 1] = raw[i + 1] - pad + blob.y0;
        }

        const isHole = hd[k * 4 + 3] !== -1;
        const simplified = simplifyContour(cv, pts, params.simplifyEps);
        if (simplified.length < 6) continue;

        if (isHole) {
          if (polygonArea(simplified) < params.holeMin) continue; // suppress
          subpaths.push(setWinding(simplified, true)); // hole: CW
        } else {
          subpaths.push(setWinding(simplified, false)); // outer: CCW
        }
      }

      contours.delete();
      hierarchy.delete();
      mask.delete();
    }

    out.push(subpaths);
  }

  kernel?.delete();
  return out;
}
