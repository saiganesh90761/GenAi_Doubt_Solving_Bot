import os from "node:os";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";

/**
 * Returns a serverless-safe writable directory.
 * In Vercel / AWS Lambda environments, process.cwd() is read-only (/var/task).
 * Only os.tmpdir() (/tmp) is writable.
 */
export function getStorageDirectory(...subpaths: string[]): string {
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.cwd().startsWith("/var/task")
  );

  const base = isServerless
    ? path.join(os.tmpdir(), "doubt-solver-data", "storage")
    : path.join(process.cwd(), "data", "storage");

  const fullPath = subpaths.length > 0 ? path.join(base, ...subpaths) : base;

  try {
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  } catch {
    // Fallback directly to os.tmpdir() if base creation encounters permission issues
    const fallback = path.join(os.tmpdir(), ...subpaths);
    try {
      if (!existsSync(fallback)) {
        mkdirSync(fallback, { recursive: true });
      }
      return fallback;
    } catch {
      return os.tmpdir();
    }
  }

  return fullPath;
}
