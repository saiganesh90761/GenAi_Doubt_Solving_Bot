import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  EMBED_BATCH_SIZE,
  chunkText,
  extractPagesFromPdf,
} from "../lib/chunk";
import { upsertChunks, checkQdrantHealth } from "../lib/qdrant";
import type { IndexRecord, VectorChunkPayload } from "../lib/types";

const PDF_DIR = path.join(process.cwd(), "data", "pdfs");
const INDEX_PATH = path.join(process.cwd(), "data", "index.json");

function loadEnvFiles() {
  const fromShell = new Set(Object.keys(process.env));

  for (const name of [".env", ".env.local"]) {
    const filePath = path.join(process.cwd(), name);
    if (!existsSync(filePath)) continue;

    for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const eq = line.indexOf("=");
      if (eq <= 0) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!fromShell.has(key)) {
        process.env[key] = value;
      }
    }
  }
}

async function extractPages(filePath: string): Promise<string[]> {
  return extractPagesFromPdf(new Uint8Array(readFileSync(filePath)));
}

async function embedBatch(
  client: (typeof import("../lib/openrouter"))["openrouter"],
  texts: string[],
  model: string,
): Promise<number[][]> {
  const response = await client.embeddings.create({
    model,
    input: texts,
  });

  return response.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

async function main() {
  loadEnvFiles();

  await mkdir(PDF_DIR, { recursive: true });

  const pdfFiles = readdirSync(PDF_DIR)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .sort();

  if (pdfFiles.length === 0) {
    console.warn(`No PDFs found in ${PDF_DIR}. Add files and run ingest again.`);
    writeFileSync(INDEX_PATH, "[]\n", "utf8");
    return;
  }

  const pending: Omit<IndexRecord, "embedding">[] = [];

  for (const file of pdfFiles) {
    const filePath = path.join(PDF_DIR, file);
    console.log(`Extracting ${file}...`);

    const pages = await extractPages(filePath);

    pages.forEach((pageText, index) => {
      const page = index + 1;
      if (!pageText.replace(/\s+/g, " ").trim()) {
        console.warn(
          `Warning: no extractable text on ${file} page ${page} (likely a scanned PDF).`,
        );
        return;
      }

      chunkText(pageText).forEach((text, chunkIndex) => {
        pending.push({
          id: `${file}::p${page}::c${chunkIndex}`,
          text,
          file,
          page,
        });
      });
    });
  }

  if (pending.length === 0) {
    console.warn("No text chunks produced. Writing an empty index.");
    writeFileSync(INDEX_PATH, "[]\n", "utf8");
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const embedModel = process.env.EMBED_MODEL;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY. Copy .env.example to .env.local.");
  }
  if (!embedModel) {
    throw new Error("Missing EMBED_MODEL. Copy .env.example to .env.local.");
  }

  const { openrouter } = await import("../lib/openrouter");

  console.log(`Embedding ${pending.length} chunks with ${embedModel} (batch size ${EMBED_BATCH_SIZE})...`);

  const records: IndexRecord[] = [];
  const qdrantPoints: Array<{ id: string; vector: number[]; payload: VectorChunkPayload }> = [];

  for (let i = 0; i < pending.length; i += EMBED_BATCH_SIZE) {
    const batch = pending.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await embedBatch(
      openrouter,
      batch.map((item) => item.text),
      embedModel,
    );

    if (embeddings.length !== batch.length) {
      throw new Error(
        `Embedding batch mismatch: expected ${batch.length}, got ${embeddings.length}`,
      );
    }

    batch.forEach((item, index) => {
      const vector = embeddings[index];
      records.push({ ...item, embedding: vector });

      const payload: VectorChunkPayload = {
        chunkId: item.id,
        documentId: item.file.replace(/[^a-zA-Z0-9_-]/g, "_"),
        documentName: item.file,
        text: item.text,
        page: item.page,
        subject: "General Engineering",
        documentType: "pdf",
        ownerId: null,
        knowledgeScope: "global",
        createdAt: Date.now(),
      };

      qdrantPoints.push({
        id: item.id,
        vector,
        payload,
      });
    });

    console.log(`  ${Math.min(i + EMBED_BATCH_SIZE, pending.length)}/${pending.length}`);
  }

  // Backup to local file
  writeFileSync(INDEX_PATH, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  console.log(`Wrote ${records.length} records to local backup ${INDEX_PATH}`);

  // Sync to Qdrant Cloud
  try {
    const qHealth = await checkQdrantHealth();
    if (qHealth.ok) {
      console.log(`Syncing ${qdrantPoints.length} chunks to Qdrant Cloud...`);
      const { upserted } = await upsertChunks(qdrantPoints);
      console.log(`Successfully synced ${upserted} chunks to Qdrant Cloud!`);
    } else {
      console.warn(`Skipping Qdrant Cloud sync: ${qHealth.message}`);
    }
  } catch (error) {
    console.error("Warning: Failed to sync to Qdrant Cloud:", error);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
