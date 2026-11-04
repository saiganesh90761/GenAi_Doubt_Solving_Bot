import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { openrouter } from "./openrouter";
import { searchChunks } from "./qdrant";
import { config } from "./config";
import type { IndexRecord } from "./types";

export type { IndexRecord } from "./types";

export type RetrievedChunk = IndexRecord & {
  score: number;
};

export type ChatSource = {
  file: string;
  page: number;
  snippet: string;
  score?: number;
  subject?: string;
  documentId?: string;
  knowledgeScope?: string;
};

const INDEX_PATH = path.join(process.cwd(), "data", "index.json");

let cachedIndex: IndexRecord[] | null = null;

export function snippetFrom(text: string, max = 240): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}…`;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function loadIndex(): IndexRecord[] {
  if (cachedIndex !== null) return cachedIndex;

  if (!existsSync(INDEX_PATH)) {
    cachedIndex = [];
    return cachedIndex;
  }

  const raw = readFileSync(INDEX_PATH, "utf8").trim();
  if (!raw) {
    cachedIndex = [];
    return cachedIndex;
  }

  try {
    const parsed = JSON.parse(raw) as IndexRecord[];
    cachedIndex = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedIndex = [];
  }
  return cachedIndex;
}

import { generateResilientVector } from "./embed";

export async function embedQuery(text: string): Promise<number[]> {
  const model = config.models.embedModel;
  if (!model) {
    return generateResilientVector(text, config.qdrant.vectorSize);
  }

  try {
    const response = await openrouter.embeddings.create({
      model,
      input: text,
    });

    const embedding = response.data[0]?.embedding;
    if (embedding?.length) {
      return embedding;
    }
  } catch (err) {
    console.warn(
      "[RAG] OpenRouter embedQuery rate limited or unavailable, using resilient fallback vector for Qdrant Cloud:",
      err instanceof Error ? err.message : err,
    );
  }

  return generateResilientVector(text, config.qdrant.vectorSize);
}

/**
 * Reformulates follow-up queries using conversational memory so semantic search
 * captures previous engineering context instead of ambiguous pronouns (e.g., "what if it changes?").
 */
export async function contextualizeQuery(
  currentQuery: string,
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>,
): Promise<string> {
  const previousTurns = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-4);

  if (previousTurns.length === 0) {
    return currentQuery;
  }

  // Fast check: if the query contains pronouns or is very concise, contextualize it
  const isLikelyFollowUp =
    currentQuery.split(/\s+/).length < 8 ||
    /\b(it|this|that|they|these|those|its|their|the above|previous|same|explain more|derive it|continue|how about|what about)\b/i.test(
      currentQuery,
    );

  if (!isLikelyFollowUp) {
    return currentQuery;
  }

  try {
    const prompt = `Given the conversation history and a follow-up question, rewrite the follow-up question into a standalone engineering search query.
Preserve all technical terms and subject names.
Do NOT answer the question. Only output the single rewritten question without explanations or quotation marks.

Conversation history:
${previousTurns.map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content.slice(0, 180)}`).join("\n")}

Follow-up question: ${currentQuery}

Standalone search query:`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    const res = await openrouter.chat.completions.create(
      {
        model: config.models.chatModel,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 60,
        temperature: 0.1,
      },
      { signal: controller.signal },
    );
    clearTimeout(timer);

    const rewritten = res.choices[0]?.message?.content?.trim();
    if (rewritten && rewritten.length > 3 && rewritten.length < 250) {
      return rewritten
        .replace(/^["']|["']$/g, "")
        .replace(/^Standalone search query:\s*/i, "")
        .trim();
    }
  } catch (err) {
    console.warn("[RAG] LLM query contextualization timed out or skipped:", err);
  }

  // Robust heuristic fallback: attach key terms from previous user question
  const lastUserTurn = previousTurns.filter((m) => m.role === "user").pop();
  if (lastUserTurn && lastUserTurn.content.trim()) {
    return `${lastUserTurn.content.trim()} ${currentQuery}`.trim();
  }

  return currentQuery;
}

export type RetrieveParams = {
  query: string;
  ownerId?: string | null;
  extraChunks?: IndexRecord[];
  k?: number;
  subject?: string;
  documentId?: string;
  knowledgeScope?: "all" | "global" | "private";
  scoreThreshold?: number;
};

