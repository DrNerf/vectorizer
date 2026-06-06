"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import TuneIcon from "@mui/icons-material/Tune";
import { PRESETS, type Preset } from "@/lib/presets";

export default function PresetMenu({
  onApply,
  disabled,
}: {
  onApply: (preset: Preset) => void;
  disabled?: boolean;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<TuneIcon />}
        disabled={disabled}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        Presets
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {PRESETS.map((p) => (
          <MenuItem
            key={p.name}
            onClick={() => {
              onApply(p);
              setAnchor(null);
            }}
            sx={{ maxWidth: 280, whiteSpace: "normal" }}
          >
            <ListItemText primary={p.name} secondary={p.description} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
