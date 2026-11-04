import os from "node:os";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";

/**
 * Returns a serverless-safe writable directory.
 * In Vercel / AWS Lambda environments, process.cwd() is read-only (/var/task).
 * Only os.tmpdir() (/tmp) is writable.
 */
export function getStorageDirectory(...subpaths: string[]): string {
  const cwd = typeof process.cwd === "function" ? process.cwd() : "";
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    cwd.includes("/var/task") ||
    cwd.startsWith("/var") ||
    (process.platform === "linux" && !process.env.LOCAL_DEV && cwd.startsWith("/"))
  );

  const base = isServerless
    ? path.join(os.tmpdir(), "doubt-solver-data", "storage")
    : path.join(cwd || ".", "data", "storage");

  const fullPath = subpaths.length > 0 ? path.join(base, ...subpaths) : base;

  try {
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
    return fullPath;
  } catch {
    // Fallback directly to os.tmpdir() if base creation encounters permission issues
    const fallback = path.join(os.tmpdir(), "doubt-solver-data", ...subpaths);
    try {
      if (!existsSync(fallback)) {
        mkdirSync(fallback, { recursive: true });
      }
      return fallback;
    } catch {
      return os.tmpdir();
    }
  }
}

