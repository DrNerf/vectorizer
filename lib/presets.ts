// Preset param bundles (plan §5). Applied over the current params so the
// palette / output settings the user already chose are preserved.

import type { VectorizeParams } from "./types";

export interface Preset {
  name: string;
  description: string;
  params: Partial<VectorizeParams>;
}

export const PRESETS: Preset[] = [
  {
    name: "Poster (safe)",
    description: "Watertight, print-friendly. Heavier cleanup, 1px overlap.",
    params: {
      smoothingPasses: 1,
      simplifyEps: 1.0,
      edgeOverlap: 1,
      bodyThreshold: 150,
      holeMin: 70,
      fillRule: "nonzero",
    },
  },
  {
    name: "High detail",
    description: "Faithful edges, keeps small features. Bigger file.",
    params: {
      smoothingPasses: 0,
      simplifyEps: 0.4,
      edgeOverlap: 1,
      bodyThreshold: 60,
      holeMin: 20,
    },
  },
  {
    name: "Fast preview",
    description: "Quick + chunky. Aggressive cleanup, low working res.",
    params: {
      smoothingPasses: 2,
      simplifyEps: 2.0,
      edgeOverlap: 1,
      bodyThreshold: 250,
      holeMin: 120,
      workingResCap: 900,
    },
  },
];
