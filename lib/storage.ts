import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";

export interface StorageResult {
  storageKey: string;
  url?: string;
}

export interface StoredFile {
  data: Uint8Array;
  contentType: string;
}

export interface ObjectStorage {
  put(key: string, data: Uint8Array | Buffer, contentType?: string): Promise<StorageResult>;
  get(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}

class LocalObjectStorage implements ObjectStorage {
  private baseDir: string;

  constructor() {
    this.baseDir = path.join(process.cwd(), "data", "storage");
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolvePath(key: string): string {
    const cleanKey = key.replace(/^[/\\]+/, "").replace(/[/\\]+/g, path.sep);
    const fullPath = path.join(this.baseDir, cleanKey);
    const parent = path.dirname(fullPath);
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true });
    }
    return fullPath;
  }

  async put(key: string, data: Uint8Array | Buffer, contentType = "application/pdf"): Promise<StorageResult> {
    const filePath = this.resolvePath(key);
    writeFileSync(filePath, data);
    // Write sidecar content-type file if needed
    writeFileSync(`${filePath}.meta`, JSON.stringify({ contentType }));
    return {
      storageKey: key,
      url: `/api/library/${encodeURIComponent(key)}`,
    };
  }

  async get(key: string): Promise<StoredFile | null> {
    const filePath = this.resolvePath(key);
    if (!existsSync(filePath)) {
      return null;
    }

    const data = new Uint8Array(readFileSync(filePath));
    let contentType = "application/pdf";
    const metaPath = `${filePath}.meta`;
    if (existsSync(metaPath)) {
      try {
        const meta = JSON.parse(readFileSync(metaPath, "utf8"));
        if (meta.contentType) contentType = meta.contentType;
      } catch {
        // ignore
      }
    }

    return { data, contentType };
  }

  async delete(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    let deleted = false;
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      deleted = true;
    }
    const metaPath = `${filePath}.meta`;
    if (existsSync(metaPath)) {
      unlinkSync(metaPath);
    }
    return deleted;
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    return existsSync(filePath);
  }
}

// Global storage singleton
export const storage: ObjectStorage = new LocalObjectStorage();

