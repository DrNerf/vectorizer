// Client-side file download via Blob + anchor (plan §7).

import JSZip from "jszip";

/** Strip the source extension. */
function baseName(sourceName: string): string {
  return sourceName.replace(/\.[^./\\]+$/, "");
}

/** Replace the source extension with .svg. */
export function svgFilename(sourceName: string): string {
  return baseName(sourceName) + ".svg";
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadSvg(svg: string, filename: string): void {
  triggerDownload(new Blob([svg], { type: "image/svg+xml" }), filename);
}

/** Bundle one SVG per color layer into a .zip and download it (plan §7). */
export async function downloadLayersZip(
  layers: { hex: string; svg: string }[],
  sourceName: string,
): Promise<void> {
  const zip = new JSZip();
  const base = baseName(sourceName);
  layers.forEach((layer, i) => {
    const idx = String(i + 1).padStart(2, "0");
    const hex = layer.hex.replace("#", "");
    zip.file(`${base}_layer${idx}_${hex}.svg`, layer.svg);
  });
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${base}_layers.zip`);
}
