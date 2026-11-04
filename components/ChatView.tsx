"use client";

import React, { useState, useRef, useEffect } from "react";
import { MarkdownBody } from "./MarkdownBody";
import { SourcesPanel } from "./SourcesPanel";
import { useToast } from "./Toast";
import type { ChatSource } from "@/lib/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: ChatSource[];
  error?: boolean;
}

export interface ConversationSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

interface ChatViewProps {
  sessionId: string;
  onRefreshLibrary: () => Promise<void>;
}

const SUGGESTED_QUESTIONS = [
  "Explain Kirchhoff's Voltage Law with a small circuit example.",
  "Derive the Carnot efficiency formula from the First & Second Laws of Thermodynamics.",
  "State Bernoulli's equation for fluid flow and explain each head term.",
  "How does a MOSFET channel form under gate-to-source bias voltage?",
  "What is the continuity equation in fluid mechanics and when is it valid?",
];

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Math.random().toString(36).slice(2, 6)}`;
}

function getInitialConversations(): {
  conversations: ConversationSession[];
  activeId: string;
  messages: ChatMessage[];
} {
  if (typeof window === "undefined") {
    const fallbackId = "conv_default";
    const initial: ConversationSession = {
      id: fallbackId,
      title: "New Conversation",
      updatedAt: 0,
      messages: [],
    };
    return { conversations: [initial], activeId: fallbackId, messages: [] };
  }

  try {
    const raw = localStorage.getItem("engineering_tutor_conversations");
    if (raw) {
      const parsed = JSON.parse(raw) as ConversationSession[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          conversations: parsed,
          activeId: parsed[0].id,
          messages: parsed[0].messages || [],
        };
      }
    }
  } catch {
    // ignore
  }

  const defaultId = generateId("conv");
  const defaultConv: ConversationSession = {
    id: defaultId,
    title: "New Conversation",
    updatedAt: 0,
    messages: [],
  };
  return { conversations: [defaultConv], activeId: defaultId, messages: [] };
}

export function ChatView({ sessionId, onRefreshLibrary }: ChatViewProps) {
  const { showToast } = useToast();

  const [initialData] = useState(getInitialConversations);
  const [conversations, setConversations] = useState<ConversationSession[]>(initialData.conversations);
  const [activeConvId, setActiveConvId] = useState<string>(initialData.activeId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialData.messages);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [searchScope, setSearchScope] = useState<"all" | "global" | "private">("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("All");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Sync active conversation messages into localStorage without triggering cascading render
  const persistConversations = (updatedConv: ConversationSession[]) => {
    setConversations(updatedConv);
    try {
      localStorage.setItem("engineering_tutor_conversations", JSON.stringify(updatedConv));
    } catch {
      // ignore
    }
  };

  const handleNewChat = () => {
    const newId = generateId("conv");
    const newConv: ConversationSession = {
      id: newId,
      title: "New Conversation",
      updatedAt: 0,
      messages: [],
    };
    const updated = [newConv, ...conversations];
    persistConversations(updated);
    setActiveConvId(newId);
    setMessages([]);
    setInput("");
    showToast("Started a new conversation", "info");
    textareaRef.current?.focus();
  };

  const handleSelectConv = (convId: string) => {
    if (convId === activeConvId) return;
    const target = conversations.find((c) => c.id === convId);
    if (target) {
      setActiveConvId(target.id);
      setMessages(target.messages || []);
      setInput("");
    }
  };

  const handleDeleteConv = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = conversations.filter((c) => c.id !== convId);
    if (remaining.length === 0) {
      handleNewChat();
      return;
    }
    persistConversations(remaining);
    if (activeConvId === convId) {
      setActiveConvId(remaining[0].id);
      setMessages(remaining[0].messages || []);
    }
    showToast("Deleted conversation", "info");
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (fileInputRef.current) fileInputRef.current.value = "";

    setIsUploading(true);
    setUploadProgress(`Uploading and indexing "${file.name}"...`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scope", "private");
      formData.append("subject", selectedSubject !== "All" ? selectedSubject : "General Engineering");
      if (sessionId) {
        formData.append("sessionId", sessionId);
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Upload failed for ${file.name}`);
      }

      showToast(`Attached & indexed "${file.name}" (${data.chunkCount || 0} chunks).`, "success");
      await onRefreshLibrary();
      setInput(`Summarize the key engineering formulas and concepts from ${file.name}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Attachment upload failed";
      showToast(msg, "error");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleSend = async (overridePrompt?: string) => {
    const questionText = (overridePrompt ?? input).trim();
    if (!questionText || isStreaming) return;

    setInput("");

    const userMessageId = generateId("msg_user");
    const assistantMessageId = generateId("msg_asst");

    const newMessages: ChatMessage[] = [
      ...messages,
      { id: userMessageId, role: "user", content: questionText },
      { id: assistantMessageId, role: "assistant", content: "" },
    ];

    setMessages(newMessages);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages
            .slice(0, -1)
            .map(({ role, content }) => ({ role, content })),
          sessionId: sessionId || undefined,
          scope: searchScope,
          subject: selectedSubject !== "All" ? selectedSubject : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Request failed with status ${res.status}`);
      }

      const headerSources = res.headers.get("X-Rag-Sources");
      if (headerSources) {
        try {
          const sources = JSON.parse(decodeURIComponent(headerSources)) as ChatSource[];
          setMessages((curr) =>
            curr.map((m) => (m.id === assistantMessageId ? { ...m, sources } : m)),
          );
        } catch {
          // ignore
        }
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream available");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";
      const sourcesBox = { list: [] as ChatSource[] };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          const trimmed = event.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6);

          try {
            const parsed = JSON.parse(jsonStr) as {
              type: string;
              sources?: ChatSource[];
              text?: string;
              message?: string;
            };

            if (parsed.type === "sources" && Array.isArray(parsed.sources)) {
              const incoming = [...parsed.sources];
              sourcesBox.list = incoming;
              setMessages((curr) =>
                curr.map((m) =>
                  m.id === assistantMessageId ? { ...m, sources: incoming } : m,
                ),
              );
            }

            if (parsed.type === "delta" && typeof parsed.text === "string") {
              accumulatedContent += parsed.text;
              const currentText = accumulatedContent;
              setMessages((curr) =>
                curr.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, content: currentText }
                    : m,
                ),
              );
            }

            if (parsed.type === "error" && typeof parsed.message === "string") {
              const err = parsed.message;
              setMessages((curr) =>
                curr.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, error: true, content: m.content || err }
                    : m,
                ),
              );
            }
          } catch {
            // ignore non-json SSE lines
          }
        }
      }

      // Persist conversation updates
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === activeConvId);
        if (idx === -1) return prev;
        const conv = prev[idx];
        let title = conv.title;
        if (title === "New Conversation") {
          title = questionText.slice(0, 36).trim() + (questionText.length > 36 ? "…" : "");
        }
        const updated = [...prev];
        updated[idx] = {
          ...conv,
          title,
          updatedAt: 0,
          messages: [
            ...messages,
            { id: userMessageId, role: "user", content: questionText },
            { id: assistantMessageId, role: "assistant", content: accumulatedContent, sources: sourcesBox.list },
          ],
        };
        try {
          localStorage.setItem("engineering_tutor_conversations", JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error receiving tutor answer";
      showToast(msg, "error");
      setMessages((curr) =>
        curr.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                error: true,
                content: m.content || `⚠️ ${msg}`,
              }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  };

  const handleCopyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied answer to clipboard", "success");
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-3.5rem)]">
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
        />
      )}

      {/* Conversations History Sidebar */}
      <aside
        className={`fixed inset-y-14 left-0 z-30 w-72 border-r border-zinc-200 bg-zinc-50 p-4 transition-transform dark:border-zinc-800 dark:bg-zinc-950 md:static md:z-0 md:translate-x-0 flex flex-col justify-between ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex flex-col min-h-0 flex-1">
          <button
            onClick={handleNewChat}
            className="flex items-center justify-between w-full rounded-xl bg-zinc-900 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs mb-4"
          >
            <span className="flex items-center gap-2">
              <span>+</span>
              <span>New Conversation</span>
            </span>
            <span className="rounded bg-zinc-700/60 dark:bg-zinc-300 px-1.5 py-0.5 text-[10px] font-mono">
              ⌘N
            </span>
          </button>

          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 px-1">
            <span>Recent Chats</span>
            <span>{conversations.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {conversations.map((conv) => {
              const active = conv.id === activeConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConv(conv.id)}
                  className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                    active
                      ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/80 dark:bg-zinc-900 dark:text-zinc-50 dark:border-zinc-800"
                      : "text-zinc-600 hover:bg-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-900/60"
                  }`}
                >
                  <span className="truncate flex-1">💬 {conv.title}</span>
                  <button
                    onClick={(e) => handleDeleteConv(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-500 text-[11px] px-1 py-0.5 rounded transition-opacity"
                    title="Delete chat"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-400 space-y-1">
          <p className="flex items-center justify-between">
            <span>Model:</span>
            <span className="font-mono text-zinc-600 dark:text-zinc-300">Nemotron 3 Ultra</span>
          </p>
          <p className="flex items-center justify-between">
            <span>Vector Engine:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Qdrant Cloud ✓</span>
          </p>
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <div className="flex flex-1 flex-col min-w-0 bg-white dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800/80 dark:bg-zinc-900/30 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              ☰
            </button>

            <div className="flex items-center gap-1.5">
              <span className="font-medium text-zinc-500">Scope:</span>
              <select
                value={searchScope}
                onChange={(e) => setSearchScope(e.target.value as "all" | "global" | "private")}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 outline-none"
              >
                <option value="all">🌐 All Library & Notes</option>
                <option value="global">🏛️ Global Textbooks Only</option>
                <option value="private">🔒 My Private Uploads Only</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-medium text-zinc-500">Subject:</span>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 outline-none"
              >
                <option value="All">All Subjects</option>
                <option value="Electrical Engineering">Electrical Engineering</option>
                <option value="Mechanical Engineering">Mechanical Engineering</option>
                <option value="Computer Science">Computer Science & IT</option>
                <option value="Civil Engineering">Civil Engineering</option>
                <option value="Chemical Engineering">Chemical Engineering</option>
                <option value="General Engineering">General Mathematics & Physics</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {uploadProgress && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium animate-pulse">
                ⏳ {uploadProgress}
              </span>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              <span>📎</span>
              <span>{isUploading ? "Indexing PDF…" : "Attach PDF"}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handleAttachmentUpload}
            />
          </div>
        </div>

        {/* Message Feed Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 p-8 sm:p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white text-xl shadow-md shadow-sky-500/20 mb-4">
                  <span>📐</span>
                </div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  Engineering Doubt Solver
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
                  Ask quantitative engineering problems, theoretical concepts, or circuit derivations.
                  Answers are grounded in academic textbooks with LaTeX formatting.
                </p>

                <div className="mt-6 flex flex-col gap-2 text-left sm:grid sm:grid-cols-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void handleSend(q)}
                      className="rounded-2xl border border-zinc-200/80 bg-white p-3 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80 transition-all text-left shadow-xs"
                    >
                      <span>💡 {q}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"} animate-in fade-in duration-200`}
                  >
                    <div
                      className={`max-w-[min(100%,44rem)] rounded-2xl px-4 py-3.5 shadow-xs ${
                        isUser
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : `w-full border bg-white dark:bg-zinc-900/70 ${
                              message.error
                                ? "border-rose-300 dark:border-rose-800/80"
                                : "border-zinc-200/80 dark:border-zinc-800"
                            }`
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                      ) : (
                        <div>
                          {message.content ? (
                            <>
                              <MarkdownBody content={message.content} />
                              <div className="mt-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/80 pt-2 text-[11px] text-zinc-400">
                                <span>Academic Tutor Response</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyMessage(message.content)}
                                  className="flex items-center gap-1 hover:text-zinc-600 dark:hover:text-zinc-200"
                                >
                                  <span>📋</span> Copy Answer
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 py-2 text-xs text-zinc-500">
                              <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-ping" />
                              <span>Searching Qdrant & solving step-by-step...</span>
                            </div>
                          )}

                          {message.sources && <SourcesPanel sources={message.sources} />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input Dock */}
        <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="mx-auto max-w-3xl flex flex-col gap-2"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/60 focus-within:border-sky-500 dark:focus-within:border-sky-500 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                placeholder="Ask about circuit laws, heat transfer, structural stress, derivations..."
                className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-1.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 outline-none leading-relaxed"
              />

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isStreaming}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 dark:text-zinc-400 transition-colors"
                  title="Attach course PDF notes"
                >
                  📎
                </button>

                <button
                  type="submit"
                  disabled={isStreaming || !input.trim()}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-zinc-900 px-4 text-xs font-semibold text-white disabled:opacity-40 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs"
                >
                  {isStreaming ? (
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" />
                      Solving…
                    </span>
                  ) : (
                    <span>Ask Tutor →</span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
              <span>Press <b>Enter</b> to send · <b>Shift+Enter</b> for new line</span>
              <span>Grounded in academic library</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
