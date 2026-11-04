import { getDocumentById, deleteDocument } from "@/lib/documents";
import { storage } from "@/lib/storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const action = searchParams.get("action");

  const doc = await getDocumentById(id);
  if (!doc) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  // Access control: private documents require owner sessionId
  if (doc.knowledgeScope === "private" && doc.ownerId !== sessionId) {
    return Response.json(
      { error: "Access denied. You do not have permission to access this private document." },
      { status: 403 },
    );
  }

  // If metadata only requested
  if (action === "meta") {
    return Response.json({ document: doc });
  }

  // Retrieve file from object storage
  const file = await storage.get(doc.storageKey);
  if (!file) {
    return Response.json(
      { error: "Original file not found in storage." },
      { status: 404 },
    );
  }

  return new Response(file.data as BodyInit, {
    headers: {
      "Content-Type": file.contentType || "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.name)}"`,
      "Content-Length": String(file.data.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  let sessionId = searchParams.get("sessionId");

  // Also check if sessionId was sent in body
  if (!sessionId) {
    try {
      const body = (await request.json()) as { sessionId?: string };
      if (body?.sessionId) sessionId = body.sessionId;
    } catch {
      // ignore
    }
  }

  const doc = await getDocumentById(id);
  if (!doc) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  // Access control: if private, only owner can delete
  if (doc.knowledgeScope === "private" && doc.ownerId !== sessionId) {
    return Response.json(
      { error: "Access denied. You cannot delete another student's document." },
      { status: 403 },
    );
  }

  const deleted = await deleteDocument(id);
  if (!deleted) {
    return Response.json({ error: "Failed to delete document." }, { status: 500 });
  }

  return Response.json({
    success: true,
    id: doc.id,
    name: doc.name,
    knowledgeScope: doc.knowledgeScope,
  });
}

