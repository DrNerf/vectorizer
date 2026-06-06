// Polygon geometry helpers (plan §4.8–4.10): winding control and a
// self-intersection test for the simplify guard. Contours are flat
// [x0,y0,x1,y1,...] point lists (closed implicitly; last point != first).

export type FlatPoly = number[];

/** Shoelace signed area. In image coords (y-down): >0 = clockwise. */
export function signedArea(pts: FlatPoly): number {
  let a = 0;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const x1 = pts[i * 2];
    const y1 = pts[i * 2 + 1];
    const j = (i + 1) % n;
    const x2 = pts[j * 2];
    const y2 = pts[j * 2 + 1];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function polygonArea(pts: FlatPoly): number {
  return Math.abs(signedArea(pts));
}

/**
 * Force orientation. `wantClockwise` true → clockwise in image coords.
 * Plan §4.10: outer CCW, holes CW so nonzero == evenodd for a slicer.
 * (CCW in image coords means signedArea < 0.)
 */
export function setWinding(pts: FlatPoly, wantClockwise: boolean): FlatPoly {
  const cw = signedArea(pts) > 0;
  if (cw === wantClockwise) return pts;
  // Reverse point order in place-ish (returns a new reversed flat array).
  const n = pts.length / 2;
  const out = new Array<number>(pts.length);
  for (let i = 0; i < n; i++) {
    const src = (n - 1 - i) * 2;
    out[i * 2] = pts[src];
    out[i * 2 + 1] = pts[src + 1];
  }
  return out;
}

// --- self-intersection test ---

function onSegment(px: number, py: number, qx: number, qy: number, rx: number, ry: number) {
  return (
    Math.min(px, rx) <= qx &&
    qx <= Math.max(px, rx) &&
    Math.min(py, ry) <= qy &&
    qy <= Math.max(py, ry)
  );
}

function orient(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  const v = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  return v > 0 ? 1 : v < 0 ? 2 : 0;
}

function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, cx, cy, bx, by)) return true;
  if (o2 === 0 && onSegment(ax, ay, dx, dy, bx, by)) return true;
  if (o3 === 0 && onSegment(cx, cy, ax, ay, dx, dy)) return true;
  if (o4 === 0 && onSegment(cx, cy, bx, by, dx, dy)) return true;
  return false;
}

/**
 * True if the closed polygon has no self-intersections (simple polygon).
 * O(n^2) — fine for the small contours we feed it after simplify.
 * Adjacent edges sharing an endpoint are not counted as crossings.
 */
export function isSimplePolygon(pts: FlatPoly): boolean {
  const n = pts.length / 2;
  if (n < 4) return true;
  for (let i = 0; i < n; i++) {
    const a = i;
    const b = (i + 1) % n;
    for (let j = i + 1; j < n; j++) {
      const c = j;
      const d = (j + 1) % n;
      // Skip shared-endpoint neighbors (including the wrap-around pair).
      if (a === c || a === d || b === c || b === d) continue;
      if (
        segmentsIntersect(
          pts[a * 2], pts[a * 2 + 1], pts[b * 2], pts[b * 2 + 1],
          pts[c * 2], pts[c * 2 + 1], pts[d * 2], pts[d * 2 + 1],
        )
      ) {
        return false;
      }
    }
  }
  return true;
}
