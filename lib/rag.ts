import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { openrouter } from "./openrouter";
import type { IndexRecord } from "./types";

export type { IndexRecord } from "./types";

export type RetrievedChunk = IndexRecord & {
  score: number;
};

const INDEX_PATH = path.join(process.cwd(), "data", "index.json");

let cachedIndex: IndexRecord[] | null = null;

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function loadIndex(): IndexRecord[] {
  if (cachedIndex !== null) return cachedIndex;

  if (!existsSync(INDEX_PATH)) {
    cachedIndex = [];
    return cachedIndex;
  }

  const raw = readFileSync(INDEX_PATH, "utf8").trim();
  if (!raw) {
    cachedIndex = [];
    return cachedIndex;
  }

  const parsed = JSON.parse(raw) as IndexRecord[];
  cachedIndex = Array.isArray(parsed) ? parsed : [];
  return cachedIndex;
}

export async function embedQuery(text: string): Promise<number[]> {
  const model = process.env.EMBED_MODEL;
  if (!model) {
    throw new Error("Missing EMBED_MODEL");
  }

  const response = await openrouter.embeddings.create({
    model,
    input: text,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding?.length) {
    throw new Error("OpenRouter returned an empty query embedding");
  }

  return embedding;
}

export async function retrieve(
  query: string,
  extraChunks: IndexRecord[] = [],
  k = 5,
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(query);
  const corpus = [...loadIndex(), ...extraChunks].filter(
    (chunk) => chunk.embedding?.length,
  );

  return corpus
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, k));
}
