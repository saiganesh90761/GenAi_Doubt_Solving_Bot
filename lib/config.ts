import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnv() {
  if (process.env.NEXT_RUNTIME || (process.env.QDRANT_URL && process.env.OPENROUTER_API_KEY)) {
    return;
  }

  for (const name of [".env", ".env.local"]) {
    const filePath = path.join(process.cwd(), name);
    if (!existsSync(filePath)) continue;

    try {
      const content = readFileSync(filePath, "utf8");
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    } catch {
      // ignore
    }
  }
}

loadEnv();

export const config = {
  qdrant: {
    get url(): string {
      loadEnv();
      return process.env.QDRANT_URL || "";
    },
    get apiKey(): string {
      loadEnv();
      return process.env.QDRANT_API_KEY || "";
    },
    get collectionName(): string {
      loadEnv();
      return process.env.QDRANT_COLLECTION || "engineering_doubt_solver";
    },
    vectorSize: 2048,
    distance: "Cosine" as const,
    timeoutMs: 15000,
  },
  rag: {
    defaultTopK: 5,
    similarityThreshold: 0.25,
  },
  models: {
    get chatModel(): string {
      loadEnv();
      return process.env.MODEL_NAME || "nvidia/nemotron-3-ultra-550b-a55b:free";
    },
    get embedModel(): string {
      loadEnv();
      return process.env.EMBED_MODEL || "nvidia/nemotron-3-embed-1b:free";
    },
  },
  openrouter: {
    get apiKey(): string {
      loadEnv();
      return process.env.OPENROUTER_API_KEY || "";
    },
    baseURL: "https://openrouter.ai/api/v1",
  },
};
