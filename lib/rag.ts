import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { openrouter } from "./openrouter";
import { searchChunks } from "./qdrant";
import { config } from "./config";
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

  try {
    const parsed = JSON.parse(raw) as IndexRecord[];
    cachedIndex = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedIndex = [];
  }
  return cachedIndex;
}

export async function embedQuery(text: string): Promise<number[]> {
  const model = config.models.embedModel;
  if (!model) {
    throw new Error("Missing EMBED_MODEL configuration");
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

export type RetrieveParams = {
  query: string;
  ownerId?: string | null;
  extraChunks?: IndexRecord[];
  k?: number;
  subject?: string;
  scoreThreshold?: number;
};

export async function retrieve(
  queryOrParams: string | RetrieveParams,
  legacyExtraChunks: IndexRecord[] = [],
  legacyK = config.rag.defaultTopK,
): Promise<RetrievedChunk[]> {
  let query: string;
  let ownerId: string | null = null;
  let extraChunks: IndexRecord[] = [];
  let k = config.rag.defaultTopK;
  let subject: string | undefined = undefined;
  let scoreThreshold = config.rag.similarityThreshold;

  if (typeof queryOrParams === "string") {
    query = queryOrParams;
    extraChunks = legacyExtraChunks;
    k = legacyK;
  } else {
    query = queryOrParams.query;
    ownerId = queryOrParams.ownerId || null;
    extraChunks = queryOrParams.extraChunks || [];
    k = queryOrParams.k || config.rag.defaultTopK;
    subject = queryOrParams.subject;
    scoreThreshold = queryOrParams.scoreThreshold || config.rag.similarityThreshold;
  }

  const queryEmbedding = await embedQuery(query);
  const results: RetrievedChunk[] = [];

  // 1. Search Qdrant Cloud
  try {
    const qdrantResults = await searchChunks({
      vector: queryEmbedding,
      limit: k,
      ownerId,
      subject,
      scoreThreshold,
    });

    for (const chunk of qdrantResults) {
      results.push({
        id: chunk.payload.chunkId || chunk.id,
        text: chunk.payload.text,
        file: chunk.payload.documentName,
        page: chunk.payload.page,
        embedding: [],
        score: chunk.score,
        subject: chunk.payload.subject,
        documentType: chunk.payload.documentType,
        documentId: chunk.payload.documentId,
        ownerId: chunk.payload.ownerId,
        knowledgeScope: chunk.payload.knowledgeScope,
      });
    }
  } catch (error) {
    console.warn("[RAG] Qdrant search encountered an error, falling back to local index:", error);
  }

  // 2. Process any in-memory extraChunks (e.g. from user session or legacy callers)
  if (extraChunks.length > 0) {
    const scoredExtra: RetrievedChunk[] = extraChunks
      .filter((chunk) => chunk.embedding?.length)
      .map((chunk) => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .filter((chunk) => chunk.score >= scoreThreshold);

    results.push(...scoredExtra);
  }

  // 3. Fallback to local index if no results from Qdrant and no extraChunks
  if (results.length === 0) {
    const localIndex = loadIndex();
    if (localIndex.length > 0) {
      const scoredLocal: RetrievedChunk[] = localIndex
        .filter((chunk) => chunk.embedding?.length)
        .map((chunk) => ({
          ...chunk,
          score: cosineSimilarity(queryEmbedding, chunk.embedding),
        }))
        .filter((chunk) => chunk.score >= scoreThreshold);

      results.push(...scoredLocal);
    }
  }

  // Sort by score descending and pick top-k
  return results.sort((a, b) => b.score - a.score).slice(0, Math.max(0, k));
}
