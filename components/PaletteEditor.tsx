"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ColorLensIcon from "@mui/icons-material/ColorLens";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export default function PaletteEditor({
  palette,
  onChange,
  resultPalette,
}: {
  palette: string[];
  onChange: (palette: string[]) => void;
  /** Current auto/extracted palette, offered as a seed. */
  resultPalette?: string[];
}) {
  const setAt = (i: number, hex: string) => {
    const next = palette.slice();
    next[i] = hex;
    onChange(next);
  };
  const removeAt = (i: number) => onChange(palette.filter((_, j) => j !== i));
  const add = () => onChange([...palette, "#888888"]);
  const seedFromResult = () => resultPalette && onChange([...resultPalette]);
  const copyHex = () => navigator.clipboard?.writeText(palette.join(", "));

  return (
    <Box>
      <Stack spacing={1}>
        {palette.length < 2 && (
          <Typography variant="caption" color="warning.main">
            Add at least 2 colors, or it falls back to Auto.
          </Typography>
        )}
        {palette.map((hex, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {/* No MUI color picker exists — native input is the swatch control. */}
            <Box
              component="input"
              type="color"
              value={HEX_RE.test(hex) ? hex : "#888888"}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAt(i, e.target.value)}
              sx={{
                width: 36,
                height: 36,
                p: 0,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                bgcolor: "transparent",
                cursor: "pointer",
              }}
            />
            <TextField
              size="small"
              value={hex}
              error={!HEX_RE.test(hex)}
              onChange={(e) => setAt(i, e.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <IconButton size="small" onClick={() => removeAt(i)} aria-label="remove color">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>
        <Button size="small" startIcon={<AddIcon />} onClick={add}>
          Add
        </Button>
        {resultPalette && resultPalette.length > 0 && (
          <Tooltip title="Fill from the current result palette">
            <Button size="small" startIcon={<ColorLensIcon />} onClick={seedFromResult}>
              Use current
            </Button>
          </Tooltip>
        )}
        <Button
          size="small"
          startIcon={<ContentCopyIcon />}
          onClick={copyHex}
          disabled={palette.length === 0}
        >
          Copy hex
        </Button>
      </Stack>
    </Box>
  );
}
