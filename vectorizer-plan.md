# Vectorizer — Build Plan

Browser app. Turn digital image into layered SVG for 3D-printed posters. One closed shape per color. Watertight, no self-intersect, slicer-ready. All client-side.

---

## 1. Scope

- Input: raster image (PNG/JPG).
- Output: SVG. N paths, one per color. `fill-rule="nonzero"`, correct winding. All subpaths closed. No gaps, no self-cross.
- Same pipeline as Python prototype, ported to browser.
- No backend. Static deploy on Vercel.

## 2. Stack

- **Framework:** Next.js (static export) or Vite + React. Next picked — Vercel native, zero config.
- **UI:** Material UI (MUI v6).
- **Heavy compute:** `opencv.js` (WASM) for contour trace + connected components. Web Worker so UI not block.
- **Lang:** TypeScript.
- **Deploy:** Vercel, static. No serverless functions.

No backend = no upload. Image never leave browser. Privacy win, sell point.

## 3. Architecture

```
main thread (React + MUI)
  ├─ upload image -> ImageBitmap
  ├─ params state (controls)
  ├─ canvas previews (original, result)
  └─ post params + pixels -> Worker

worker thread
  ├─ opencv.js (WASM) loaded once
  ├─ run pipeline (quantize -> clean -> trace -> svg)
  ├─ post back: preview bitmap + path data + stats
  └─ debounced re-run on param change
```

Worker key. Pipeline = 5–15s on big image. Block main thread = frozen UI. Worker keep UI live, show progress.

## 4. Pipeline (port of prototype)

Order matters. Each stage own function in worker.

1. **Downscale guard** — cap working res (e.g. max 1600px long edge) for speed. Trace at work-res, scale path coords to full output viewBox.
2. **Quantize** — convert to Lab. Two modes:
   - Auto: KMeans (`ml-kmeans` JS, or hand-roll) on subsample (~80k px), assign all.
   - Fixed palette: snap each px to nearest palette color in Lab (loop per color, memory-safe).
3. **Smooth** — majority filter (3×3), N passes. Cuts staircase + tiny noise.
4. **Face detect** — largest skin-color blob in top 40%. Pad box. Used for region-aware cleanup.
5. **Region-aware despeckle** — connected components (4-conn). Drop blob if area < threshold. Threshold low inside face box (keep nose/eyes), high outside (kill specks). Removed px reassigned to nearest survivor.
   - Nearest fill = distance transform in Python. JS has none. Replace with **multi-source BFS** flood from survivor px. Correct, bit slower.
   - Inside face box: restore pre-smooth labels first, so thin nose lines not eroded.
6. **Trace per color** — for each color: split into 4-conn blobs, trace each alone (`cv.findContours`, RETR_CCOMP for holes). Per-blob isolation stop dilation welding two blobs into self-cross loop.
7. **Grow 1px** — cross-kernel dilate per blob. Neighbors overlap hair-thin = no gaps. Cross kernel (not square) avoid diagonal pinch.
8. **Simplify + guard** — `approxPolyDP` at EPS. Test self-intersect. If cross, halve EPS, retry down to 0. Guarantee simple polygons.
9. **Hole suppress** — drop holes with area < HOLE_MIN. Fill solid. Kills sub-printable pinholes.
10. **Winding** — outer CCW, hole CW. Makes nonzero == evenodd. Slicer-safe.
11. **Emit SVG** — one `<path>` per color. Subpaths `M ... Z`. Set width/height/viewBox to full res.

## 5. Controls (all params exposed)

MUI sliders/selects/switches. Group in collapsible accordions.

| Control | Type | Default | Range / notes |
|---|---|---|---|
| Color count K | slider | 8 | 2–16 (auto mode) |
| Palette mode | select | Auto | Auto KMeans / Fixed / Extract-from-image |
| Palette editor | color swatches | — | add/remove/edit hex; lock palette across images |
| Smoothing passes | slider | 1 | 0–4 |
| Simplify (EPS) | slider | 1.0 | 0–3 px. Lower = faithful, bigger file |
| Preserve face detail | switch | on | toggles region-aware |
| Face threshold | slider | 12 | 4–60 px |
| Body threshold | slider | 150 | 40–400 px |
| Hole min | slider | 70 | 0–300 px |
| Edge overlap (dilate) | slider | 1 | 0–2 px. 0 = exact partition (slivers); 1 = watertight |
| Fill rule | select | nonzero | nonzero / evenodd |
| Output width | number | src | px, scales viewBox |
| Working res cap | slider | 1600 | perf vs detail |

