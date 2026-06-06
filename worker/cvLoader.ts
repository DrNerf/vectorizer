// Lazy, single-flight loader for opencv.js inside the worker.
//
// The @techstark build is an emscripten MODULARIZE module: the default export
// is the `Module` object, which is itself *thenable*. Resolving our promise
// directly with it (`resolve(mod)`) makes the Promise machinery re-invoke
// emscripten's self-deleting `then`, which deadlocks and never settles.
// So we use the thenable only to KICK init (no-op callback), and resolve our
// own promise by polling for the real API surface to appear.

import cvModule from "@techstark/opencv-js";

export type CV = typeof cvModule;

let cvPromise: Promise<CV> | null = null;

function isReady(mod: unknown): mod is CV {
  return (
    !!mod &&
    typeof (mod as { Mat?: unknown }).Mat === "function" &&
    typeof (mod as { findContours?: unknown }).findContours === "function"
  );
}

/**
 * The Module stays thenable even after init. Resolving/awaiting a promise with
 * a thenable re-invokes emscripten's `then` and deadlocks, so strip it before
 * handing `cv` back to callers.
 */
function detach(mod: CV): CV {
  try {
    delete (mod as { then?: unknown }).then;
  } catch {
    /* non-configurable — fall through, callers still work */
  }
  return mod;
}

export function loadOpenCv(): Promise<CV> {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise<CV>((resolve, reject) => {
    const mod = cvModule as unknown as CV;
    // Loosely-typed view for the emscripten-specific hooks.
    const hooks = mod as unknown as {
      then?: (onOk: () => void, onErr?: (e: unknown) => void) => void;
      onRuntimeInitialized?: () => void;
    };

    if (isReady(mod)) {
      resolve(detach(mod));
      return;
    }

    // Kick emscripten's async init. We ignore its resolution value on purpose
    // (see header) — readiness is detected by polling below.
    try {
      hooks.then?.(
        () => {},
        () => {},
      );
    } catch {
      /* ignore — poll handles failure via timeout */
    }
    hooks.onRuntimeInitialized = () => {};

    const start = Date.now();
    const timer = setInterval(() => {
      if (isReady(mod)) {
        clearInterval(timer);
        resolve(detach(mod));
      } else if (Date.now() - start > 30_000) {
        clearInterval(timer);
        reject(new Error("opencv.js failed to initialize within 30s"));
      }
    }, 50);
  });

  return cvPromise;
}
