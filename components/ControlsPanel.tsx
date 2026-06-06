"use client";

import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Slider from "@mui/material/Slider";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PaletteEditor from "./PaletteEditor";
import type { VectorizeParams, PaletteMode, FillRule } from "@/lib/types";

interface ControlsPanelProps {
  params: VectorizeParams;
  onChange: (patch: Partial<VectorizeParams>) => void;
  /** Current result palette, for the editor's "Use current" seed. */
  resultPalette?: string[];
  /** Disabled until an image is loaded. */
  disabled?: boolean;
}

/** Controls drawer (plan §5). All params bound to state; changes debounce-recompute. */
export default function ControlsPanel({ params, onChange, resultPalette, disabled }: ControlsPanelProps) {
  const set =
    <K extends keyof VectorizeParams>(key: K) =>
    (_: unknown, value: number | number[]) =>
      onChange({ [key]: Array.isArray(value) ? value[0] : value } as Partial<VectorizeParams>);

  return (
    <Box sx={{ p: 1.5 }}>
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Color</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2.5}>
            <Labeled
              label={`Color count (K): ${params.k}`}
              info="Number of colors in the output palette. Higher = more detail but a larger SVG. Disabled in Fixed palette mode."
            >
              <Slider
                disabled={disabled || params.paletteMode === "fixed"}
                value={params.k}
                onChange={set("k")}
                min={2}
                max={16}
                step={1}
                valueLabelDisplay="auto"
              />
            </Labeled>
            <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
              <FormControl size="small" fullWidth disabled={disabled}>
                <InputLabel id="palette-mode">Palette mode</InputLabel>
                <Select
                  labelId="palette-mode"
                  label="Palette mode"
                  value={params.paletteMode}
                  onChange={(e) => onChange({ paletteMode: e.target.value as PaletteMode })}
                >
                  <MenuItem value="auto">Auto (KMeans)</MenuItem>
                  <MenuItem value="fixed">Fixed palette</MenuItem>
                  <MenuItem value="extract">Extract from image</MenuItem>
                </Select>
              </FormControl>
              <InfoTip text="How the palette is chosen. Auto: KMeans clusters the image into K colors. Fixed: use your own palette below. Extract: pull the K most dominant colors from the image." />
            </Stack>
            {params.paletteMode === "fixed" && (
              <PaletteEditor
                palette={params.palette}
                onChange={(palette) => onChange({ palette })}
                resultPalette={resultPalette}
              />
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Cleanup</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2.5}>
            <Labeled
              label={`Smoothing passes: ${params.smoothingPasses}`}
              info="Number of boundary-smoothing iterations. More passes give rounder, simpler edges; 0 keeps the raw pixel-stair outline."
            >
              <Slider
                disabled={disabled}
                value={params.smoothingPasses}
                onChange={set("smoothingPasses")}
                min={0}
                max={4}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Labeled>
            <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    disabled={disabled}
                    checked={params.preserveFace}
                    onChange={(e) => onChange({ preserveFace: e.target.checked })}
                  />
                }
                label="Preserve face detail"
              />
              <InfoTip text="Detect a face and keep finer detail inside that region, using the lower Face threshold there instead of the Body threshold." />
            </Stack>
            <Labeled
              label={`Face threshold: ${params.faceThreshold} px`}
              info="Minimum region area (px) kept inside the detected face. Smaller retains more facial detail. Requires Preserve face detail."
            >
              <Slider
                disabled={disabled || !params.preserveFace}
                value={params.faceThreshold}
                onChange={set("faceThreshold")}
                min={4}
                max={60}
                valueLabelDisplay="auto"
              />
            </Labeled>
            <Labeled
              label={`Body threshold: ${params.bodyThreshold} px`}
              info="Minimum region area (px) kept outside the face. Larger drops small specks in the body and background."
            >
              <Slider
                disabled={disabled}
                value={params.bodyThreshold}
                onChange={set("bodyThreshold")}
                min={40}
                max={400}
                valueLabelDisplay="auto"
              />
            </Labeled>
            <Labeled
              label={`Hole min: ${params.holeMin} px`}
              info="Minimum hole area (px) kept inside a region. Holes smaller than this are filled with the surrounding color."
            >
              <Slider
                disabled={disabled}
                value={params.holeMin}
                onChange={set("holeMin")}
                min={0}
                max={300}
                valueLabelDisplay="auto"
              />
            </Labeled>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Geometry &amp; output</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2.5}>
            <Labeled
              label={`Simplify EPS: ${params.simplifyEps.toFixed(1)} px`}
              info="approxPolyDP epsilon (px). Higher removes more path points — smoother, smaller paths but less faithful outlines. 0 keeps every point."
            >
              <Slider
                disabled={disabled}
                value={params.simplifyEps}
                onChange={set("simplifyEps")}
                min={0}
                max={3}
                step={0.1}
                valueLabelDisplay="auto"
              />
            </Labeled>
            <Labeled
              label={`Edge overlap (dilate): ${params.edgeOverlap} px`}
              info="Dilate radius (px) added to each color layer so neighboring layers overlap slightly, hiding seams and anti-alias gaps between them."
            >
              <Slider
                disabled={disabled}
                value={params.edgeOverlap}
                onChange={set("edgeOverlap")}
                min={0}
                max={2}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Labeled>
            <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
              <FormControl size="small" fullWidth disabled={disabled}>
                <InputLabel id="fill-rule">Fill rule</InputLabel>
                <Select
                  labelId="fill-rule"
                  label="Fill rule"
                  value={params.fillRule}
                  onChange={(e) => onChange({ fillRule: e.target.value as FillRule })}
                >
                  <MenuItem value="nonzero">nonzero</MenuItem>
                  <MenuItem value="evenodd">evenodd</MenuItem>
                </Select>
              </FormControl>
              <InfoTip text="SVG fill-rule for paths with holes. nonzero fills by winding direction; evenodd toggles fill on each boundary crossing. Switch if holes render filled or inverted." />
            </Stack>
            <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Output width (px)"
                disabled={disabled}
                value={params.outputWidth ?? ""}
                placeholder="source width"
                onChange={(e) => {
                  const v = e.target.value.trim();
                  onChange({ outputWidth: v === "" ? undefined : Math.max(1, parseInt(v, 10) || 1) });
                }}
              />
              <InfoTip text="Width of the exported SVG in px. Leave blank to match the source width. Height scales automatically to keep the aspect ratio." />
            </Stack>
            <Labeled
              label={`Working res cap: ${params.workingResCap} px`}
              info="Long-edge cap (px) for the internal processing resolution. Lower is faster but coarser; higher is sharper but slower. Does not change the export size."
            >
              <Slider
                disabled={disabled}
                value={params.workingResCap}
                onChange={set("workingResCap")}
                min={600}
                max={3000}
                step={100}
                valueLabelDisplay="auto"
              />
            </Labeled>
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}

function Labeled({
  label,
  info,
  children,
}: {
  label: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Stack sx={{ flexDirection: "row", alignItems: "center", gap: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {info && <InfoTip text={info} />}
      </Stack>
      {children}
    </Box>
  );
}

/** Small info icon with a hover/focus tooltip explaining a setting. */
function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip title={text} arrow enterTouchDelay={0} leaveTouchDelay={4000}>
      <InfoOutlinedIcon
        fontSize="small"
        sx={{ color: "text.disabled", cursor: "help", fontSize: 16 }}
      />
    </Tooltip>
  );
}
