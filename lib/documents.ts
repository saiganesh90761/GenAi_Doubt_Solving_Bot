import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deleteChunksByDocument, deleteChunksByDocumentId } from "./qdrant";
import { storage } from "./storage";
import { getStorageDirectory } from "./paths";

export type KnowledgeScope = "global" | "private";
export type DocumentStatus = "uploading" | "processing" | "ready" | "error";

export interface DocumentRecord {
  id: string;
  name: string;
  fileHash: string;
  fileSize: number;
  mimeType: string;
  pageCount: number;
  chunkCount: number;
  subject: string;
  knowledgeScope: KnowledgeScope;
  ownerId: string | null;
  status: DocumentStatus;
  errorMessage?: string;
  storageKey: string;
  createdAt: number;
  updatedAt: number;
}

function getRegistryFile(): string {
  const dir = getStorageDirectory("metadata");
  return path.join(dir, "documents-registry.json");
}

function loadRegistry(): Map<string, DocumentRecord> {
  const registryFile = getRegistryFile();
  if (!existsSync(registryFile)) {
    return new Map();
  }

  try {
    const raw = readFileSync(registryFile, "utf8").trim();
    if (!raw) return new Map();
    const array = JSON.parse(raw) as DocumentRecord[];
    const map = new Map<string, DocumentRecord>();
    for (const doc of array) {
      map.set(doc.id, doc);
    }
    return map;
  } catch (error) {
    console.warn("[Documents] Could not load registry:", error);
    return new Map();
  }
}

function saveRegistry(map: Map<string, DocumentRecord>) {
  const list = Array.from(map.values());
  writeFileSync(getRegistryFile(), JSON.stringify(list, null, 2), "utf8");
}

export async function createDocument(doc: DocumentRecord): Promise<DocumentRecord> {
  const map = loadRegistry();
  map.set(doc.id, doc);
  saveRegistry(map);
  return doc;
}

export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  const map = loadRegistry();
  return map.get(id) || null;
}

export async function findDocumentByHash(
  hash: string,
  scope: KnowledgeScope,
  ownerId?: string | null,
): Promise<DocumentRecord | null> {
  const map = loadRegistry();
  for (const doc of map.values()) {
    if (doc.fileHash === hash && doc.knowledgeScope === scope && doc.status !== "error") {
      if (scope === "global") {
        return doc;
      }
      if (scope === "private" && doc.ownerId === (ownerId || null)) {
        return doc;
      }
    }
  }
  return null;
}

export async function listDocuments(filter: {
  scope?: "all" | "global" | "private";
  sessionId?: string | null;
  subject?: string;
}): Promise<DocumentRecord[]> {
  const map = loadRegistry();
  const result: DocumentRecord[] = [];
  const requestedScope = filter.scope || "all";

  for (const doc of map.values()) {
    // 1. Isolation check:
    // If private, MUST match the requested sessionId! NEVER expose other students' private docs.
    if (doc.knowledgeScope === "private") {
      if (!filter.sessionId || doc.ownerId !== filter.sessionId) {
        continue;
      }
    }

    // 2. Scope filter check:
    if (requestedScope === "global" && doc.knowledgeScope !== "global") {
      continue;
    }
    if (requestedScope === "private" && doc.knowledgeScope !== "private") {
      continue;
    }

    // 3. Subject filter check:
    if (filter.subject && doc.subject.toLowerCase() !== filter.subject.toLowerCase()) {
      continue;
    }

    result.push(doc);
  }

  // Sort descending by creation date
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateDocumentStatus(
  id: string,
  status: DocumentStatus,
  details?: {
    pageCount?: number;
    chunkCount?: number;
    errorMessage?: string;
  },
): Promise<DocumentRecord | null> {
  const map = loadRegistry();
  const existing = map.get(id);
  if (!existing) return null;

  existing.status = status;
  existing.updatedAt = Date.now();
  if (details?.pageCount !== undefined) existing.pageCount = details.pageCount;
  if (details?.chunkCount !== undefined) existing.chunkCount = details.chunkCount;
  if (details?.errorMessage !== undefined) existing.errorMessage = details.errorMessage;

  map.set(id, existing);
  saveRegistry(map);
  return existing;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const map = loadRegistry();
  const doc = map.get(id);
  if (!doc) return false;

  // 1. Delete chunk vectors from Qdrant Cloud
  try {
    await deleteChunksByDocumentId(doc.id);
    await deleteChunksByDocument(doc.name, doc.ownerId);
  } catch (error) {
    console.warn(`[Documents] Warning: Failed to delete Qdrant vectors for ${doc.name}:`, error);
  }

  // 2. Delete file from object storage
  try {
    await storage.delete(doc.storageKey);
  } catch (error) {
    console.warn(`[Documents] Warning: Failed to delete storage file ${doc.storageKey}:`, error);
  }

  // 3. Remove from registry
  map.delete(id);
  saveRegistry(map);
  return true;
}

/**
 * Prunes expired temporary student uploads (default TTL: 24 hours).
 */
export async function cleanupExpiredPrivateDocuments(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
  const map = loadRegistry();
  const now = Date.now();
  let deletedCount = 0;

  for (const doc of map.values()) {
    if (doc.knowledgeScope === "private" && now - doc.createdAt > maxAgeMs) {
      await deleteDocument(doc.id);
      deletedCount++;
    }
  }

  return deletedCount;
}
