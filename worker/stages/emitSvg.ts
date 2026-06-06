// Stage 11 — emit SVG (plan §4.11).
// One <path> per color, contours as closed M..Z subpaths. Coordinates scaled
// from working res to the output viewBox. Also emits one standalone SVG per
// color layer for per-layer export (plan §7).

import { rgbToHex } from "@/lib/color";
import type { FillRule } from "@/lib/types";
import type { ContoursPerColor } from "./trace";

export interface SvgLayer {
  hex: string;
  svg: string;
}

export interface EmitResult {
  svg: string;
  layers: SvgLayer[];
  subpaths: number;
}

/** Round to 2 decimals, dropping trailing ".00" noise. */
function n(v: number): string {
  return Number(v.toFixed(2)).toString();
}

function svgDoc(outWidth: number, outHeight: number, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${outWidth}" height="${outHeight}" ` +
    `viewBox="0 0 ${outWidth} ${outHeight}">` +
    body +
    `</svg>`
  );
}

export function emitSvg(
  contoursPerColor: ContoursPerColor,
  paletteRgb: [number, number, number][],
  outScale: number,
  outWidth: number,
  outHeight: number,
  fillRule: FillRule,
): EmitResult {
  let subpaths = 0;
  const paths: string[] = [];
  const layers: SvgLayer[] = [];

  for (let c = 0; c < contoursPerColor.length; c++) {
    const contours = contoursPerColor[c];
    if (contours.length === 0) continue;

    let d = "";
    for (const pts of contours) {
      d += `M${n(pts[0] * outScale)} ${n(pts[1] * outScale)}`;
      for (let i = 2; i < pts.length; i += 2) {
        d += `L${n(pts[i] * outScale)} ${n(pts[i + 1] * outScale)}`;
      }
      d += "Z";
      subpaths++;
    }

    const [r, g, b] = paletteRgb[c];
    const hex = rgbToHex(r, g, b);
    const path = `<path fill="${hex}" fill-rule="${fillRule}" d="${d}"/>`;
    paths.push(path);
    layers.push({ hex, svg: svgDoc(outWidth, outHeight, path) });
  }

  return { svg: svgDoc(outWidth, outHeight, paths.join("")), layers, subpaths };
}
