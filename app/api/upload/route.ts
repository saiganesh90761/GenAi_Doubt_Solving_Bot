import { APIError, RateLimitError } from "openai";
import { extractPagesFromPdf, pagesToPendingChunks } from "@/lib/chunk";
import { embedTexts } from "@/lib/embed";
import type { IndexRecord } from "@/lib/types";

export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function friendlyEmbedError(error: unknown): { status: number; message: string } {
  if (error instanceof RateLimitError || (error instanceof APIError && error.status === 429)) {
    return {
      status: 429,
      message: "Embedding is rate limited right now. Wait a moment and try the upload again.",
    };
  }

  if (error instanceof APIError) {
    if (error.status === 401 || error.status === 403) {
      return {
        status: 502,
        message: "Authentication failed with OpenRouter. Please verify that your OPENROUTER_API_KEY in .env.local is valid.",
      };
    }

    return {
      status: 502,
      message: "Could not embed this PDF. Please try again.",
    };
  }

  return {
    status: 500,
    message: error instanceof Error ? error.message : "Could not process this PDF.",
  };
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return jsonError(400, "Upload the PDF as multipart form data.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "Choose a PDF file to upload.");
  }

  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    return jsonError(400, "Only PDF files are supported.");
  }

  if (file.size > MAX_BYTES) {
    return jsonError(400, "PDF must be 10 MB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pages = await extractPagesFromPdf(bytes);
  const { pending, emptyPages } = pagesToPendingChunks(file.name, pages);

  if (pending.length === 0) {
    return jsonError(
      400,
      emptyPages.length
        ? "No extractable text found. This PDF may be scanned images only."
        : "No text could be extracted from this PDF.",
    );
  }

  let embeddings: number[][];
  try {
    embeddings = await embedTexts(pending.map((item) => item.text));
  } catch (error) {
    const { status, message } = friendlyEmbedError(error);
    return jsonError(status, message);
  }

  const chunks: IndexRecord[] = pending.map((item, index) => ({
    ...item,
    embedding: embeddings[index],
  }));

  return Response.json({
    file: file.name,
    chunks,
    emptyPages,
  });
}
