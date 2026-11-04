import crypto from "node:crypto";
import { APIError, RateLimitError } from "openai";
import { extractPagesFromPdf, pagesToPendingChunks } from "@/lib/chunk";
import { embedTexts } from "@/lib/embed";
import { upsertChunks } from "@/lib/qdrant";
import { validatePdfFile } from "@/lib/validation";
import { storage } from "@/lib/storage";
import {
  createDocument,
  findDocumentByHash,
  updateDocumentStatus,
  deleteDocument,
  listDocuments,
  type KnowledgeScope,
  type DocumentRecord,
} from "@/lib/documents";
import type { IndexRecord, VectorChunkPayload } from "@/lib/types";

export const maxDuration = 60;

function jsonError(status: number, message: string, details?: Record<string, unknown>) {
  return Response.json({ error: message, ...details }, { status });
}

function friendlyEmbedError(error: unknown): { status: number; message: string } {
  if (error instanceof RateLimitError || (error instanceof APIError && error.status === 429)) {
    return {
      status: 429,
      message: "Embedding is rate limited right now. Please wait a moment and try the upload again.",
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
      message: "Could not embed this PDF with OpenRouter. Please try again.",
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
  const rawUserId = (form.get("userId") as string | null) || (form.get("sessionId") as string | null) || "guest_user";
  const rawScope = form.get("scope") as string | null;
  const subject = ((form.get("subject") as string | null) || "General Engineering").trim();

  // Determine knowledge scope
  const isGlobal = rawScope === "global";
  const knowledgeScope: KnowledgeScope = isGlobal ? "global" : "private";
  const ownerId = isGlobal ? null : rawUserId;

  if (!(file instanceof File)) {
    return jsonError(400, "Choose a valid PDF file to upload.");
  }

  // 1. Read buffer and validate signature, MIME type, and size
  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validatePdfFile(bytes, file.name, file.type, isGlobal);
  if (!validation.valid) {
    return jsonError(400, validation.error || "Invalid PDF file.");
  }

  // 2. Duplicate Detection via SHA-256 hash
  const existingDoc = await findDocumentByHash(
    validation.fileHash,
    knowledgeScope,
    ownerId,
  );
  if (existingDoc && existingDoc.status === "ready") {
    return jsonError(
      409,
      `Duplicate upload: A document with identical content already exists ('${existingDoc.name}').`,
      { existingDocument: existingDoc },
    );
  }

  // 3. Register document in Object Storage & Registry with 'processing' status
  const documentId = crypto.randomUUID();
  const storageKey = `documents/${knowledgeScope}/${documentId}.pdf`;

  try {
    await storage.put(storageKey, bytes, "application/pdf");
  } catch (error) {
    console.error("[Upload] Failed to store file in object storage:", error);
    return jsonError(500, "Failed to store PDF in persistent storage.");
  }

  const initialDoc: DocumentRecord = {
    id: documentId,
    name: file.name,
    fileHash: validation.fileHash,
    fileSize: validation.fileSize,
    mimeType: "application/pdf",
    pageCount: 0,
    chunkCount: 0,
    subject: subject || "General Engineering",
    knowledgeScope,
    ownerId,
    status: "processing",
    storageKey,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await createDocument(initialDoc);

  // 4. Extract pages and validate text extraction
  let pages: string[];
  try {
    pages = await extractPagesFromPdf(bytes);
  } catch (error) {
    await updateDocumentStatus(documentId, "error", {
      errorMessage: "Failed to extract text from PDF.",
    });
    await storage.delete(storageKey);
    return jsonError(400, "Could not parse PDF content.", {
      details: error instanceof Error ? error.message : String(error),
    });
  }

  const { pending, emptyPages } = pagesToPendingChunks(file.name, pages);

  if (pending.length === 0) {
    const errorMsg = emptyPages.length
      ? "No extractable text found. This PDF may contain scanned images only without OCR."
      : "The uploaded PDF contains no readable text.";
    await updateDocumentStatus(documentId, "error", { errorMessage: errorMsg });
    await storage.delete(storageKey);
    return jsonError(400, errorMsg, { emptyPages });
  }

  // 5. Generate embeddings via OpenRouter
  let embeddings: number[][];
  try {
    embeddings = await embedTexts(pending.map((item) => item.text));
  } catch (error) {
    const { status, message } = friendlyEmbedError(error);
    await updateDocumentStatus(documentId, "error", { errorMessage: message });
    return jsonError(status, message);
  }

  // 6. Index chunks into Qdrant Cloud
  const qdrantPoints: Array<{ id: string; vector: number[]; payload: VectorChunkPayload }> = [];
  const clientChunks: IndexRecord[] = [];

  for (let index = 0; index < pending.length; index++) {
    const item = pending[index];
    const vector = embeddings[index];
    const chunkId = `${documentId}::p${item.page}::c${index}`;

    const payload: VectorChunkPayload = {
      chunkId,
      documentId,
      documentName: file.name,
      text: item.text,
      page: item.page,
      subject: subject || "General Engineering",
      documentType: isGlobal ? "reference_textbook" : "student_notes",
      ownerId,
      knowledgeScope,
      createdAt: Date.now(),
    };

    qdrantPoints.push({
      id: chunkId,
      vector,
      payload,
    });

    clientChunks.push({
      id: chunkId,
      text: item.text,
      file: file.name,
      page: item.page,
      embedding: vector,
      documentId,
      subject: subject || "General Engineering",
      documentType: isGlobal ? "reference_textbook" : "student_notes",
      ownerId,
      knowledgeScope,
    });
  }

  try {
    await upsertChunks(qdrantPoints);
  } catch (error) {
    console.error("[Upload] Failed to index chunks to Qdrant Cloud:", error);
    await updateDocumentStatus(documentId, "error", {
      errorMessage: "Failed to index vectors in Qdrant Cloud.",
    });
    return jsonError(500, "Vector indexing failed. Please try again.");
  }

  // 7. Update status to 'ready'
  const finalDoc = await updateDocumentStatus(documentId, "ready", {
    pageCount: pages.length,
    chunkCount: pending.length,
  });

  return Response.json({
    success: true,
    file: file.name,
    document: finalDoc,
    chunks: clientChunks,
    chunkCount: pending.length,
    emptyPages,
    scope: knowledgeScope,
  });
}

export async function DELETE(request: Request) {
  let body: { id?: string; file?: string; sessionId?: string } | null = null;
  try {
    body = (await request.json()) as { id?: string; file?: string; sessionId?: string };
  } catch {
    return jsonError(400, "Expected JSON body with { id } or { file, sessionId }");
  }

  // Deletion by document ID
  if (body?.id) {
    const success = await deleteDocument(body.id);
    if (!success) {
      return jsonError(404, "Document not found or already deleted.");
    }
    return Response.json({ success: true, id: body.id });
  }

  // Deletion by file name and sessionId (legacy student remove)
  if (body?.file && body?.sessionId) {
    const docs = await listDocuments({ sessionId: body.sessionId, scope: "private" });
    const target = docs.find((d) => d.name === body.file);
    if (target) {
      await deleteDocument(target.id);
      return Response.json({ success: true, id: target.id, file: body.file });
    }
    return Response.json({ success: true, file: body.file });
  }

  return jsonError(400, "Specify 'id' or 'file' with 'sessionId' to delete.");
}