Presets: "Poster (safe)", "High detail", "Fast preview". One-click param bundles.

## 6. UI / Comparison view

Layout: left = controls drawer (MUI Drawer). Right = preview stage.

Preview stage = comparison. Options:

- **Slider wipe** — original under, result over, draggable divider. Best for spot-check detail (nose, embroidery).
- **Side-by-side** — two synced pan/zoom canvases.
- Toggle between modes.

Features:
- Pan + zoom (shared between both sides).
- Result rendered to canvas from path fills (fast) for live preview. Full SVG only built on export or on demand.
- Overlay toggles: show face box, show palette swatches, highlight tiny shapes (<N px) so user spot print-risk specks.
- Live stats panel: color count, total subpaths, open subpaths (should be 0), self-intersections (0), gap %, est. SVG size.

Live preview loop: param change -> debounce 250ms -> worker recompute -> canvas update. Show spinner / progress in stage during compute. Cheap params (fill rule, output width) update without full recompute.

## 7. Export

- **Download SVG** — main output. Blob + anchor download.
- Filename from source name.
- Optional: per-color SVG export (one file per layer) — some slicer flows want it.
- Copy palette as hex list (reuse across set, like Harry/Ron sharing Hermione palette).

## 8. Dependencies

```
next, react, @mui/material, @emotion/react, @emotion/styled
opencv.js          (WASM, ~8MB, load in worker, lazy)
ml-kmeans          (or hand-rolled kmeans)
```

opencv.js big. Lazy-load in worker after first image. Show "loading engine" once. Cache via browser.

## 9. Performance

- Worker for all heavy compute.
- WASM opencv for contour/CC (fast, native-ish).
- Downscale working res; scale coords up at emit.
- Debounce param changes. Split cheap vs expensive params — cheap re-render only.
- Cache intermediate stages: quantize result reused if only EPS/winding change. Invalidate by stage. Big speed win on tweak.
- Progress callbacks worker -> main per stage.

## 10. File structure

```
/app
  layout.tsx, page.tsx
/components
  ControlsPanel.tsx       (MUI controls, grouped)
  PaletteEditor.tsx
  CompareStage.tsx        (wipe + side-by-side)
  StatsPanel.tsx
  PresetMenu.tsx
/worker
  pipeline.worker.ts      (orchestrate stages)
  stages/
    quantize.ts
    smooth.ts
    faceDetect.ts
    despeckle.ts          (BFS reassign)
    trace.ts              (opencv contours)
    simplify.ts           (approxPolyDP + self-int guard)
    emitSvg.ts
  cvLoader.ts             (lazy opencv.js)
/lib
  geometry.ts             (winding, self-intersect test)
  palette.ts
  types.ts
```

## 11. Milestones

1. **M1 — skeleton:** Next + MUI shell, upload, canvas show original. Vercel deploy.
2. **M2 — engine in worker:** opencv.js load, quantize + emit SVG (no cleanup). Download works.
3. **M3 — full pipeline:** smooth, despeckle, trace, simplify, guard, holes, winding. Match Python output.
4. **M4 — controls:** all params wired, debounced live recompute.
5. **M5 — compare view:** wipe + side-by-side, pan/zoom, stats overlay.
6. **M6 — polish:** presets, palette editor, per-layer export, caching, progress UI.

## 12. Risks

- **opencv.js size (~8MB).** Lazy-load, cache, one-time "loading engine" msg. Acceptable.
- **No distance transform in JS.** BFS reassign replaces it. Verified-correct, watch speed on huge images.
- **Self-intersect from simplify.** Guard already designed (EPS backoff). Keep.
- **Float coords / winding mismatch.** Keep integer-ish coords; enforce winding explicitly.
- **Big images slow.** Working-res cap + worker + progress. Warn on huge upload.
- **Mobile memory.** WASM + big bitmap heavy. Cap res harder on mobile, or desktop-first.

## 13. Out of scope (v1)

- 3D mesh/STL generation. App stops at SVG. Slicer handles extrude.
- Account, save, cloud. Stateless, local only.
- Batch processing.
