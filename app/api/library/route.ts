import { readdirSync } from "node:fs";
import path from "node:path";
import { loadIndex } from "@/lib/rag";

export async function GET() {
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
    }))
    .sort((a, b) => a.file.localeCompare(b.file));

  return Response.json({ documents });
}
