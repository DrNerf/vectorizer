import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — no backend, deploys as static files on Vercel.
  output: "export",
  // Static export can't use the Next.js image optimizer.
  images: { unoptimized: true },
  turbopack: {
    // opencv.js (emscripten) references Node builtins inside an
    // `if (ENVIRONMENT_HAS_NODE)` branch that never runs in the browser/worker.
    // Stub them so the bundler doesn't try to resolve them.
    resolveAlias: {
      fs: { browser: "./worker/stubs/empty.ts" },
      path: { browser: "./worker/stubs/empty.ts" },
      crypto: { browser: "./worker/stubs/empty.ts" },
    },
  },
};

export default nextConfig;
