import { APIError, RateLimitError } from "openai";
import { z } from "zod";
import { openrouter } from "@/lib/openrouter";
import {
  retrieve,
  contextualizeQuery,
  buildAcademicContext,
  type RetrievedChunk,
  type ChatSource,
} from "@/lib/rag";
import { config } from "@/lib/config";
import type { IndexRecord } from "@/lib/types";

export const maxDuration = 60;

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const chunkSchema = z.object({
  id: z.string(),
  text: z.string(),
  file: z.string(),
  page: z.number(),
  embedding: z.array(z.number()),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
  userChunks: z.array(chunkSchema).optional().default([]),
  sessionId: z.string().optional(),
  subject: z.string().optional(),
  documentId: z.string().optional(),
  scope: z.enum(["all", "global", "private"]).optional().default("all"),
});

function lastUserMessage(
  messages: z.infer<typeof messageSchema>[],
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && messages[i].content.trim()) {
      return messages[i].content.trim();
    }
  }
  return null;
}

function memoryTurns(messages: z.infer<typeof messageSchema>[]) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-4)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));
}

function friendlyError(error: unknown): { status: number; message: string } {
  console.error("[Chat Route Error]:", error);
  if (error instanceof RateLimitError || (error instanceof APIError && error.status === 429)) {
    return {
      status: 429,
      message:
        "The tutor is busy right now (rate limited). Please wait a moment and try again.",
    };
  }

  if (error instanceof APIError) {
    if (error.status === 401 || error.status === 403) {
      return {
        status: 502,
        message:
          "The tutor could not authenticate with OpenRouter. Please check that OPENROUTER_API_KEY in .env.local is valid.",
      };
    }

    return {
      status: error.status && error.status >= 400 && error.status < 500 ? 400 : 502,
      message:
        "Something went wrong while contacting the language model. Please try again.",
    };
  }

  return {
    status: 500,
    message: "Something went wrong while answering your question. Please try again.",
  };
}

function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function sseChunk(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError(400, "Request body must be JSON.");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(400, "Send { messages } with a non-empty messages array.");
  }

  const { messages, userChunks, sessionId, subject, documentId, scope } = parsed.data;
  const rawQuery = lastUserMessage(messages);
  if (!rawQuery) {
    return jsonError(400, "Please include a user message to answer.");
  }

  if (rawQuery.length > 4000) {
    return jsonError(400, "Your question is too long. Please shorten it to under 4,000 characters.");
  }

  const model = config.models.chatModel;
  if (!model) {
    return jsonError(500, "The tutor is not configured yet (missing MODEL_NAME).");
  }
  if (!config.openrouter.apiKey) {
    return jsonError(500, "The tutor is not configured yet (missing OPENROUTER_API_KEY).");
  }

  // 1. Contextualize query for follow-up conversational turns
  const priorHistory = messages.slice(0, -1);
  const effectiveQuery = await contextualizeQuery(rawQuery, priorHistory);

  // 2. Retrieve relevant chunks from Qdrant Cloud (and local index / user chunks fallback)
  let retrieved: RetrievedChunk[] = [];
  try {
    retrieved = await retrieve({
      query: effectiveQuery,
      ownerId: sessionId || null,
      extraChunks: userChunks as IndexRecord[],
      k: config.rag.defaultTopK,
      subject,
      documentId,
      knowledgeScope: scope,
      scoreThreshold: config.rag.similarityThreshold,
    });
  } catch (error) {
    console.warn("[Chat Route] Retrieval failed, proceeding with general fallback:", error);
  }

  // 3. Construct structured academic context & citation references
  const academicContext = buildAcademicContext(retrieved);
  const sources: ChatSource[] = academicContext.sources;

  // 4. Request streaming chat completion from OpenRouter
  let completion;
  try {
    completion = await openrouter.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: "system", content: academicContext.systemPrompt },
        ...memoryTurns(messages),
      ],
    });
  } catch (error) {
    const { status, message } = friendlyError(error);
    return jsonError(status, message);
  }

  // 5. Stream response via Server-Sent Events (SSE)
  const stream = new ReadableStream({
    async start(controller) {
      // Send sources payload first so frontend renders source cards immediately
      controller.enqueue(sseChunk({ type: "sources", sources }));

      try {
        for await (const part of completion) {
          const text = part.choices[0]?.delta?.content;
          if (text) {
            controller.enqueue(sseChunk({ type: "delta", text }));
          }
        }
        controller.enqueue(sseChunk({ type: "done" }));
      } catch (error) {
        const { message } = friendlyError(error);
        controller.enqueue(sseChunk({ type: "error", message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Rag-Sources": encodeURIComponent(JSON.stringify(sources)),
    },
  });
}
