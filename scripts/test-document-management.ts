import assert from "node:assert";
import crypto from "node:crypto";
import { config } from "../lib/config";
import { validatePdfFile } from "../lib/validation";
import { storage } from "../lib/storage";
import {
  createDocument,
  updateDocumentStatus,
  listDocuments,
  getDocumentById,
  deleteDocument,
  findDocumentByHash,
  type DocumentRecord,
} from "../lib/documents";
import {
  extractPagesFromPdf,
  pagesToPendingChunks,
} from "../lib/chunk";
import { embedTexts } from "../lib/embed";
import {
  upsertChunks,
  searchChunks,
  checkQdrantHealth,
  ensureCollection,
} from "../lib/qdrant";
import { openrouter } from "../lib/openrouter";

function buildMinimalPdf(text: string): Buffer {
  const content = `BT\n/F1 14 Tf\n50 700 Td\n(${text}) Tj\nET`;
  const objects: string[] = [];

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj",
  );
  objects.push(
    `4 0 obj\n<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream\nendobj`,
  );
  objects.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
  );

  const header = "%PDF-1.4\n";
  const offsets: number[] = [];
  let currentOffset = Buffer.byteLength(header);
  let body = "";

  for (const obj of objects) {
    offsets.push(currentOffset);
    const objStr = obj + "\n";
    body += objStr;
    currentOffset += Buffer.byteLength(objStr);
  }

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer);
}

function buildEmptyTextPdf(): Buffer {
  const content = "";
  const objects: string[] = [];

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>\nendobj",
  );
  objects.push(
    `4 0 obj\n<< /Length 0 >>\nstream\n${content}\nendstream\nendobj`,
  );

  const header = "%PDF-1.4\n";
  const offsets: number[] = [];
  let currentOffset = Buffer.byteLength(header);
  let body = "";

  for (const obj of objects) {
    offsets.push(currentOffset);
    const objStr = obj + "\n";
    body += objStr;
    currentOffset += Buffer.byteLength(objStr);
  }

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(header + body + xref + trailer);
}

