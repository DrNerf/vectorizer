"use client";

import { useCallback, useEffect, useState } from "react";
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
import DownloadIcon from "@mui/icons-material/Download";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import UploadButton from "@/components/UploadButton";
import ControlsPanel from "@/components/ControlsPanel";
import CompareStage from "@/components/CompareStage";
import StatsPanel from "@/components/StatsPanel";
import PresetMenu from "@/components/PresetMenu";
import { useVectorizer } from "@/lib/useVectorizer";
import { downloadSvg, downloadLayersZip, svgFilename } from "@/lib/download";
import { DEFAULT_PARAMS, type SourceImage, type VectorizeParams } from "@/lib/types";
import type { Preset } from "@/lib/presets";

const DRAWER_WIDTH = 320;
const DEBOUNCE_MS = 250;

export default function Home() {
  const [image, setImage] = useState<SourceImage | null>(null);
  const [params, setParams] = useState<VectorizeParams>(DEFAULT_PARAMS);
  const [error, setError] = useState<string | null>(null);
  const [dlAnchor, setDlAnchor] = useState<null | HTMLElement>(null);
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
          <Typography variant="h6" noWrap sx={{ fontWeight: 600 }}>
            Vectorizer
          </Typography>
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

      <Box component="main" sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
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
