// sRGB <-> CIE Lab. Quantization happens in Lab because Euclidean distance
// there tracks perceived color difference far better than in RGB.

const REF_X = 95.047;
const REF_Y = 100.0;
const REF_Z = 108.883;

function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const cs = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, cs)) * 255);
}

function pivotXyzToLab(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/** [r,g,b] 0..255 -> [L,a,b]. */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) * 100;
  const y = (rl * 0.2126 + gl * 0.7152 + bl * 0.0722) * 100;
  const z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) * 100;

  const fx = pivotXyzToLab(x / REF_X);
  const fy = pivotXyzToLab(y / REF_Y);
  const fz = pivotXyzToLab(z / REF_Z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** [L,a,b] -> [r,g,b] 0..255. */
export function labToRgb(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  const fx3 = fx * fx * fx;
  const fz3 = fz * fz * fz;
  const xr = fx3 > 0.008856 ? fx3 : (116 * fx - 16) / 903.3;
  const yr = L > 903.3 * 0.008856 ? Math.pow((L + 16) / 116, 3) : L / 903.3;
  const zr = fz3 > 0.008856 ? fz3 : (116 * fz - 16) / 903.3;

  const x = (xr * REF_X) / 100;
  const y = (yr * REF_Y) / 100;
  const z = (zr * REF_Z) / 100;

  const rl = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const gl = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const bl = x * 0.0557 + y * -0.204 + z * 1.057;

  return [linearToSrgb(rl), linearToSrgb(gl), linearToSrgb(bl)];
}

/** "#rrggbb" -> [r,g,b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** [r,g,b] -> "#rrggbb". */
export function rgbToHex(r: number, g: number, b: number): string {
  const to2 = (n: number) => n.toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}
