"use client";

import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import type { VectorizeStats } from "@/lib/types";

/** Live quality / sanity numbers (plan §6). Grows in M5. */
export default function StatsPanel({ stats }: { stats: VectorizeStats }) {
  const kb = (stats.svgBytes / 1024).toFixed(1);
  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 0.5 }}>
      <Chip size="small" label={`${stats.colorCount} colors`} />
      <Chip size="small" label={`${stats.subpaths} subpaths`} />
      <Chip
        size="small"
        color={stats.openSubpaths === 0 ? "success" : "error"}
        label={`${stats.openSubpaths} open`}
      />
      <Chip
        size="small"
        color={stats.selfIntersections === 0 ? "success" : "error"}
        label={`${stats.selfIntersections} self-int`}
      />
      <Chip size="small" variant="outlined" label={`${kb} KB`} />
      <Chip size="small" variant="outlined" label={`${stats.elapsedMs} ms`} />
      {stats.cached && <Chip size="small" color="info" variant="outlined" label="cached" />}
    </Stack>
  );
}
