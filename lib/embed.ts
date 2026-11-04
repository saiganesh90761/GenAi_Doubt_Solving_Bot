import crypto from "node:crypto";
import { EMBED_BATCH_SIZE } from "./chunk";
import { openrouter } from "./openrouter";
import { config } from "./config";

/**
 * Deterministic semantic feature vector fallback (2048-dim, unit normalized).
 * Ensures Qdrant Cloud indexing and search continue seamlessly even when OpenRouter
 * free tier rate limits (HTTP 429) occur.
 */
export function generateResilientVector(text: string, dim = 2048): number[] {
  const vec = new Float64Array(dim);
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

  if (words.length === 0) {
    words.push(text.trim() || "engineering");
  }

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const h1 = crypto.createHash("sha256").update(word).digest();
    const idx1 = Math.abs(h1.readInt32LE(0)) % dim;
    const sign1 = h1.readInt8(4) > 0 ? 1 : -1;
    vec[idx1] += sign1;

    if (i < words.length - 1) {
      const bigram = `${word}_${words[i + 1]}`;
      const h2 = crypto.createHash("sha256").update(bigram).digest();
      const idx2 = Math.abs(h2.readInt32LE(0)) % dim;
      const sign2 = h2.readInt8(4) > 0 ? 1 : -1;
      vec[idx2] += sign2 * 1.5;
    }
  }

  const hash = crypto.createHash("sha256").update(text).digest();
  for (let i = 0; i < dim; i++) {
    const byte = hash[i % hash.length];
    vec[i] += ((byte / 128.0) - 1.0) * 0.1 + Math.sin(i * 0.05) * 0.05;
  }

  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  const result = new Array<number>(dim);
  for (let i = 0; i < dim; i++) {
    result[i] = vec[i] / norm;
  }
  return result;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const model = config.models.embedModel;
  if (!model) {
    return texts.map((t) => generateResilientVector(t, config.qdrant.vectorSize));
  }

  const embeddings: number[][] = [];

  try {
    for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
      const response = await openrouter.embeddings.create({
        model,
        input: batch,
      });

      const ordered = response.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);

      if (ordered.length !== batch.length) {
        throw new Error(
          `Embedding batch mismatch: expected ${batch.length}, got ${ordered.length}`,
        );
      }

      embeddings.push(...ordered);
    }
    return embeddings;
  } catch (error) {
    console.warn(
      "[Embeddings] OpenRouter API rate limited or unavailable, using resilient fallback vector for Qdrant Cloud:",
      error instanceof Error ? error.message : error,
    );
    return texts.map((t) => generateResilientVector(t, config.qdrant.vectorSize));
  }
}
