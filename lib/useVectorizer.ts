"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SourceImage,
  VectorizeParams,
  VectorizeResult,
  WorkerRequest,
  WorkerResponse,
  RawImage,
} from "./types";

export type VectorizeStatus = "idle" | "running" | "done" | "error";

interface VectorizeState {
  status: VectorizeStatus;
  progress: { stage: string; pct: number } | null;
  result: VectorizeResult | null;
  error: string | null;
}

/** Draw the source down to the working-res cap and read back RGBA pixels. */
function prepImage(image: SourceImage, params: VectorizeParams): RawImage {
  const { width, height } = image;
  const longEdge = Math.max(width, height);
  const s = longEdge > params.workingResCap ? params.workingResCap / longEdge : 1;
  const wW = Math.max(1, Math.round(width * s));
  const wH = Math.max(1, Math.round(height * s));

  const canvas = new OffscreenCanvas(wW, wH);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not get a 2D context for downscaling.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image.bitmap, 0, 0, wW, wH);
  const imgData = ctx.getImageData(0, 0, wW, wH);

  const outWidth = params.outputWidth ?? width;
  const outHeight = Math.round((outWidth * height) / width);

  return {
    data: imgData.data,
    width: wW,
    height: wH,
    outScale: outWidth / wW,
    outWidth,
    outHeight,
  };
}

export function useVectorizer() {
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);
  // Stable id per uploaded image, so the worker can cache expensive stages.
  const imageIdRef = useRef(0);
  const lastImageRef = useRef<SourceImage | null>(null);
  const [state, setState] = useState<VectorizeState>({
    status: "idle",
    progress: null,
    result: null,
    error: null,
  });

  useEffect(() => {
    const worker = new Worker(
      new URL("../worker/pipeline.worker.ts", import.meta.url),
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      // Ignore everything but the most recent request.
      if ("id" in msg && msg.id !== reqId.current) return;

      if (msg.type === "progress") {
        setState((s) => ({ ...s, progress: { stage: msg.stage, pct: msg.pct } }));
      } else if (msg.type === "result") {
        setState({ status: "done", progress: null, result: msg.result, error: null });
      } else if (msg.type === "error") {
        setState((s) => ({ ...s, status: "error", progress: null, error: msg.message }));
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const run = useCallback((image: SourceImage, params: VectorizeParams) => {
    const worker = workerRef.current;
    if (!worker) return;
    let raw: RawImage;
    try {
      raw = prepImage(image, params);
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      }));
      return;
    }
    if (image !== lastImageRef.current) {
      lastImageRef.current = image;
      imageIdRef.current += 1;
    }
    const id = ++reqId.current;
    setState((s) => ({ ...s, status: "running", error: null }));
    const req: WorkerRequest = {
      type: "vectorize",
      id,
      imageId: imageIdRef.current,
      image: raw,
      params,
    };
    worker.postMessage(req, [raw.data.buffer]);
  }, []);

  return { ...state, run };
}
