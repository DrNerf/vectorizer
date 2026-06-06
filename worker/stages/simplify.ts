// Stage 8 — simplify + guard (plan §4.8).
// approxPolyDP at EPS; if the result self-intersects, halve EPS and retry down
// to ~0. Guarantees simple polygons so winding/nonzero stays well-defined.

import type { CV } from "../cvLoader";
import { isSimplePolygon, type FlatPoly } from "@/lib/geometry";

function approxOnce(cv: CV, pts: FlatPoly, eps: number): FlatPoly {
  const nPts = pts.length / 2;
  const curve = cv.matFromArray(nPts, 1, cv.CV_32SC2, pts);
  const approx = new cv.Mat();
  cv.approxPolyDP(curve, approx, eps, true);
  const out = Array.from(approx.data32S as Int32Array);
  curve.delete();
  approx.delete();
  return out;
}

export function simplifyContour(cv: CV, pts: FlatPoly, eps: number): FlatPoly {
  if (eps <= 0 || pts.length < 8) return pts;
  let e = eps;
  for (;;) {
    const approx = approxOnce(cv, pts, e);
    // Reject degenerate results (collapsed to < triangle).
    if (approx.length >= 6 && isSimplePolygon(approx)) return approx;
    if (e <= 0.05) return pts.length >= 6 ? pts : approx;
    e /= 2;
  }
}
