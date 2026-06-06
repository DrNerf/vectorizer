// Stage 3 — smooth (plan §4.3). 3x3 majority filter, N passes.
// Cuts staircase edges and tiny single-pixel noise before despeckle.

export function smooth(
  labels: Uint8Array,
  width: number,
  height: number,
  colorCount: number,
  passes: number,
): Uint8Array {
  if (passes <= 0) return labels;

  let src = labels;
  const counts = new Int32Array(colorCount);

  for (let p = 0; p < passes; p++) {
    const dst = new Uint8Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        counts.fill(0);
        let best = src[y * width + x];
        let bestCount = -1;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const lbl = src[ny * width + nx];
            const c = ++counts[lbl];
            // Tie-break toward the current center label for stability.
            if (c > bestCount || (c === bestCount && lbl === src[y * width + x])) {
              bestCount = c;
              best = lbl;
            }
          }
        }
        dst[y * width + x] = best;
      }
    }
    src = dst;
  }

  return src;
}
