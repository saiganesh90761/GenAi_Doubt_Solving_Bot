import { QdrantClient } from "@qdrant/js-client-rest";
import crypto from "node:crypto";
import { config } from "./config";
import type { VectorChunkPayload } from "./types";

let clientInstance: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (clientInstance) return clientInstance;

  const url = config.qdrant.url;
  const apiKey = config.qdrant.apiKey;

  if (!url) {
    throw new Error("Missing QDRANT_URL environment variable.");
  }

  clientInstance = new QdrantClient({
    url,
    apiKey: apiKey || undefined,
    checkCompatibility: false,
  });

  return clientInstance;
}

export function toDeterministicUuid(input: string): string {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function checkQdrantHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    const client = getQdrantClient();
    const collections = await client.getCollections();
    return {
      ok: true,
      message: `Connected to Qdrant Cloud. Total collections: ${collections.collections.length}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Qdrant health check failed: ${msg}` };
  }
}

let collectionEnsured = false;

export async function ensureCollection(
  collectionName: string = config.qdrant.collectionName,
  vectorSize: number = config.qdrant.vectorSize,
): Promise<void> {
  if (collectionEnsured) return;

  const client = getQdrantClient();
  try {
    const { exists } = await client.collectionExists(collectionName);
    if (!exists) {
      console.log(
        `[Qdrant] Collection '${collectionName}' not found. Creating with vector size ${vectorSize} (${config.qdrant.distance})...`,
      );
      await client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: config.qdrant.distance,
        },
      });
      console.log(`[Qdrant] Collection '${collectionName}' created successfully.`);
    }

    const indexFields = [
      "knowledgeScope",
      "ownerId",
      "documentName",
      "documentId",
      "subject",
      "documentType",
    ];
    for (const field of indexFields) {
      try {
        await client.createPayloadIndex(collectionName, {
          field_name: field,
          field_schema: "keyword",
          wait: true,
        });
      } catch {
        // ignore if already indexed
      }
    }
    collectionEnsured = true;
  } catch (error) {
    console.error(`[Qdrant] Error in ensureCollection for '${collectionName}':`, error);
    throw error;
  }
}

export async function upsertChunks(
  chunks: Array<{
    id?: string;
    vector: number[];
    payload: VectorChunkPayload;
  }>,
  collectionName: string = config.qdrant.collectionName,
  batchSize = 64,
): Promise<{ upserted: number }> {
  if (chunks.length === 0) return { upserted: 0 };

  await ensureCollection(collectionName, config.qdrant.vectorSize);
  const client = getQdrantClient();

  const expectedDim = config.qdrant.vectorSize;
  for (let i = 0; i < chunks.length; i++) {
    const len = chunks[i].vector.length;
    if (len !== expectedDim) {
      throw new Error(
        `Vector dimension mismatch on chunk ${i} (${chunks[i].payload.chunkId}): expected ${expectedDim}, got ${len}`,
      );
    }
  }

  const points = chunks.map((chunk) => {
    const rawId = chunk.id || chunk.payload.chunkId;
    const pointId = toDeterministicUuid(rawId);
    return {
      id: pointId,
      vector: chunk.vector,
      payload: {
        ...chunk.payload,
        createdAt: chunk.payload.createdAt || Date.now(),
      },
    };
  });

  for (let i = 0; i < points.length; i += batchSize) {
    const batch = points.slice(i, i + batchSize);
    await client.upsert(collectionName, {
      wait: true,
      points: batch,
    });
  }

  return { upserted: points.length };
}

export type ScoredChunk = {
  id: string;
  score: number;
  payload: VectorChunkPayload;
};

type FilterCondition = {
  key: string;
  match: { value: string | number | boolean };
};

