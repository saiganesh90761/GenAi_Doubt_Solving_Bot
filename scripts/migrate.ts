import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { upsertChunks, checkQdrantHealth } from "../lib/qdrant";
import type { IndexRecord, VectorChunkPayload } from "../lib/types";

const INDEX_PATH = path.join(process.cwd(), "data", "index.json");

async function runMigration() {
  console.log("=== Qdrant Migration Tool ===");

  const health = await checkQdrantHealth();
  if (!health.ok) {
    throw new Error(`Cannot migrate: Qdrant is unreachable: ${health.message}`);
  }
  console.log(`Qdrant Status: ${health.message}`);

  if (!existsSync(INDEX_PATH)) {
    console.log(`No existing index found at ${INDEX_PATH}. Nothing to migrate.`);
    return;
  }

  const raw = readFileSync(INDEX_PATH, "utf8").trim();
  if (!raw || raw === "[]") {
    console.log(`Index file at ${INDEX_PATH} is empty. Migration complete.`);
    return;
  }

  const records = JSON.parse(raw) as IndexRecord[];
  if (!Array.isArray(records) || records.length === 0) {
    console.log("No records to migrate.");
    return;
  }

  console.log(`Found ${records.length} records in ${INDEX_PATH}. Preparing migration...`);

  const points = records
    .filter((r) => r.embedding && r.embedding.length > 0)
    .map((record) => {
      const payload: VectorChunkPayload = {
        chunkId: record.id,
        documentId: record.documentId || record.file.replace(/[^a-zA-Z0-9_-]/g, "_"),
        documentName: record.file,
        text: record.text,
        page: record.page,
        subject: record.subject || "General Engineering",
        documentType: record.documentType || "pdf",
        ownerId: record.ownerId || null,
        knowledgeScope: record.knowledgeScope || "global",
        createdAt: Date.now(),
      };

      return {
        id: record.id,
        vector: record.embedding,
        payload,
      };
    });

  console.log(`Migrating ${points.length} chunks to Qdrant Cloud...`);
  const result = await upsertChunks(points);
  console.log(`Successfully migrated ${result.upserted} chunks into Qdrant Cloud!`);
  console.log(`Notice: Existing ${INDEX_PATH} is preserved intact.`);
}

runMigration().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

