"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import LinearProgress from "@mui/material/LinearProgress";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Divider from "@mui/material/Divider";
import ImageIcon from "@mui/icons-material/Image";
import CompareIcon from "@mui/icons-material/Compare";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import PaletteIcon from "@mui/icons-material/Palette";
import FaceIcon from "@mui/icons-material/Face";
import type { SourceImage, FaceBox } from "@/lib/types";

interface PreviewData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface CompareStageProps {
  image: SourceImage | null;
  result?: PreviewData | null;
  palette?: string[];
  faceBox?: FaceBox | null;
  busy?: boolean;
  progressLabel?: string;
  progressPct?: number;
}

type Mode = "wipe" | "side";
interface View {
  zoom: number;
  cx: number; // normalized [0..1] image x at pane center
  cy: number;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 20;

export default function CompareStage({
  image,
  result,
  palette,
  faceBox,
  busy,
  progressLabel,
  progressPct,
}: CompareStageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const origRef = useRef<HTMLCanvasElement>(null);
  const resRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [mode, setMode] = useState<Mode>("wipe");
  const [divider, setDivider] = useState(0.5);
  const [view, setView] = useState<View>({ zoom: 1, cx: 0.5, cy: 0.5 });
  const [showPalette, setShowPalette] = useState(false);
  const [showFace, setShowFace] = useState(false);

  const hasResult = !!result;

  // Offscreen canvas for the quantized result.
  const resCanvas = useMemo(() => {
    if (!result) return null;
    const c = document.createElement("canvas");
    c.width = result.width;
    c.height = result.height;
    c.getContext("2d")!.putImageData(
      new ImageData(new Uint8ClampedArray(result.data), result.width, result.height),
      0,
      0,
    );
    return c;
  }, [result]);

  // Reference dims for shared transform math (result if present, else source).
  const refDims = result
    ? { w: result.width, h: result.height }
    : image
      ? { w: image.width, h: image.height }
      : { w: 1, h: 1 };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Reset the view when a new image loads (render-time prop-change pattern).
  const [prevImage, setPrevImage] = useState(image);
  if (image !== prevImage) {
    setPrevImage(image);
    setView({ zoom: 1, cx: 0.5, cy: 0.5 });
  }

  const paneW = mode === "side" && hasResult ? size.w / 2 : size.w;
  const paneH = size.h;

  // fit/scale for the reference dims at the current pane size.
  const fit = Math.min(paneW / refDims.w, paneH / refDims.h) || 1;
  const refScale = fit * view.zoom;

  // Draw one source into a canvas using the shared transform.
  const drawInto = useCallback(
    (
      canvas: HTMLCanvasElement | null,
      source: CanvasImageSource | null,
      sw: number,
      sh: number,
      crisp: boolean,
      box: FaceBox | null,
    ) => {
      if (!canvas || !source || paneW <= 0 || paneH <= 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(paneW * dpr);
      canvas.height = Math.round(paneH * dpr);
      canvas.style.width = `${paneW}px`;
      canvas.style.height = `${paneH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, paneW, paneH);

      const s = Math.min(paneW / sw, paneH / sh) * view.zoom;
      const destW = sw * s;
      const destH = sh * s;
      const destX = paneW / 2 - view.cx * destW;
      const destY = paneH / 2 - view.cy * destH;
      ctx.imageSmoothingEnabled = !crisp;
      if (!crisp) ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, destX, destY, destW, destH);

      if (box) {
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          destX + box.x0 * s,
          destY + box.y0 * s,
          (box.x1 - box.x0) * s,
          (box.y1 - box.y0) * s,
        );
      }
    },
    [paneW, paneH, view],
  );

  // Render on any relevant change.
  useEffect(() => {
    if (image) drawInto(origRef.current, image.bitmap, image.width, image.height, false, null);
    if (resCanvas && result)
      drawInto(
        resRef.current,
        resCanvas,
        result.width,
        result.height,
        true,
        showFace ? faceBox ?? null : null,
      );
  }, [image, result, resCanvas, drawInto, mode, divider, showFace, faceBox, size]);

  // --- interaction ---
  const dragging = useRef<{ x: number; y: number } | null>(null);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    // Cursor position within its pane.
    let px = e.clientX - rect.left;
    if (mode === "side" && hasResult && px > size.w / 2) px -= size.w / 2;
    const py = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setView((v) => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      const sOld = fit * v.zoom * refDims.w;
      const sOldY = fit * v.zoom * refDims.h;
      const nx = v.cx + (px - paneW / 2) / sOld;
      const ny = v.cy + (py - paneH / 2) / sOldY;
      const sNew = fit * newZoom * refDims.w;
      const sNewY = fit * newZoom * refDims.h;
      return {
        zoom: newZoom,
        cx: nx - (px - paneW / 2) / sNew,
        cy: ny - (py - paneH / 2) / sNewY,
      };
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    dragging.current = { x: e.clientX, y: e.clientY };
    setView((v) => ({
      ...v,
      cx: v.cx - dx / (refScale * refDims.w),
      cy: v.cy - dy / (refScale * refDims.h),
    }));
  };
  const onPointerUp = () => {
    dragging.current = null;
  };

  const zoomBy = (factor: number) =>
    setView((v) => ({ ...v, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor)) }));
  const resetView = () => setView({ zoom: 1, cx: 0.5, cy: 0.5 });

  // Draggable wipe divider.
  const onDividerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rect = containerRef.current!.getBoundingClientRect();
      setDivider(Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const empty = !image && !hasResult;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar
        mode={mode}
        setMode={setMode}
        hasResult={hasResult}
        zoomBy={zoomBy}
        resetView={resetView}
        showPalette={showPalette}
        setShowPalette={setShowPalette}
        showFace={showFace}
        setShowFace={setShowFace}
        hasFace={!!faceBox}
      />
      <Box
        ref={containerRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        sx={{
          position: "relative",
          flexGrow: 1,
          minHeight: 0,
          overflow: "hidden",
          cursor: "grab",
          touchAction: "none",
          backgroundImage: "repeating-conic-gradient(#2a2a2a 0% 25%, #1e1e1e 0% 50%)",
          backgroundSize: "24px 24px",
        }}
      >
        {empty && (
          <Stack spacing={1} sx={{ height: "100%", alignItems: "center", justifyContent: "center", color: "text.secondary", px: 3, textAlign: "center" }}>
            <ImageIcon sx={{ fontSize: 48, opacity: 0.5 }} />
            <Typography variant="body1">No image yet</Typography>
            <Typography variant="body2" sx={{ opacity: 0.7 }}>Drag &amp; drop, or use Upload — PNG or JPG.</Typography>
            <Typography variant="body2" sx={{ opacity: 0.7, maxWidth: 420, mt: 1 }}>
              Everything runs offline, right here in your browser. Your image is never
              uploaded, sent to a server, or stored anywhere — it never leaves your device.
            </Typography>
          </Stack>
        )}

        {/* Original (bottom layer / left pane) */}
        <canvas
          ref={origRef}
          style={{ position: "absolute", top: 0, left: 0, display: image ? "block" : "none" }}
        />

        {hasResult && mode === "wipe" && (
          <>
            {/* Result clipped to the left of the divider */}
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                height: "100%",
                width: `${divider * 100}%`,
                overflow: "hidden",
              }}
            >
              <canvas ref={resRef} style={{ position: "absolute", top: 0, left: 0 }} />
            </Box>
            <DividerHandle x={divider} onDown={onDividerDown} />
          </>
        )}

        {hasResult && mode === "side" && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              right: 0,
              height: "100%",
              width: "50%",
              overflow: "hidden",
              borderLeft: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            <canvas ref={resRef} style={{ position: "absolute", top: 0, left: 0 }} />
          </Box>
        )}

        {showPalette && palette && palette.length > 0 && (
          <Paper
            data-testid="palette-overlay"
            elevation={3}
            sx={{ position: "absolute", left: 8, bottom: 8, p: 0.75, display: "flex", gap: 0.5, flexWrap: "wrap", maxWidth: 220 }}
          >
            {palette.map((hex, i) => (
              <Tooltip key={`${hex}-${i}`} title={hex}>
                <Box sx={{ width: 20, height: 20, borderRadius: 0.5, bgcolor: hex, border: "1px solid rgba(255,255,255,0.2)" }} />
              </Tooltip>
            ))}
          </Paper>
        )}

        {busy && (
          <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, p: 1.5, bgcolor: "rgba(0,0,0,0.55)" }}>
            <Typography variant="caption" color="common.white">{progressLabel ?? "Working…"}</Typography>
            <LinearProgress
              variant={progressPct != null ? "determinate" : "indeterminate"}
              value={progressPct != null ? Math.round(progressPct * 100) : undefined}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}

function Toolbar(props: {
  mode: Mode;
  setMode: (m: Mode) => void;
  hasResult: boolean;
  zoomBy: (f: number) => void;
  resetView: () => void;
  showPalette: boolean;
  setShowPalette: (v: boolean) => void;
  showFace: boolean;
  setShowFace: (v: boolean) => void;
  hasFace: boolean;
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ p: 0.5, alignItems: "center", borderBottom: 1, borderColor: "divider" }}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={props.mode}
        onChange={(_, v) => v && props.setMode(v)}
        disabled={!props.hasResult}
      >
        <ToggleButton value="wipe"><CompareIcon fontSize="small" sx={{ mr: 0.5 }} />Wipe</ToggleButton>
        <ToggleButton value="side"><ViewColumnIcon fontSize="small" sx={{ mr: 0.5 }} />Side</ToggleButton>
      </ToggleButtonGroup>
      <Divider orientation="vertical" flexItem />
      <Tooltip title="Zoom in"><IconButton size="small" onClick={() => props.zoomBy(1.25)}><ZoomInIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Zoom out"><IconButton size="small" onClick={() => props.zoomBy(0.8)}><ZoomOutIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="Reset view"><IconButton size="small" onClick={props.resetView}><CenterFocusStrongIcon fontSize="small" /></IconButton></Tooltip>
      <Box sx={{ flexGrow: 1 }} />
      <ToggleButton
        size="small"
        value="palette"
        selected={props.showPalette}
        onChange={() => props.setShowPalette(!props.showPalette)}
        disabled={!props.hasResult}
      >
        <PaletteIcon fontSize="small" sx={{ mr: 0.5 }} />Palette
      </ToggleButton>
      <ToggleButton
        size="small"
        value="face"
        selected={props.showFace}
        onChange={() => props.setShowFace(!props.showFace)}
        disabled={!props.hasFace}
      >
        <FaceIcon fontSize="small" sx={{ mr: 0.5 }} />Face box
      </ToggleButton>
    </Stack>
  );
}

function DividerHandle({ x, onDown }: { x: number; onDown: (e: React.PointerEvent) => void }) {
  return (
    <Box
      onPointerDown={onDown}
      sx={{
        position: "absolute",
        top: 0,
        left: `${x * 100}%`,
        height: "100%",
        width: 0,
        borderLeft: "2px solid #fff",
        cursor: "ew-resize",
        zIndex: 2,
        "&::before": {
          content: '""',
          position: "absolute",
          top: "50%",
          left: -10,
          width: 20,
          height: 36,
          transform: "translateY(-50%)",
          borderRadius: 1,
          bgcolor: "#fff",
          opacity: 0.85,
        },
      }}
    />
  );
}

