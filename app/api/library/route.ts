import { readdirSync } from "node:fs";
import path from "node:path";
import { listIndexedDocuments } from "@/lib/qdrant";
import { loadIndex } from "@/lib/rag";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("sessionId");

  // 1. Try fetching from Qdrant Cloud
  try {
    const qdrantDocs = await listIndexedDocuments(ownerId);
    if (qdrantDocs.length > 0) {
      return Response.json({ documents: qdrantDocs });
    }
  } catch (error) {
    console.warn("[Library API] Qdrant listing failed, checking local fallback:", error);
  }

  // 2. Fallback to local index and data/pdfs directory
  const index = loadIndex();
  const byFile = new Map<string, { pages: Set<number>; chunks: number }>();

  for (const record of index) {
    const current = byFile.get(record.file) ?? { pages: new Set<number>(), chunks: 0 };
    current.pages.add(record.page);
    current.chunks += 1;
    byFile.set(record.file, current);
  }

  const pdfDir = path.join(process.cwd(), "data", "pdfs");
  let diskFiles: string[] = [];
  try {
    diskFiles = readdirSync(pdfDir).filter((name) => name.toLowerCase().endsWith(".pdf"));
  } catch {
    diskFiles = [];
  }

  for (const file of diskFiles) {
    if (!byFile.has(file)) {
      byFile.set(file, { pages: new Set(), chunks: 0 });
    }
  }

  const documents = [...byFile.entries()]
    .map(([file, info]) => ({
      file,
      pages: info.pages.size,
      chunks: info.chunks,
      subject: "General Engineering",
      knowledgeScope: "global" as const,
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  return Response.json({ documents });
}
