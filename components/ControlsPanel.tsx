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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
            <Labeled label={`Color count (K): ${params.k}`}>
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
            <Labeled label={`Smoothing passes: ${params.smoothingPasses}`}>
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
            <Labeled label={`Face threshold: ${params.faceThreshold} px`}>
              <Slider
                disabled={disabled || !params.preserveFace}
                value={params.faceThreshold}
                onChange={set("faceThreshold")}
                min={4}
                max={60}
                valueLabelDisplay="auto"
              />
            </Labeled>
            <Labeled label={`Body threshold: ${params.bodyThreshold} px`}>
              <Slider
                disabled={disabled}
                value={params.bodyThreshold}
                onChange={set("bodyThreshold")}
                min={40}
                max={400}
                valueLabelDisplay="auto"
              />
            </Labeled>
            <Labeled label={`Hole min: ${params.holeMin} px`}>
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
            <Labeled label={`Simplify EPS: ${params.simplifyEps.toFixed(1)} px`}>
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
            <Labeled label={`Edge overlap (dilate): ${params.edgeOverlap} px`}>
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
            <TextField
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
            <Labeled label={`Working res cap: ${params.workingResCap} px`}>
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

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Box>
  );
}
