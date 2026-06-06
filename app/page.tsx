"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Drawer from "@mui/material/Drawer";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import DownloadIcon from "@mui/icons-material/Download";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import GitHubIcon from "@mui/icons-material/GitHub";
import Logo from "@/components/Logo";
import UploadButton from "@/components/UploadButton";
import ControlsPanel from "@/components/ControlsPanel";
import CompareStage from "@/components/CompareStage";
import StatsPanel from "@/components/StatsPanel";
import PresetMenu from "@/components/PresetMenu";
import { useVectorizer } from "@/lib/useVectorizer";
import { downloadSvg, downloadLayersZip, svgFilename } from "@/lib/download";
import { DEFAULT_PARAMS, type SourceImage, type VectorizeParams } from "@/lib/types";
import { decodeImageFile, firstImageFile } from "@/lib/loadImage";
import type { Preset } from "@/lib/presets";

const DRAWER_WIDTH = 320;
const DEBOUNCE_MS = 250;

export default function Home() {
  const [image, setImage] = useState<SourceImage | null>(null);
  const [params, setParams] = useState<VectorizeParams>(DEFAULT_PARAMS);
  const [error, setError] = useState<string | null>(null);
  const [dlAnchor, setDlAnchor] = useState<null | HTMLElement>(null);
  const [dragOver, setDragOver] = useState(false);
  // Nesting counter so child enter/leave events don't flicker the overlay.
  const dragDepth = useRef(0);
  const { run, result, status, progress, error: vecError } = useVectorizer();

  // Debounced live recompute on any image or param change (plan §6).
  useEffect(() => {
    if (!image) return;
    const t = setTimeout(() => run(image, params), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [image, params, run]);

  const patchParams = useCallback(
    (patch: Partial<VectorizeParams>) => setParams((p) => ({ ...p, ...patch })),
    [],
  );

  const applyPreset = useCallback(
    (preset: Preset) => setParams((p) => ({ ...p, ...preset.params })),
    [],
  );

  const loadFile = useCallback(async (file: File) => {
    try {
      setImage(await decodeImageFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decode that image.");
    }
  }, []);

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragOver(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragOver(false);
      const file = firstImageFile(e.dataTransfer);
      if (file) void loadFile(file);
    },
    [loadFile],
  );

  const handleDownload = useCallback(() => {
    if (!result || !image) return;
    downloadSvg(result.svg, svgFilename(image.name));
  }, [result, image]);

  const handleDownloadLayers = useCallback(() => {
    setDlAnchor(null);
    if (!result || !image) return;
    void downloadLayersZip(result.layers, image.name);
  }, [result, image]);

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <AppBar
        position="fixed"
        color="default"
        elevation={1}
        sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Logo size={28} />
            <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
              Vectorizer
            </Typography>
          </Box>
          {image && (
            <Chip
              size="small"
              variant="outlined"
              label={`${image.name} · ${image.width}×${image.height}`}
            />
          )}
          <Box sx={{ flexGrow: 1 }} />
          <PresetMenu onApply={applyPreset} disabled={!image} />
          <UploadButton onLoaded={setImage} onError={setError} />
          <ButtonGroup variant="outlined" disabled={!result}>
            <Button startIcon={<DownloadIcon />} onClick={handleDownload}>
              Download SVG
            </Button>
            <Button size="small" onClick={(e) => setDlAnchor(e.currentTarget)} aria-label="more export options">
              <ArrowDropDownIcon />
            </Button>
          </ButtonGroup>
          <Menu anchorEl={dlAnchor} open={!!dlAnchor} onClose={() => setDlAnchor(null)}>
            <MenuItem onClick={() => { setDlAnchor(null); handleDownload(); }}>
              All-in-one SVG
            </MenuItem>
            <MenuItem onClick={handleDownloadLayers}>
              Per-layer ZIP{result ? ` (${result.layers.length})` : ""}
            </MenuItem>
          </Menu>
          <Tooltip title="View source on GitHub">
            <IconButton
              component="a"
              href="https://github.com/DrNerf/vectorizer"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View source on GitHub"
              color="inherit"
            >
              <GitHubIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
          },
        }}
      >
        <Toolbar variant="dense" />
        <Box sx={{ overflow: "auto" }}>
          <ControlsPanel
            params={params}
            onChange={patchParams}
            resultPalette={result?.palette}
            disabled={!image}
          />
        </Box>
      </Drawer>

      <Box
        component="main"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        sx={{ position: "relative", flexGrow: 1, display: "flex", flexDirection: "column" }}
      >
        <Toolbar variant="dense" />
        {result && (
          <>
            <Box sx={{ p: 1 }}>
              <StatsPanel stats={result.stats} />
            </Box>
            <Divider />
          </>
        )}
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <CompareStage
            image={image}
            result={result?.preview}
            palette={result?.palette}
            faceBox={result?.faceBox}
            busy={status === "running"}
            progressLabel={progress?.stage}
            progressPct={progress?.pct}
          />
        </Box>

        {dragOver && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: (t) => t.zIndex.drawer + 2,
              display: "flex",
              flexDirection: "column",
              gap: 1,
              alignItems: "center",
              justifyContent: "center",
              color: "primary.contrastText",
              bgcolor: "rgba(25, 118, 210, 0.18)",
              backdropFilter: "blur(2px)",
              border: (t) => `3px dashed ${t.palette.primary.main}`,
              borderRadius: 1,
              pointerEvents: "none",
            }}
          >
            <FileUploadIcon sx={{ fontSize: 56, color: "primary.main" }} />
            <Typography variant="h6" sx={{ color: "text.primary" }}>
              Drop image to upload
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              PNG or JPG
            </Typography>
          </Box>
        )}
      </Box>

      <Snackbar
        open={!!error || status === "error"}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setError(null)} variant="filled">
          {error ?? vecError}
        </Alert>
      </Snackbar>
    </Box>
  );
}