export async function searchChunks(params: {
  vector: number[];
  limit?: number;
  ownerId?: string | null;
  knowledgeScope?: "global" | "private" | "all";
  subject?: string;
  collectionName?: string;
  scoreThreshold?: number;
}): Promise<ScoredChunk[]> {
  const collectionName = params.collectionName || config.qdrant.collectionName;
  await ensureCollection(collectionName, config.qdrant.vectorSize);

  const client = getQdrantClient();
  const limit = params.limit ?? config.rag.defaultTopK;
  const threshold = params.scoreThreshold ?? config.rag.similarityThreshold;

  const mustConditions: FilterCondition[] = [];
  const shouldConditions: FilterCondition[] = [];

  const scope = params.knowledgeScope || "all";
  if (scope === "global") {
    mustConditions.push({
      key: "knowledgeScope",
      match: { value: "global" },
    });
  } else if (scope === "private" && params.ownerId) {
    mustConditions.push({
      key: "knowledgeScope",
      match: { value: "private" },
    });
    mustConditions.push({
      key: "ownerId",
      match: { value: params.ownerId },
    });
  } else {
    shouldConditions.push({
      key: "knowledgeScope",
      match: { value: "global" },
    });
    if (params.ownerId) {
      shouldConditions.push({
        key: "ownerId",
        match: { value: params.ownerId },
      });
    }
  }

  if (params.subject) {
    mustConditions.push({
      key: "subject",
      match: { value: params.subject },
    });
  }

  const filter: Record<string, unknown> = {};
  if (mustConditions.length > 0) {
    filter.must = mustConditions;
  }
  if (shouldConditions.length > 0) {
    filter.should = shouldConditions;
  }

  try {
    const response = await client.query(collectionName, {
      query: params.vector,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      limit,
      score_threshold: threshold,
      with_payload: true,
    });

    const points = response.points || [];
    return points.map((p) => ({
      id: String(p.id),
      score: p.score ?? 0,
      payload: (p.payload as unknown as VectorChunkPayload) || {},
    }));
  } catch (error) {
    console.error("[Qdrant] Search failed:", error);
    throw error;
  }
}

export async function deleteChunksByDocumentId(
  documentId: string,
  collectionName: string = config.qdrant.collectionName,
): Promise<{ deleted: boolean }> {
  const client = getQdrantClient();
  const must: FilterCondition[] = [
    {
      key: "documentId",
      match: { value: documentId },
    },
  ];

  try {
    await client.delete(collectionName, {
      wait: true,
      filter: { must },
    });
    return { deleted: true };
  } catch (error) {
    console.error(`[Qdrant] Failed to delete chunks for documentId ${documentId}:`, error);
    throw error;
  }
}

export async function deleteChunksByDocument(
  documentName: string,
  ownerId?: string | null,
  collectionName: string = config.qdrant.collectionName,
): Promise<{ deleted: boolean }> {
  const client = getQdrantClient();
  const must: FilterCondition[] = [
    {
      key: "documentName",
      match: { value: documentName },
    },
  ];

  if (ownerId) {
    must.push({
      key: "ownerId",
      match: { value: ownerId },
    });
  }

  try {
    await client.delete(collectionName, {
      wait: true,
      filter: { must },
    });
    return { deleted: true };
  } catch (error) {
    console.error(`[Qdrant] Failed to delete chunks for ${documentName}:`, error);
    throw error;
  }
}

export type DocumentSummary = {
  file: string;
  pages: number;
  chunks: number;
  subject: string;
  knowledgeScope: "global" | "private";
};

export async function listIndexedDocuments(
  ownerId?: string | null,
  collectionName: string = config.qdrant.collectionName,
): Promise<DocumentSummary[]> {
  try {
    await ensureCollection(collectionName, config.qdrant.vectorSize);
    const client = getQdrantClient();

    const should: FilterCondition[] = [
      { key: "knowledgeScope", match: { value: "global" } },
    ];
    if (ownerId) {
      should.push({ key: "ownerId", match: { value: ownerId } });
    }

    const docMap = new Map<
      string,
      { pages: Set<number>; chunks: number; subject: string; scope: "global" | "private" }
    >();

    type ScrollOffset = string | number | Record<string, unknown> | null;
    let offset: ScrollOffset = null;
    do {
      const scrollResult = await client.scroll(collectionName, {
        filter: { should },
        limit: 250,
        offset: (offset as string | number | undefined) || undefined,
        with_payload: ["documentName", "page", "subject", "knowledgeScope"],
      });

      for (const p of scrollResult.points) {
        const payload = p.payload as unknown as VectorChunkPayload;
        if (!payload?.documentName) continue;

        const current = docMap.get(payload.documentName) ?? {
          pages: new Set<number>(),
          chunks: 0,
          subject: payload.subject || "General Engineering",
          scope: payload.knowledgeScope || "global",
        };
        if (payload.page) current.pages.add(payload.page);
        current.chunks += 1;
        docMap.set(payload.documentName, current);
      }

      offset = scrollResult.next_page_offset ?? null;
    } while (offset);

    return Array.from(docMap.entries())
      .map(([file, info]) => ({
        file,
        pages: info.pages.size,
        chunks: info.chunks,
        subject: info.subject,
        knowledgeScope: info.scope,
      }))
      .sort((a, b) => a.file.localeCompare(b.file));
  } catch (error) {
    console.warn("[Qdrant] Could not list indexed documents from Qdrant:", error);
    return [];
  }
}
