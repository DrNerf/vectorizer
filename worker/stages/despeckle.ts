// Stage 5 — region-aware despeckle (plan §4.5).
// 4-connected components per label; drop blobs below an area threshold that is
// low inside the face box (keep nose/eyes) and high outside (kill specks).
// Removed pixels are reassigned to the nearest surviving label via multi-source
// BFS — the JS stand-in for Python's distance transform.

import type { Box } from "./faceDetect";

interface DespeckleArgs {
  labels: Uint8Array;
  /** Pre-smooth labels; restored inside the face box to protect thin detail. */
  preSmooth?: Uint8Array;
  width: number;
  height: number;
  faceBox: Box | null;
  faceThreshold: number;
  bodyThreshold: number;
  preserveFace: boolean;
}

function inBox(x: number, y: number, b: Box): boolean {
  return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
}

export function despeckle({
  labels,
  preSmooth,
  width,
  height,
  faceBox,
  faceThreshold,
  bodyThreshold,
  preserveFace,
}: DespeckleArgs): Uint8Array {
  const n = width * height;
  const out = labels.slice();

  // Restore pre-smooth labels inside the face box so thin lines survive.
  if (preserveFace && faceBox && preSmooth) {
    for (let y = faceBox.y0; y <= faceBox.y1; y++) {
      for (let x = faceBox.x0; x <= faceBox.x1; x++) {
        const i = y * width + x;
        out[i] = preSmooth[i];
      }
    }
  }

  // Label 4-connected components of `out`, flag tiny ones for removal.
  const comp = new Int32Array(n).fill(-1);
  const removed = new Uint8Array(n);
  const stack: number[] = [];
  let compId = 0;

  for (let start = 0; start < n; start++) {
    if (comp[start] !== -1) continue;
    const lbl = out[start];
    let area = 0;
    let cxSum = 0;
    let cySum = 0;
    const members: number[] = [];
    stack.push(start);
    comp[start] = compId;
    while (stack.length) {
      const idx = stack.pop()!;
      const x = idx % width;
      const y = (idx / width) | 0;
      area++;
      cxSum += x;
      cySum += y;
      members.push(idx);
      if (x > 0 && comp[idx - 1] === -1 && out[idx - 1] === lbl) { comp[idx - 1] = compId; stack.push(idx - 1); }
      if (x < width - 1 && comp[idx + 1] === -1 && out[idx + 1] === lbl) { comp[idx + 1] = compId; stack.push(idx + 1); }
      if (y > 0 && comp[idx - width] === -1 && out[idx - width] === lbl) { comp[idx - width] = compId; stack.push(idx - width); }
      if (y < height - 1 && comp[idx + width] === -1 && out[idx + width] === lbl) { comp[idx + width] = compId; stack.push(idx + width); }
    }

    const insideFace =
      !!faceBox && inBox((cxSum / area) | 0, (cySum / area) | 0, faceBox);
    const threshold = insideFace ? faceThreshold : bodyThreshold;
    if (area < threshold) {
      for (const m of members) removed[m] = 1;
    }
    compId++;
  }

  // Don't reassign if nothing (or everything) was removed.
  let removedCount = 0;
  for (let i = 0; i < n; i++) removedCount += removed[i];
  if (removedCount === 0 || removedCount === n) return out;

  // Multi-source BFS: seed every survivor, flood nearest label into removed px.
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const assigned = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!removed[i]) {
      assigned[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx / width) | 0;
    const lbl = out[idx];
    if (x > 0) { const j = idx - 1; if (removed[j] && !assigned[j]) { out[j] = lbl; assigned[j] = 1; queue[tail++] = j; } }
    if (x < width - 1) { const j = idx + 1; if (removed[j] && !assigned[j]) { out[j] = lbl; assigned[j] = 1; queue[tail++] = j; } }
    if (y > 0) { const j = idx - width; if (removed[j] && !assigned[j]) { out[j] = lbl; assigned[j] = 1; queue[tail++] = j; } }
    if (y < height - 1) { const j = idx + width; if (removed[j] && !assigned[j]) { out[j] = lbl; assigned[j] = 1; queue[tail++] = j; } }
  }

  return out;
}