export async function retrieve(
  queryOrParams: string | RetrieveParams,
  legacyExtraChunks: IndexRecord[] = [],
  legacyK = config.rag.defaultTopK,
): Promise<RetrievedChunk[]> {
  let query: string;
  let ownerId: string | null = null;
  let extraChunks: IndexRecord[] = [];
  let k = config.rag.defaultTopK;
  let subject: string | undefined = undefined;
  let documentId: string | undefined = undefined;
  let knowledgeScope: "all" | "global" | "private" = "all";
  let scoreThreshold = config.rag.similarityThreshold;

  if (typeof queryOrParams === "string") {
    query = queryOrParams;
    extraChunks = legacyExtraChunks;
    k = legacyK;
  } else {
    query = queryOrParams.query;
    ownerId = queryOrParams.ownerId || null;
    extraChunks = queryOrParams.extraChunks || [];
    k = queryOrParams.k || config.rag.defaultTopK;
    subject = queryOrParams.subject;
    documentId = queryOrParams.documentId;
    knowledgeScope = queryOrParams.knowledgeScope || "all";
    scoreThreshold = queryOrParams.scoreThreshold || config.rag.similarityThreshold;
  }

  let queryEmbedding: number[] = [];
  try {
    queryEmbedding = await embedQuery(query);
  } catch (error) {
    console.warn("[RAG] embedQuery encountered an error (e.g. rate limit):", error);
  }
  const results: RetrievedChunk[] = [];

  // 1. Search Qdrant Cloud (if embedding succeeded)
  if (queryEmbedding.length > 0) {
    try {
      const qdrantResults = await searchChunks({
        vector: queryEmbedding,
        limit: k,
        ownerId,
        subject,
        documentId,
        knowledgeScope,
        scoreThreshold,
      });

      for (const chunk of qdrantResults) {
        const payload = chunk.payload || {};
        results.push({
          id: String(payload.chunkId || chunk.id),
          text: String(payload.text || ""),
          file: String(payload.documentName || payload.file || "Document"),
          page: typeof payload.page === "number" ? payload.page : 1,
          embedding: [],
          score: chunk.score,
          subject: payload.subject ? String(payload.subject) : undefined,
          documentType: payload.documentType ? String(payload.documentType) : undefined,
          documentId: payload.documentId ? String(payload.documentId) : undefined,
          ownerId: payload.ownerId ? String(payload.ownerId) : null,
          knowledgeScope: payload.knowledgeScope === "private" ? "private" : "global",
        });
      }
    } catch (error) {
      console.warn("[RAG] Qdrant search encountered an error, falling back to local index:", error);
    }
  }

  // 2. Process any in-memory extraChunks (e.g. from user session or legacy callers)
  if (extraChunks.length > 0) {
    const scoredExtra: RetrievedChunk[] = extraChunks
      .filter((chunk) => chunk.embedding?.length)
      .map((chunk) => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .filter((chunk) => chunk.score >= scoreThreshold);

    results.push(...scoredExtra);
  }

  // 3. Fallback to local index if no results from Qdrant and no extraChunks
  if (results.length === 0) {
    const localIndex = loadIndex();
    if (localIndex.length > 0) {
      const scoredLocal: RetrievedChunk[] = localIndex
        .filter((chunk) => chunk.embedding?.length)
        .map((chunk) => ({
          ...chunk,
          score: cosineSimilarity(queryEmbedding, chunk.embedding),
        }))
        .filter((chunk) => chunk.score >= scoreThreshold);

      results.push(...scoredLocal);
    }
  }

  // Sort by score descending, deduplicate adjacent identical text, and pick top-k
  const sorted = results.sort((a, b) => b.score - a.score);
  const deduplicated: RetrievedChunk[] = [];
  const seenSnippet = new Set<string>();

  for (const item of sorted) {
    const key = `${item.file}::${item.page}::${item.text.slice(0, 50)}`;
    if (!seenSnippet.has(key)) {
      seenSnippet.add(key);
      deduplicated.push(item);
    }
    if (deduplicated.length >= k) break;
  }

  return deduplicated;
}

export interface AcademicContextResult {
  systemPrompt: string;
  sources: ChatSource[];
  hasContext: boolean;
  totalTokensEstimate: number;
}

/**
 * Constructs an academic system prompt with structured reference excerpts,
 * strict citation formatting guidelines, and rigorous hallucination control.
 */
export function buildAcademicContext(
  chunks: RetrievedChunk[],
  maxChars = 10000,
): AcademicContextResult {
  // Budget context length to stay well within model window
  let currentChars = 0;
  const budgeted: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    const len = chunk.text.length;
    if (currentChars + len > maxChars && budgeted.length > 0) {
      break;
    }
    budgeted.push(chunk);
    currentChars += len;
  }

  const sources: ChatSource[] = budgeted.map((chunk) => ({
    file: chunk.file,
    page: chunk.page,
    snippet: snippetFrom(chunk.text),
    score: Number((chunk.score || 0).toFixed(4)),
    documentId: chunk.documentId,
    subject: chunk.subject,
    knowledgeScope: chunk.knowledgeScope,
  }));

  const hasContext = budgeted.length > 0;

  const contextBody = hasContext
    ? budgeted
        .map(
          (c, idx) =>
            `[Source ${idx + 1}]
Document: ${c.file}
Page: ${c.page}
Subject: ${c.subject || "General Engineering"}
Relevance Score: ${(c.score || 0).toFixed(4)}
Content:
${c.text}`,
        )
        .join("\n\n---\n\n")
    : "(No matching reference documents found in the engineering library.)";

  const systemPrompt = `You are the Engineering Doubt Solver, a world-class academic tutor and university professor in engineering sciences.
Your objective is to provide accurate, pedagogically structured, and rigorously grounded answers to engineering students.

### PEDAGOGICAL & EXPLANATION STANDARDS:
1. **Intuitive Progression**:
   - Begin with a clear, intuitive conceptual explanation before introducing advanced technical abstractions or mathematical formalism.
   - Use structured formatting: bold key terms, numbered steps for sequential derivations, and bullet points for properties, advantages, or conditions.
2. **Mathematical Rigor & LaTeX**:
   - For mathematical derivations or quantitative questions, provide detailed, step-by-step proofs showing intermediate algebraic steps.
   - ALWAYS format formulas using standard LaTeX notation:
     * Inline math: single dollar signs, e.g., \`$V = I \\cdot R$\` or \`$\\oint \\mathbf{E} \\cdot d\\mathbf{A} = \\frac{q_{\\text{enc}}}{\\varepsilon_0}$\`.
     * Display formulas: double dollar signs on their own lines, e.g.:
       \`\`\`latex
       $$\\sum_{k=1}^n V_k = 0$$
       \`\`\`
   - Explicitly define every symbol and specify standard SI units (e.g., $I$ in Amperes, $R$ in Ohms, $T$ in Kelvin).
3. **Practical Engineering Applications**:
   - Illustrate theoretical principles with concrete practical engineering examples (e.g., real circuit topologies, structural trusses, thermodynamic power cycles, or fluid piping).
4. **Distinguish Verified Facts from Assumptions**:
   - Clearly delineate facts grounded in textbooks from engineering conventions or simplifying assumptions (e.g., "Assuming steady-state adiabatic flow with negligible potential energy changes...").

### CITATION & GROUNDING RULES:
- When using information from the provided Reference Context below, cite the exact source in-text using:
  \`[Source N: <Document Name>, p. <Page>]\` (e.g., \`[Source 1: circuit_theory.pdf, p. 12]\`).
- **STRICT PROHIBITION**: NEVER invent, guess, or fabricate citations, textbook titles, authors, or page numbers. Every citation MUST correspond directly to an actual provided Source block in the Context below.
- Do NOT claim a source supports a fact if the text does not explicitly state or directly imply it.

### HALLUCINATION CONTROL & INSUFFICIENT CONTEXT:
- If the Reference Context below is empty, insufficient, or does not directly answer the student's question:
  1. Clearly state at the very beginning: "The available reference materials in the library do not contain sufficient details to fully answer this question."
  2. Do NOT invent textbook references or page numbers.
  3. You may provide an educational answer based on general engineering knowledge, but you MUST label that section clearly under the heading:
     \`### General Engineering Knowledge (Not in Uploaded References)\`

---
REFERENCE CONTEXT:
${contextBody}
---`;

  return {
    systemPrompt,
    sources,
    hasContext,
    totalTokensEstimate: Math.round(systemPrompt.length / 4),
  };
}
