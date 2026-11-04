import { listDocuments } from "@/lib/documents";
import { listIndexedDocuments } from "@/lib/qdrant";
import { loadIndex } from "@/lib/rag";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") || searchParams.get("userId") || undefined;
  const rawScope = searchParams.get("scope");
  const subject = searchParams.get("subject") || undefined;

  const scope = (rawScope === "global" || rawScope === "private" ? rawScope : "all") as
    | "all"
    | "global"
    | "private";

  // 1. Fetch from document registry (primary store with status, metadata, storageKey)
  try {
    const docs = await listDocuments({
      scope,
      sessionId,
      subject,
    });

    if (docs.length > 0) {
      const formatted = docs.map((d) => ({
        id: d.id,
        name: d.name,
        file: d.name, // backwards compatibility
        subject: d.subject,
        knowledgeScope: d.knowledgeScope,
        status: d.status,
        errorMessage: d.errorMessage,
        pageCount: d.pageCount,
        pages: d.pageCount, // backwards compatibility
        chunkCount: d.chunkCount,
        chunks: d.chunkCount, // backwards compatibility
        fileSize: d.fileSize,
        storageKey: d.storageKey,
        createdAt: d.createdAt,
      }));

      return Response.json({ documents: formatted });
    }
  } catch (error) {
    console.warn("[Library API] Registry query error:", error);
  }

  // 2. Fallback to Qdrant Cloud point index
  try {
    const qdrantDocs = await listIndexedDocuments(sessionId);
    if (qdrantDocs.length > 0) {
      const formatted = qdrantDocs.map((d, index) => ({
        id: `qdrant_${index}_${d.file}`,
        name: d.file,
        file: d.file,
        subject: d.subject || "General Engineering",
        knowledgeScope: d.knowledgeScope || "global",
        status: "ready",
        pageCount: d.pages,
        pages: d.pages,
        chunkCount: d.chunks,
        chunks: d.chunks,
        fileSize: 0,
        createdAt: Date.now(),
      }));

      return Response.json({ documents: formatted });
    }
  } catch (error) {
    console.warn("[Library API] Qdrant listing fallback failed:", error);
  }

  // 3. Fallback to local index.json if present
  const index = loadIndex();
  const byFile = new Map<string, { pages: Set<number>; chunks: number }>();

  for (const record of index) {
    const current = byFile.get(record.file) ?? { pages: new Set<number>(), chunks: 0 };
    current.pages.add(record.page);
    current.chunks += 1;
    byFile.set(record.file, current);
  }

  const documents = [...byFile.entries()]
    .map(([file, info], idx) => ({
      id: `local_${idx}_${file}`,
      name: file,
      file,
      pages: info.pages.size,
      pageCount: info.pages.size,
      chunks: info.chunks,
      chunkCount: info.chunks,
      subject: "General Engineering",
      knowledgeScope: "global" as const,
      status: "ready",
      fileSize: 0,
      createdAt: Date.now(),
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  return Response.json({ documents });
}
