import { extractText, getDocumentProxy } from "unpdf";
import type { IndexRecord } from "./types";

export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 150;
export const EMBED_BATCH_SIZE = 32;

export function chunkText(
  text: string,
  size = CHUNK_SIZE,
  overlap = CHUNK_OVERLAP,
): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= size) return [cleaned];

  const step = Math.max(1, size - overlap);
  const chunks: string[] = [];

  for (let start = 0; start < cleaned.length; start += step) {
    const chunk = cleaned.slice(start, start + size).trim();
    if (chunk) chunks.push(chunk);
    if (start + size >= cleaned.length) break;
  }

  return chunks;
}

export async function extractPagesFromPdf(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text : [text];
}

export function pagesToPendingChunks(
  file: string,
  pages: string[],
): { pending: Omit<IndexRecord, "embedding">[]; emptyPages: number[] } {
  const pending: Omit<IndexRecord, "embedding">[] = [];
  const emptyPages: number[] = [];

  pages.forEach((pageText, index) => {
    const page = index + 1;
    if (!pageText.replace(/\s+/g, " ").trim()) {
      emptyPages.push(page);
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

  return { pending, emptyPages };
}
