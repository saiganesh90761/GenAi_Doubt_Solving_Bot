import { APIError, RateLimitError } from "openai";
import { extractPagesFromPdf, pagesToPendingChunks } from "@/lib/chunk";
import { embedTexts } from "@/lib/embed";
import { upsertChunks, deleteChunksByDocument } from "@/lib/qdrant";
import type { IndexRecord, VectorChunkPayload } from "@/lib/types";

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
  const sessionId = form.get("sessionId") as string | null;

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
    documentId: file.name.replace(/[^a-zA-Z0-9_-]/g, "_"),
    subject: "Student Upload",
    documentType: "pdf",
    ownerId: sessionId || null,
    knowledgeScope: "private",
  }));

  // Store chunks into Qdrant Cloud under private scope
  try {
    const qdrantPoints = chunks.map((c) => {
      const payload: VectorChunkPayload = {
        chunkId: c.id,
        documentId: c.documentId || file.name,
        documentName: c.file,
        text: c.text,
        page: c.page,
        subject: "Student Upload",
        documentType: "pdf",
        ownerId: sessionId || null,
        knowledgeScope: "private",
        createdAt: Date.now(),
      };
      return {
        id: c.id,
        vector: c.embedding,
        payload,
      };
    });

    await upsertChunks(qdrantPoints);
  } catch (error) {
    console.warn("[Upload] Warning: Could not index chunks directly to Qdrant Cloud:", error);
  }

  return Response.json({
    file: file.name,
    chunks,
    chunkCount: chunks.length,
    emptyPages,
  });
}

export async function DELETE(request: Request) {
  let body: { file?: string; sessionId?: string } | null = null;
  try {
    body = (await request.json()) as { file?: string; sessionId?: string };
  } catch {
    return jsonError(400, "Expected JSON body with { file, sessionId }");
  }

  if (!body?.file) {
    return jsonError(400, "Missing 'file' parameter");
  }

  try {
    await deleteChunksByDocument(body.file, body.sessionId || null);
    return Response.json({ success: true, file: body.file });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete document chunks";
    return jsonError(500, message);
  }
}
