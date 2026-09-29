import type { WorkerPoolOptions } from "@pierre/diffs/react";

const mobileUserAgentPattern = /\b(Android|iPhone|iPad|iPod|Mobile)\b/i;

export function diffWorkerPoolSizeForUserAgent(userAgent: string | undefined): number {
  return mobileUserAgentPattern.test(userAgent ?? "") ? 1 : 3;
}

function currentDiffWorkerPoolSize(): number {
  return diffWorkerPoolSizeForUserAgent(typeof navigator === "undefined" ? undefined : navigator.userAgent);
}

// `src/diff-worker.ts` is a second Rollup entry of this bundle, emitted as
// `chunks/diff-worker.mjs`. This module lands in `chunks/diffSurface.mjs`, so
// the entry is a sibling of `import.meta.url`. Vite leaves the expression
// untouched because the file only exists after the build
// (`webviews/test/diff-worker-bundle.test.ts` pins both facts).
export const diffWorkerModuleURL = new URL(/* @vite-ignore */ "./diff-worker.mjs", import.meta.url);

/**
 * Counters for the highlight worker pool, exposed as
 * `window.__cmuxDiffWorkerPool` so a debug-socket `eval` can prove that
 * workers were spawned from the emitted entry and answered highlight
 * requests even in a hidden web view, where Pierre never paints tokens.
 */
export interface DiffWorkerPoolStats {
  workerURL: string;
  created: number;
  messages: number;
  errors: number;
}

export function createDiffWorkerPoolStats(workerModuleURL: URL): DiffWorkerPoolStats {
  return { workerURL: workerModuleURL.href, created: 0, messages: 0, errors: 0 };
}

export const diffWorkerPoolStats = createDiffWorkerPoolStats(diffWorkerModuleURL);
if (typeof window !== "undefined") {
  window.__cmuxDiffWorkerPool = diffWorkerPoolStats;
}

export function createDiffWorkerPoolOptions(
  workerModuleURL: URL = diffWorkerModuleURL,
  stats: DiffWorkerPoolStats | undefined = diffWorkerPoolStats,
  WorkerConstructor: typeof Worker = Worker,
): WorkerPoolOptions {
  return {
    poolSize: currentDiffWorkerPoolSize(),
    workerFactory: () => {
      const worker = new WorkerConstructor(workerModuleURL, { type: "module" });
      if (stats) {
        stats.created += 1;
        worker.addEventListener("message", () => {
          stats.messages += 1;
        });
        worker.addEventListener("error", () => {
          stats.errors += 1;
        });
      }
      return worker;
    },
  };
}
