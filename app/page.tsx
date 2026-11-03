"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import type { ChatSource, IndexRecord } from "@/lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  error?: boolean;
};

type LibraryDoc = {
  file: string;
  pages: number;
  chunks: number;
};

type UploadedFile = {
  name: string;
  chunkCount: number;
};

const EXAMPLES = [
  "Explain Kirchhoff’s voltage law with a small circuit example.",
  "Derive the bending equation for a simply supported beam.",
  "What is the difference between laminar and turbulent flow?",
];

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseSsePayload(line: string) {
  try {
    return JSON.parse(line.slice(6)) as { type: string; [key: string]: unknown };
  } catch {
    return null;
  }
}

async function readSse(
  response: Response,
  onEvent: (payload: { type: string; [key: string]: unknown }) => void,
) {
  if (!response.body) {
    throw new Error("No response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flush = (chunk: string) => {
    const line = chunk.split("\n").find((entry) => entry.startsWith("data: "));
    if (!line) return;
    const payload = parseSsePayload(line);
    if (payload) onEvent(payload);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    parts.forEach(flush);
  }

  const tail = buffer + decoder.decode();
  if (tail.trim()) flush(tail);
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="markdown-body text-[0.95rem] leading-7">
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function TypingIndicator() {
  return (
    <p className="flex items-center gap-2 text-sm text-zinc-500" aria-live="polite">
      <span className="typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      Retrieving context and writing an answer…
    </p>
  );
}

function SourcesPanel({ sources }: { sources: ChatSource[] }) {
  if (!sources.length) {
    return (
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        No retrieved sources for this answer.
      </p>
    );
  }

  return (
    <details className="group mt-3 rounded-xl border border-zinc-200 bg-zinc-50/80 open:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:open:bg-zinc-900">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-zinc-700 marker:content-none dark:text-zinc-200">
        <span className="flex items-center justify-between gap-2">
          Sources ({sources.length})
          <span className="text-xs font-normal text-zinc-400 group-open:hidden">Show</span>
          <span className="hidden text-xs font-normal text-zinc-400 group-open:inline">Hide</span>
        </span>
      </summary>
      <ul className="space-y-2 border-t border-zinc-200 px-3 py-3 dark:border-zinc-700">
        {sources.map((source, index) => (
          <li
            key={`${source.file}-${source.page}-${index}`}
            className="rounded-lg bg-white px-3 py-2 text-sm dark:bg-zinc-950"
          >
            <p className="font-medium text-zinc-800 dark:text-zinc-100">
              {source.file}{" "}
              <span className="font-normal text-zinc-500">p. {source.page}</span>
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
              {source.snippet}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const [library, setLibrary] = useState<LibraryDoc[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [userChunks, setUserChunks] = useState<IndexRecord[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const uploadedNames = useMemo(
    () => new Set(uploadedFiles.map((file) => file.name)),
    [uploadedFiles],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/library")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { documents: LibraryDoc[] };
        if (!cancelled) setLibrary(data.documents ?? []);
      })
      .catch(() => {
        if (!cancelled) setLibrary([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendMessage(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const text = (preset ?? input).trim();
    if (!text || isStreaming) return;

    const history: ChatMessage[] = [
      ...messages,
      { id: newId(), role: "user", content: text },
    ];
    const assistantId = newId();

    setInput("");
    setError(null);
    setSidebarOpen(false);
    setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          userChunks,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Could not reach the tutor.");
      }

      const headerSources = response.headers.get("X-Rag-Sources");
      if (headerSources) {
        try {
          const sources = JSON.parse(decodeURIComponent(headerSources)) as ChatSource[];
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId ? { ...message, sources } : message,
            ),
          );
        } catch {
          /* stream event is the source of truth */
        }
      }

      await readSse(response, (payload) => {
        if (payload.type === "sources" && Array.isArray(payload.sources)) {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, sources: payload.sources as ChatSource[] }
                : message,
            ),
          );
        }

        if (payload.type === "delta" && typeof payload.text === "string") {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + payload.text }
                : message,
            ),
          );
        }

        if (payload.type === "error" && typeof payload.message === "string") {
          const errorMessage = payload.message;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    error: true,
                    content: message.content || errorMessage,
                  }
                : message,
            ),
          );
        }
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not send that question.";
      setError(message);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                error: true,
                content: item.content || message,
              }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  }

  async function onUpload(fileList: FileList | null) {
    const files = fileList ? [...fileList] : [];
    if (!files.length) return;
    if (fileRef.current) fileRef.current.value = "";

    setIsUploading(true);
    setUploadHint(null);
    setError(null);

    const notes: string[] = [];

    try {
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/upload", { method: "POST", body });
        const data = (await response.json()) as {
          error?: string;
          file?: string;
          chunks?: IndexRecord[];
          emptyPages?: number[];
        };

        if (!response.ok) {
          throw new Error(data.error || `Upload failed for ${file.name}.`);
        }

        const name = data.file ?? file.name;
        const chunks = data.chunks ?? [];

        setUserChunks((current) => [
          ...current.filter((chunk) => chunk.file !== name),
          ...chunks,
        ]);
        setUploadedFiles((current) => [
          ...current.filter((item) => item.name !== name),
          { name, chunkCount: chunks.length },
        ]);

        notes.push(
          data.emptyPages?.length
            ? `${name}: ${chunks.length} chunks (skipped scanned pages ${data.emptyPages.join(", ")})`
            : `${name}: ${chunks.length} chunks`,
        );
      }
      setUploadHint(notes.join(" · "));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  function removeUpload(name: string) {
    setUploadedFiles((current) => current.filter((item) => item.name !== name));
    setUserChunks((current) => current.filter((chunk) => chunk.file !== name));
  }

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Your PDFs
          </p>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs text-zinc-500 md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            Close
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(event) => onUpload(event.target.files)}
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileRef.current?.click()}
          className="mt-3 w-full rounded-xl bg-zinc-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {isUploading ? "Indexing PDF…" : "Upload PDF"}
        </button>
        {uploadHint && (
          <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{uploadHint}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ul className="space-y-2">
          {uploadedFiles.length === 0 && (
            <li className="text-sm text-zinc-500">No personal PDFs yet.</li>
          )}
          {uploadedFiles.map((file) => (
            <li
              key={file.name}
              className="flex items-start justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-zinc-500">{file.chunkCount} chunks</p>
              </div>
              <button
                type="button"
                onClick={() => removeUpload(file.name)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Library
        </p>
        <ul className="mt-3 space-y-2">
          {library.length === 0 && (
            <li className="text-sm leading-6 text-zinc-500">
              No pre-loaded documents yet. Add PDFs to <code>data/pdfs</code> and run{" "}
              <code>npm run ingest</code>.
            </li>
          )}
          {library.map((doc) => (
            <li
              key={doc.file}
              className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/70"
            >
              <p className="truncate text-sm font-medium" title={doc.file}>
                {doc.file}
              </p>
              <p className="text-xs text-zinc-500">
                {doc.pages ? `${doc.pages} pages · ` : ""}
                {doc.chunks} chunks
                {uploadedNames.has(doc.file) ? " · also uploaded" : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-[min(20rem,88vw)] border-r border-zinc-200 bg-white transition-transform dark:border-zinc-800 dark:bg-zinc-950 md:static md:z-0 md:flex md:w-80 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <button
            type="button"
            className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm md:hidden dark:border-zinc-700"
            onClick={() => setSidebarOpen(true)}
          >
            Menu
          </button>
          <div>
            <h1 className="text-base font-semibold tracking-tight">Engineering Doubt Solver</h1>
            <p className="text-xs text-zinc-500">RAG tutor for engineering questions</p>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-3 py-5 sm:px-4 sm:py-6">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900 sm:px-6 sm:py-12">
                  <p className="text-lg font-medium">Ask an engineering doubt</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Answers use your uploaded PDFs plus the pre-loaded library, with citations.
                  </p>
                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                    {EXAMPLES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        disabled={isStreaming}
                        onClick={() => void sendMessage(undefined, example)}
                        className="rounded-full border border-zinc-200 px-3 py-2 text-left text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:text-center"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 shadow-sm ${
                    message.role === "user"
                      ? "ml-auto bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : `mr-auto w-full border bg-white dark:bg-zinc-900 ${
                          message.error
                            ? "border-red-300 dark:border-red-800"
                            : "border-zinc-200 dark:border-zinc-800"
                        }`
                  }`}
                >
                  {message.role === "user" ? (
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  ) : (
                    <>
                      {message.content ? (
                        <MarkdownBody content={message.content} />
                      ) : (
                        <TypingIndicator />
                      )}
                      {message.sources && <SourcesPanel sources={message.sources} />}
                      {!isStreaming && !message.sources && message.content && !message.error && (
                        <SourcesPanel sources={[]} />
                      )}
                    </>
                  )}
                </article>
              ))}

              <div ref={bottomRef} />
            </div>
          </div>

          <form
            onSubmit={sendMessage}
            className="border-t border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-4"
          >
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
              <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
                <textarea
                  ref={textareaRef}
                  value={input}
                  rows={1}
                  placeholder="Ask about circuits, thermo, strength of materials…"
                  className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isStreaming || isUploading || !input.trim()}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {isStreaming ? "…" : "Send"}
                </button>
              </div>
              <p className="text-xs text-zinc-400">Enter to send · Shift+Enter for a new line</p>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