async function runTests() {
  console.log("=== STARTING FULL DOCUMENT MANAGEMENT & RAG TESTS ===\n");

  // 0. Verify Health & Collection
  console.log("[0] Checking Qdrant connection and collection...");
  const health = await checkQdrantHealth();
  assert.strictEqual(health.ok, true, "Qdrant must be healthy and reachable");
  await ensureCollection();
  console.log("    ✓ Qdrant is connected and collection initialized.\n");

  // 1. Invalid file rejection
  console.log("[1] Testing invalid file rejection...");
  const nonPdfBuf = Buffer.from("Hello world text");
  const resNonPdf = validatePdfFile(new Uint8Array(nonPdfBuf), "notes.txt", "text/plain", false);
  assert.strictEqual(resNonPdf.valid, false);
  assert(resNonPdf.error?.includes(".pdf"));
  console.log("    ✓ Non-pdf extension rejected:", resNonPdf.error);

  const fakePdfBuf = Buffer.from("NOT-A-PDF-CONTENT-AT-ALL");
  const resFakePdf = validatePdfFile(new Uint8Array(fakePdfBuf), "fake.pdf", "application/pdf", false);
  assert.strictEqual(resFakePdf.valid, false);
  assert(resFakePdf.error?.includes("signature") || resFakePdf.error?.includes("header"));
  console.log("    ✓ Invalid PDF header/magic bytes rejected:", resFakePdf.error);

  const largeBuffer = Buffer.alloc(16 * 1024 * 1024);
  largeBuffer.write("%PDF-1.4\n", 0);
  const resOversized = validatePdfFile(new Uint8Array(largeBuffer), "big.pdf", "application/pdf", false);
  assert.strictEqual(resOversized.valid, false);
  assert(resOversized.error?.includes("exceeds the maximum limit"));
  console.log("    ✓ Oversized student file rejected:", resOversized.error);
  console.log("    ✓ Passed invalid file rejection tests.\n");

  // 2. Empty PDF handling
  console.log("[2] Testing empty PDF handling...");
  const zeroByteBuf = Buffer.alloc(0);
  const resZeroByte = validatePdfFile(new Uint8Array(zeroByteBuf), "empty.pdf", "application/pdf", false);
  assert.strictEqual(resZeroByte.valid, false);
  assert(resZeroByte.error?.includes("empty"));
  console.log("    ✓ 0-byte file rejected:", resZeroByte.error);

  const emptyTextPdfBuf = buildEmptyTextPdf();
  const emptyPages = await extractPagesFromPdf(new Uint8Array(emptyTextPdfBuf));
  const hasContent = emptyPages.some((p) => p.trim().length > 0);
  assert.strictEqual(hasContent, false, "Empty text PDF must have no extractable text");
  console.log("    ✓ PDF with no text recognized as empty.\n");

  // 3. Valid PDF Upload & Ingestion (Global vs Private)
  console.log("[3] Testing valid PDF upload & ingestion (Global & Private)...");
  const runId = Date.now();

  // 3a. Global Reference Document
  const globalPdfText = `Run ${runId}: Thermodynamics first law states energy cannot be created or destroyed only transformed.`;
  const globalPdfBuf = buildMinimalPdf(globalPdfText);
  const globalFileName = `thermo_${runId}.pdf`;
  const globalVal = validatePdfFile(new Uint8Array(globalPdfBuf), globalFileName, "application/pdf", true);
  assert.strictEqual(globalVal.valid, true);

  const globalDocId = crypto.randomUUID();
  const globalStorageKey = `global/${runId}_${globalFileName}`;
  const globalDoc: DocumentRecord = {
    id: globalDocId,
    name: globalFileName,
    fileHash: globalVal.fileHash,
    fileSize: globalPdfBuf.length,
    mimeType: "application/pdf",
    pageCount: 0,
    chunkCount: 0,
    subject: "Mechanical Engineering",
    knowledgeScope: "global",
    ownerId: null,
    status: "uploading",
    storageKey: globalStorageKey,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await createDocument(globalDoc);
  await storage.put(globalDoc.storageKey, globalPdfBuf, "application/pdf");

  const globalPages = await extractPagesFromPdf(new Uint8Array(globalPdfBuf));
  assert(globalPages.length >= 1, "Must extract at least 1 page");
  const { pending: globalChunks } = pagesToPendingChunks(globalDoc.name, globalPages);
  assert(globalChunks.length >= 1, "Must generate chunks");

  const globalEmbeddings = await embedTexts(globalChunks.map((c) => c.text));
  const globalVectorChunks = globalChunks.map((c, i) => ({
    id: `global-${globalDoc.id}-${i}`,
    vector: globalEmbeddings[i],
    payload: {
      chunkId: `global-${globalDoc.id}-${i}`,
      documentId: globalDoc.id,
      docId: globalDoc.id,
      documentName: globalDoc.name,
      file: globalDoc.name,
      page: c.page,
      text: c.text,
      subject: "Mechanical Engineering",
      documentType: "reference" as const,
      knowledgeScope: "global" as const,
      ownerId: null,
      createdAt: Date.now(),
    },
  }));
  await upsertChunks(globalVectorChunks);
  await updateDocumentStatus(globalDoc.id, "ready", {
    pageCount: globalPages.length,
    chunkCount: globalVectorChunks.length,
  });
  console.log("    ✓ Global reference document indexed successfully:", globalDoc.id);

  // 3b. Private Student Document (Alice)
  const alicePdfText = `Run ${runId}: Alice private notes on Kirchhoff current law states the sum of currents entering a node is zero.`;
  const alicePdfBuf = buildMinimalPdf(alicePdfText);
  const aliceFileName = `circuits_${runId}.pdf`;
  const aliceVal = validatePdfFile(new Uint8Array(alicePdfBuf), aliceFileName, "application/pdf", false);
  assert.strictEqual(aliceVal.valid, true);

  const aliceDocId = crypto.randomUUID();
  const aliceStorageKey = `private/student-alice/${runId}_${aliceFileName}`;
  const aliceDoc: DocumentRecord = {
    id: aliceDocId,
    name: aliceFileName,
    fileHash: aliceVal.fileHash,
    fileSize: alicePdfBuf.length,
    mimeType: "application/pdf",
    pageCount: 0,
    chunkCount: 0,
    subject: "Electrical Engineering",
    knowledgeScope: "private",
    ownerId: "student-alice",
    status: "uploading",
    storageKey: aliceStorageKey,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await createDocument(aliceDoc);
  await storage.put(aliceDoc.storageKey, alicePdfBuf, "application/pdf");

  const alicePages = await extractPagesFromPdf(new Uint8Array(alicePdfBuf));
  const { pending: aliceChunks } = pagesToPendingChunks(aliceDoc.name, alicePages);
  const aliceEmbeddings = await embedTexts(aliceChunks.map((c) => c.text));
  const aliceVectorChunks = aliceChunks.map((c, i) => ({
    id: `alice-${aliceDoc.id}-${i}`,
    vector: aliceEmbeddings[i],
    payload: {
      chunkId: `alice-${aliceDoc.id}-${i}`,
      documentId: aliceDoc.id,
      docId: aliceDoc.id,
      documentName: aliceDoc.name,
      file: aliceDoc.name,
      page: c.page,
      text: c.text,
      subject: "Electrical Engineering",
      documentType: "temporary_upload" as const,
      knowledgeScope: "private" as const,
      ownerId: "student-alice",
      createdAt: Date.now(),
    },
  }));
  await upsertChunks(aliceVectorChunks);
  await updateDocumentStatus(aliceDoc.id, "ready", {
    pageCount: alicePages.length,
    chunkCount: aliceVectorChunks.length,
  });
  console.log("    ✓ Alice private document indexed successfully:", aliceDoc.id);

  // 4. Duplicate upload handling
  console.log("\n[4] Testing duplicate upload detection...");
  const duplicateMatch = await findDocumentByHash(aliceVal.fileHash, "private", "student-alice");
  assert(duplicateMatch !== null, "Duplicate hash must be found");
  assert.strictEqual(duplicateMatch.id, aliceDoc.id);
  console.log("    ✓ Duplicate file recognized with matching doc ID:", duplicateMatch.id);

  // 5. Private document isolation
  console.log("\n[5] Testing private document isolation (Alice vs Bob)...");
  // Check metadata visibility for Alice
  const aliceDocs = await listDocuments({ sessionId: "student-alice" });
  const aliceHasAliceDoc = aliceDocs.some((d) => d.id === aliceDoc.id);
  const aliceHasGlobalDoc = aliceDocs.some((d) => d.id === globalDoc.id);
  assert(aliceHasAliceDoc, "Alice must see her own private document");
  assert(aliceHasGlobalDoc, "Alice must see global documents");

  // Check metadata visibility for Bob
  const bobDocs = await listDocuments({ sessionId: "student-bob" });
  const bobHasAliceDoc = bobDocs.some((d) => d.id === aliceDoc.id);
  const bobHasGlobalDoc = bobDocs.some((d) => d.id === globalDoc.id);
  assert(!bobHasAliceDoc, "Bob must NEVER see Alice's private document");
  assert(bobHasGlobalDoc, "Bob must see global documents");
  console.log("    ✓ Document registry isolation verified.");

  // Check vector search isolation
  const bobSearchQuery = "Kirchhoff current law entering a node";
  const [bobQueryEmbedding] = await embedTexts([bobSearchQuery]);
  const bobResults = await searchChunks({
    vector: bobQueryEmbedding,
    ownerId: "student-bob",
    limit: 5,
  });
  const bobFoundAliceChunk = bobResults.some((r) => r.payload?.ownerId === "student-alice");
  assert(!bobFoundAliceChunk, "Bob's search must NEVER retrieve Alice's private vector chunks");
  console.log("    ✓ Vector isolation verified: Bob cannot retrieve Alice's chunks.");

  // Search with Alice's session: should find Alice's chunks
  const aliceResults = await searchChunks({
    vector: bobQueryEmbedding,
    ownerId: "student-alice",
    limit: 5,
  });
  const aliceFoundHerChunk = aliceResults.some((r) => r.payload?.ownerId === "student-alice");
  assert(aliceFoundHerChunk, "Alice must be able to retrieve her own private chunks");
  console.log("    ✓ Vector retrieval verified: Alice can retrieve her own chunks.");

  // 6. Persistent Reference Library Retrieval
  console.log("\n[6] Testing persistent reference library retrieval & storage...");
  const existsInStorage = await storage.exists(globalDoc.storageKey);
  assert.strictEqual(existsInStorage, true, "Global document must exist in object storage");
  const retrievedStream = await storage.get(globalDoc.storageKey);
  assert(retrievedStream !== null, "Object storage stream must be readable");
  const docFromRegistry = await getDocumentById(globalDoc.id);
  assert(docFromRegistry !== null && docFromRegistry.status === "ready");
  console.log("    ✓ Storage and document registry confirmed persistent.");

  // 7. Document Deletion & Vector Cleanup
  console.log("\n[7] Testing document deletion and vector cleanup...");
  // Delete Alice's document via deleteDocument (which deletes vectors, storage, and registry)
  const aliceDeleteSuccess = await deleteDocument(aliceDoc.id);
  assert.strictEqual(aliceDeleteSuccess, true, "deleteDocument must return true");

  assert.strictEqual(await getDocumentById(aliceDoc.id), null, "Doc must be removed from registry");
  assert.strictEqual(await storage.exists(aliceDoc.storageKey), false, "File must not exist in storage");

  // Verify Alice's vectors no longer exist in Qdrant
  const aliceResultsAfterDelete = await searchChunks({
    vector: bobQueryEmbedding,
    ownerId: "student-alice",
    limit: 5,
  });
  const aliceFoundDeletedChunk = aliceResultsAfterDelete.some((r) => r.payload?.documentId === aliceDoc.id);
  assert(!aliceFoundDeletedChunk, "Deleted document chunks must no longer appear in search results");
  console.log("    ✓ Alice's private document, storage, and Qdrant vectors cleaned up completely.");

  // Clean up Global test document
  await deleteDocument(globalDoc.id);
  console.log("    ✓ Global test document and vectors cleaned up.");

  // 8. OpenRouter Chat Completion End-to-End Test
  console.log("\n[8] Testing OpenRouter Chat Completion live integration...");
  const chatResponse = await openrouter.chat.completions.create({
    model: config.models.chatModel,
    messages: [
      { role: "system", content: "You are an engineering tutor. Answer briefly." },
      { role: "user", content: "State Kirchhoff's Voltage Law in one sentence." },
    ],
  });
  const reply = chatResponse.choices[0]?.message?.content;
  assert(reply && reply.length > 0, "Must receive non-empty chat reply from OpenRouter");
  console.log("    ✓ Chat response received successfully from", config.models.chatModel);
  console.log("    Preview:", reply.slice(0, 120), "...\n");

  console.log("==================================================");
  console.log("ALL 8 DOCUMENT MANAGEMENT & RAG TESTS PASSED! ✓");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
