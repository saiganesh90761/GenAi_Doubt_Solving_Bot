import { checkQdrantHealth, ensureCollection, upsertChunks, searchChunks, deleteChunksByDocument, getQdrantClient } from "../lib/qdrant";
import { config } from "../lib/config";
import type { VectorChunkPayload } from "../lib/types";

async function runTestSuite() {
  console.log("==================================================");
  console.log("  Engineering Doubt Solver - RAG Verification  ");
  console.log("==================================================");

  // 1. Connectivity Check
  console.log("\n[Test 1] Testing Qdrant Cloud connectivity...");
  const health = await checkQdrantHealth();
  if (!health.ok) {
    throw new Error(`Health check failed: ${health.message}`);
  }
  console.log(`✅ ${health.message}`);

  // 2. Collection Validation
  console.log("\n[Test 2] Ensuring Qdrant collection exists and matches schema...");
  await ensureCollection();
  const client = getQdrantClient();
  const collectionInfo = await client.getCollection(config.qdrant.collectionName);
  console.log(`✅ Collection: ${config.qdrant.collectionName}`);
  console.log(`   Points Count: ${collectionInfo.points_count ?? 0}`);
  console.log(`   Status: ${collectionInfo.status}`);

  // 3. Vector Insertion with Full Schema
  console.log("\n[Test 3] Testing vector insertion with full metadata schema...");
  const testDocName = "thermodynamics_ch1_test.pdf";
  const testSessionId = `test_sess_${Date.now()}`;
  const dummyEmbedding = new Array(config.qdrant.vectorSize).fill(0).map((_, i) => Math.sin(i / 10));

  const testPayloadGlobal: VectorChunkPayload = {
    chunkId: "thermo::p1::c0",
    documentId: "doc_thermo_001",
    documentName: testDocName,
    text: "The First Law of Thermodynamics states that energy cannot be created or destroyed, only transformed: delta_U = Q - W.",
    page: 1,
    subject: "Mechanical Engineering - Thermodynamics",
    documentType: "textbook",
    ownerId: null,
    knowledgeScope: "global",
    createdAt: Date.now(),
  };

  const testPayloadPrivate: VectorChunkPayload = {
    chunkId: "notes::p1::c0",
    documentId: "doc_student_notes_001",
    documentName: "my_course_notes.pdf",
    text: "Professor mentioned Kirchhoff's Voltage Law will be on Monday quiz with 3 loop problems.",
    page: 1,
    subject: "Electrical Engineering",
    documentType: "student_notes",
    ownerId: testSessionId,
    knowledgeScope: "private",
    createdAt: Date.now(),
  };

  const upsertRes = await upsertChunks([
    { id: testPayloadGlobal.chunkId, vector: dummyEmbedding, payload: testPayloadGlobal },
    { id: testPayloadPrivate.chunkId, vector: dummyEmbedding, payload: testPayloadPrivate },
  ]);

  console.log(`✅ Upserted ${upsertRes.upserted} chunks with required metadata fields.`);

  // 4. Vector Retrieval & Filtering
  console.log("\n[Test 4] Testing similarity search and metadata filtering...");

  // Search Global
  const globalResults = await searchChunks({
    vector: dummyEmbedding,
    knowledgeScope: "global",
    limit: 5,
  });
  const foundGlobal = globalResults.find((r) => r.payload.documentName === testDocName);
  if (!foundGlobal) {
    throw new Error("Could not retrieve global test chunk!");
  }
  console.log(`✅ Global search successful: Found "${foundGlobal.payload.documentName}" (Score: ${foundGlobal.score.toFixed(4)})`);

  // Search Private with owner ID
  const privateResults = await searchChunks({
    vector: dummyEmbedding,
    ownerId: testSessionId,
    limit: 5,
  });
  const foundPrivate = privateResults.find((r) => r.payload.ownerId === testSessionId);
  if (!foundPrivate) {
    throw new Error("Could not retrieve private session chunk!");
  }
  console.log(`✅ Private session search successful: Found "${foundPrivate.payload.documentName}" for owner ${foundPrivate.payload.ownerId}`);

  // 5. Cleanup
  console.log("\n[Test 5] Cleaning up test vectors...");
  await deleteChunksByDocument(testDocName);
  await deleteChunksByDocument("my_course_notes.pdf", testSessionId);
  console.log("✅ Cleanup complete.");

  console.log("\n==================================================");
  console.log("  ALL RAG TESTS PASSED SUCCESSFULLY!  ");
  console.log("==================================================");
}

runTestSuite().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
