// Stage 4 — face detect (plan §4.4). Find the largest skin-colored blob in
// the top 40% of the image; return its padded bounding box. Used to make
// despeckle region-aware (keep nose/eye detail, kill background specks).

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Common RGB skin-tone heuristic (Kovac et al.), good enough for region hints. */
function isSkin(r: number, g: number, b: number): boolean {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  return (
    r > 95 && g > 40 && b > 20 &&
    mx - mn > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b
  );
}

export function faceDetect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Box | null {
  const searchRows = Math.max(1, Math.floor(height * 0.4));
  const n = width * searchRows;
  const skin = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (isSkin(data[o], data[o + 1], data[o + 2])) skin[i] = 1;
  }

  // Largest 4-connected skin blob, tracking its bbox. Iterative stack flood.
  const seen = new Uint8Array(n);
  const stack: number[] = [];
  let bestArea = 0;
  let best: Box | null = null;

  for (let start = 0; start < n; start++) {
    if (!skin[start] || seen[start]) continue;
    let area = 0;
    let bx0 = width, by0 = searchRows, bx1 = 0, by1 = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const idx = stack.pop()!;
      const x = idx % width;
      const y = (idx / width) | 0;
      area++;
      if (x < bx0) bx0 = x;
      if (x > bx1) bx1 = x;
      if (y < by0) by0 = y;
      if (y > by1) by1 = y;
      if (x > 0 && skin[idx - 1] && !seen[idx - 1]) { seen[idx - 1] = 1; stack.push(idx - 1); }
      if (x < width - 1 && skin[idx + 1] && !seen[idx + 1]) { seen[idx + 1] = 1; stack.push(idx + 1); }
      if (y > 0 && skin[idx - width] && !seen[idx - width]) { seen[idx - width] = 1; stack.push(idx - width); }
      if (y < searchRows - 1 && skin[idx + width] && !seen[idx + width]) { seen[idx + width] = 1; stack.push(idx + width); }
    }
    if (area > bestArea) {
      bestArea = area;
      best = { x0: bx0, y0: by0, x1: bx1, y1: by1 };
    }
  }

  // Require a minimally face-sized blob to avoid latching onto stray skin px.
  if (!best || bestArea < width * height * 0.005) return null;

  // Pad the box by 20% of its size, clamped to the image.
  const padX = Math.round((best.x1 - best.x0) * 0.2);
  const padY = Math.round((best.y1 - best.y0) * 0.2);
  return {
    x0: Math.max(0, best.x0 - padX),
    y0: Math.max(0, best.y0 - padY),
    x1: Math.min(width - 1, best.x1 + padX),
    y1: Math.min(height - 1, best.y1 + padY),
  };
}
