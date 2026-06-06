<div align="center">

<img src="app/icon.svg" width="72" height="72" alt="Vectorizer logo" />

# Vectorizer

**Turn any image into a layered, slicer-ready SVG for 3D-printed posters.**

Color control. Watertight precision. 100% in your browser.

</div>

---

> **Works fully offline — nothing is ever uploaded.**
> Vectorizer runs entirely in your browser. Your image is decoded and processed on your
> own device; it is never uploaded, sent to a server, or stored anywhere. There is no
> backend, no account, and no network round-trip — load the page once and you can even
> pull the plug.

---

## What it does

Vectorizer converts a raster image (PNG/JPG) into a clean **layered SVG** designed for
**3D-printed multi-color posters**. Each color becomes one closed, watertight shape — one
layer your slicer can extrude and assign to a filament/AMS slot.

The output is built to survive the slicer:

- **One path per color** — every color is a single layer, ready for per-color extrusion.
- **Watertight** — subpaths are closed, layers overlap hair-thin (no gaps, no slivers).
- **Simple polygons** — self-intersection guard guarantees printable, valid geometry.
- **No sub-printable noise** — tiny specks and pinholes are removed before export.
- **Correct winding** — outer/hole windings set so `nonzero` and `evenodd` agree; slicer-safe.

Everything runs client-side. Your image never leaves the browser — no upload, no server, no account.

## Why it's precise

The pipeline is a faithful browser port of a reference Python prototype, powered by
**OpenCV (WASM)** for contour tracing and connected-component analysis, run in a Web Worker
so the UI stays live. The stages:

1. **Downscale guard** — process at a capped working resolution, scale path coords back up on emit.
2. **Quantize** — reduce to N colors in Lab space (KMeans auto, fixed palette, or extract-from-image).
3. **Smooth** — majority filter passes to cut the staircase and tiny noise.
4. **Face detect** — locate the face so cleanup can preserve fine facial detail.
5. **Region-aware despeckle** — drop blobs below a size threshold (lower inside the face, higher outside).
6. **Trace per color** — isolate each blob and trace contours individually (holes preserved).
7. **Grow 1px** — cross-kernel dilate so neighboring layers overlap and leave no gaps.
8. **Simplify + guard** — `approxPolyDP` with EPS backoff until polygons are self-intersection-free.
9. **Hole suppress** — fill holes too small to print.
10. **Winding** — outer CCW, holes CW.
11. **Emit SVG** — one `<path>` per color at full output resolution.

## Color control

A live controls panel (every parameter has a hover tooltip) drives a debounced re-compute:

| Control | What it does |
| --- | --- |
| **Color count (K)** | Number of colors / layers in the output. |
| **Palette mode** | Auto (KMeans), Fixed (your own hex palette), or Extract-from-image. |
| **Palette editor** | Add/remove/edit hex swatches; reuse a locked palette across a set of images. |
| **Smoothing passes** | Rounder, simpler edges. |
| **Preserve face detail** | Region-aware cleanup that keeps fine facial features. |
| **Face / Body threshold** | Minimum kept region size inside vs. outside the face. |
| **Hole min** | Smallest hole kept before it's filled. |
| **Simplify EPS** | Path-point reduction — smaller files vs. more faithful outlines. |
| **Edge overlap** | Layer dilation for watertight, gap-free seams. |
| **Fill rule** | `nonzero` / `evenodd`. |
| **Output width** | Exported SVG width in px (height scales to keep aspect). |
| **Working res cap** | Processing resolution — speed vs. detail. |

**Presets** bundle these into one click: _Poster (safe)_, _High detail_, _Fast preview_.

## Compare & export

- **Wipe** and **side-by-side** compare views, with shared pan/zoom.
- Overlays for the detected face box and the resolved palette.
- A live **stats panel**: color count, subpaths, open subpaths (should be 0), self-intersections (0), SVG size.
- Load images by **drag-and-drop** onto the canvas, or the Upload button.
- Export the **all-in-one SVG**, or a **per-layer ZIP** (one SVG per color) for slicer flows that want them.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), drop in a PNG or JPG, and tune.

> First run lazy-loads the OpenCV WASM engine (~8 MB) once, then caches it.

### Build

```bash
npm run build
npm run start
```

## Tech stack

- **Next.js 16** + **React 19** (App Router)
- **Material UI v9**
- **OpenCV.js** (WASM) for contour tracing + connected components, in a Web Worker
- **ml-kmeans** for palette quantization
- **JSZip** for per-layer export
- **TypeScript** throughout

Static, client-only — deploys to Vercel with no serverless functions.

## Privacy

No backend, no upload. Images are decoded and processed entirely in your browser; nothing is
ever sent anywhere.

## Out of scope (v1)

3D mesh/STL generation (the app stops at SVG — your slicer handles the extrude), accounts/cloud
saves, and batch processing.
