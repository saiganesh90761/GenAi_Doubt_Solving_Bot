import { APIError, RateLimitError } from "openai";
import { z } from "zod";
import { openrouter } from "@/lib/openrouter";
import { retrieve } from "@/lib/rag";
import type { IndexRecord } from "@/lib/types";

export const maxDuration = 60;

const TUTOR_PROMPT =
  "You are an engineering tutor. Answer step by step using the provided context. Use formulas where needed. If the context doesn't contain the answer, say so clearly, then give a short general-knowledge answer labelled as such.";

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
});

type Source = {
  file: string;
  page: number;
  snippet: string;
};

function snippetFrom(text: string, max = 240): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}…`;
}

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

function buildSystemPrompt(chunks: { file: string; page: number; text: string }[]) {
  const context =
    chunks.length === 0
      ? "(No retrieved context.)"
      : chunks
          .map(
            (chunk, index) =>
              `[${index + 1}] ${chunk.file} (p. ${chunk.page})\n${chunk.text}`,
          )
          .join("\n\n");

  return `${TUTOR_PROMPT}

Context:
${context}`;
}

function friendlyError(error: unknown): { status: number; message: string } {
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
        message: "The tutor could not authenticate with the language model. Please try again later.",
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
    return jsonError(400, "Send { messages, userChunks } with a non-empty messages array.");
  }

  const { messages, userChunks } = parsed.data;
  const query = lastUserMessage(messages);
  if (!query) {
    return jsonError(400, "Please include a user message to answer.");
  }

  const model = process.env.MODEL_NAME;
  if (!model) {
    return jsonError(500, "The tutor is not configured yet (missing MODEL_NAME).");
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return jsonError(500, "The tutor is not configured yet (missing OPENROUTER_API_KEY).");
  }

  let retrieved;
  try {
    retrieved = await retrieve(query, userChunks as IndexRecord[], 5);
  } catch (error) {
    const { status, message } = friendlyError(error);
    return jsonError(status, message);
  }

  const sources: Source[] = retrieved.map((chunk) => ({
    file: chunk.file,
    page: chunk.page,
    snippet: snippetFrom(chunk.text),
  }));

  let completion;
  try {
    completion = await openrouter.chat.completions.create({
      model,
      stream: true,
      messages: [
        { role: "system", content: buildSystemPrompt(retrieved) },
        ...memoryTurns(messages),
      ],
    });
  } catch (error) {
    const { status, message } = friendlyError(error);
    return jsonError(status, message);
  }

  const stream = new ReadableStream({
    async start(controller) {
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
