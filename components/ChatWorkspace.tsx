"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./Toast";
import { MarkdownBody } from "./MarkdownBody";
import { SourcesPanel } from "./SourcesPanel";
import type { ChatSource } from "@/lib/types";
import type { DocumentRecord } from "@/lib/documents";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

interface ChatWorkspaceProps {
  onBackToHome: () => void;
}

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const EXAMPLE_PROMPTS = [
  "Explain Kirchhoff’s voltage and current laws with a small circuit example.",
  "Derive the bending stress formula for a simply supported beam.",
  "Summarize the key engineering formulas and concepts from my uploaded notes.",
];

export function ChatWorkspace({ onBackToHome }: ChatWorkspaceProps) {
  const { user, token, logout, openAuth } = useAuth();
  const { showToast } = useToast();

  const userId = user ? user.id : "guest_user";

  // Sidebar & Layout State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Input & Streaming State
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Load User Documents from Backend
  const refreshDocuments = useCallback(async () => {
    try {
      const url = `/api/library?sessionId=${encodeURIComponent(userId)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      // ignore
    }
  }, [userId]);

  // Create New Conversation
  const handleNewChat = useCallback(() => {
    const newId = generateId("conv");
    const newConv: Conversation = {
      id: newId,
      title: "New Doubt Session",
      messages: [],
      updatedAt: Date.now(),
    };
    setActiveConvId(newId);
    setMessages([]);
    setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newId)]);
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  // Initial Data Load
  useEffect(() => {
    let ignore = false;
    const loadAll = async () => {
      try {
        const docUrl = `/api/library?sessionId=${encodeURIComponent(userId)}`;
        const docRes = await fetch(docUrl);
        if (docRes.ok && !ignore) {
          const docData = await docRes.json();
          setDocuments(docData.documents || []);
        }

        const convRes = await fetch(`/api/conversations?userId=${encodeURIComponent(userId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (convRes.ok && !ignore) {
          const convData = await convRes.json();
          const list = (convData.conversations || []) as Conversation[];
          setConversations(list);
          if (list.length > 0) {
            setActiveConvId(list[0].id);
            setMessages(list[0].messages || []);
          } else {
            handleNewChat();
          }
        }
      } catch {
        // ignore
      }
    };
    void loadAll();
    return () => {
      ignore = true;
    };
  }, [userId, token, handleNewChat]);

  // Switch Conversation
  const handleSelectConv = (conv: Conversation) => {
    setActiveConvId(conv.id);
    setMessages(conv.messages || []);
    setSidebarOpen(false);
  };

  // Delete Conversation
  const handleDeleteConv = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/conversations?id=${encodeURIComponent(convId)}&userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // ignore
    }

    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== convId);
      if (activeConvId === convId) {
        if (next.length > 0) {
          setActiveConvId(next[0].id);
          setMessages(next[0].messages || []);
        } else {
          handleNewChat();
        }
      }
      return next;
    });
    showToast("Session deleted", "info");
  };

  // Delete Document from Qdrant & Storage
  const handleDeleteDocument = async (docId: string, name: string) => {
    if (!confirm(`Delete "${name}" from your Qdrant knowledge base?`)) return;

    try {
      const res = await fetch(`/api/library/${docId}`, {
        method: "DELETE",
        headers: { "x-session-id": userId },
      });
      if (!res.ok) throw new Error("Failed to delete document");
      showToast(`Deleted ${name} from Qdrant`, "success");
      await refreshDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      showToast(msg, "error");
    }
  };

  // Upload PDF & Index into Qdrant
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsUploading(true);
    setUploadProgress(`Extracting and indexing ${file.name} into Qdrant Cloud...`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sessionId", userId);
      formData.append("userId", userId);
      formData.append("scope", "private");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Upload failed for ${file.name}`);
      }

      showToast(`Indexed "${file.name}" (${data.chunkCount || 0} chunks) into Qdrant Cloud!`, "success");
      await refreshDocuments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      showToast(msg, "error");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Send Doubt Question
  const handleSend = async (overridePrompt?: string) => {
    const questionText = (overridePrompt ?? input).trim();
    if (!questionText || isStreaming) return;

    setInput("");
    const userMessageId = generateId("msg_u");
    const assistantMessageId = generateId("msg_a");

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
          messages: newMessages.slice(0, -1).map(({ role, content }) => ({ role, content })),
          sessionId: userId,
          scope: "all",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Request failed with status ${res.status}`);
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
                  m.id === assistantMessageId ? { ...m, content: currentText } : m,
                ),
              );
            }

            if (parsed.type === "error" && typeof parsed.message === "string") {
              const err = parsed.message;
              setMessages((curr) =>
                curr.map((m) =>
                  m.id === assistantMessageId ? { ...m, error: true, content: m.content || err } : m,
                ),
              );
            }
          } catch {
            // ignore non-json SSE lines
          }
        }
      }

      // Persist Conversation Updates to Backend & LocalStorage
      const updatedMessages: ChatMessage[] = [
        ...messages,
        { id: userMessageId, role: "user", content: questionText },
        { id: assistantMessageId, role: "assistant", content: accumulatedContent, sources: sourcesBox.list },
      ];

      let currentTitle = "New Doubt Session";
      const existingConv = conversations.find((c) => c.id === activeConvId);
      if (existingConv && existingConv.title !== "New Doubt Session") {
        currentTitle = existingConv.title;
      } else {
        currentTitle = questionText.slice(0, 36).trim() + (questionText.length > 36 ? "…" : "");
      }

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === activeConvId);
        const updated = [...prev];
        const newRecord: Conversation = {
          id: activeConvId,
          title: currentTitle,
          messages: updatedMessages,
          updatedAt: 0,
        };
        if (idx >= 0) {
          updated[idx] = newRecord;
        } else {
          updated.unshift(newRecord);
        }
        return updated;
      });

      // Background persist to server
      void fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          id: activeConvId,
          title: currentTitle,
          messages: updatedMessages,
          userId,
        }),
      }).catch(() => null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error receiving tutor answer";
      showToast(msg, "error");
      setMessages((curr) =>
        curr.map((m) =>
          m.id === assistantMessageId ? { ...m, error: true, content: m.content || `⚠️ ${msg}` } : m,
        ),
      );
    } finally {
      setIsStreaming(false);
      textareaRef.current?.focus();
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Hidden File Input for PDF uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleUploadFile}
      />

      {/* Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 sm:w-80 border-r border-zinc-800/80 bg-zinc-900/95 backdrop-blur flex flex-col transition-transform duration-200 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
          <button
            onClick={onBackToHome}
            className="flex items-center gap-2.5 text-left group hover:opacity-90 transition"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20">
              EDS
            </div>
            <div>
              <p className="text-xs font-bold text-white leading-none">Engineering Tutor</p>
              <p className="text-[10px] text-zinc-400 group-hover:text-indigo-400 transition mt-0.5">← Back to Home</p>
            </div>
          </button>

          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* Action Button: New Session */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 px-3 text-xs font-semibold text-white shadow-sm transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Doubt Session</span>
          </button>
        </div>

        {/* Middle Scrollable Section: Documents & Sessions */}
        <div className="flex-1 overflow-y-auto px-3 space-y-6 py-2">
          {/* Section: Uploaded Knowledge Base (PDFs in Qdrant) */}
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                My PDFs ({documents.length})
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition"
              >
                <span>+ Upload PDF</span>
              </button>
            </div>

            {isUploading && (
              <div className="mb-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-2.5 text-xs text-indigo-300 flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                <span className="truncate">{uploadProgress}</span>
              </div>
            )}

            {documents.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-4 text-center hover:border-zinc-700 transition"
              >
                <p className="text-xs text-zinc-400">No PDFs uploaded yet.</p>
                <p className="text-[10px] text-zinc-500 mt-1">Click to upload lecture notes or textbook chapters to activate RAG.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="group flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2.5 hover:border-zinc-700 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base text-indigo-400">📄</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{doc.name}</p>
                        <p className="text-[10px] text-zinc-500">
                          {doc.pageCount || 1} pages • {doc.chunkCount || 0} vectors in Qdrant
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id, doc.name)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition"
                      title="Delete from Qdrant"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Chat Sessions */}
          <div>
            <div className="px-1 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Recent Sessions
              </span>
            </div>

            <div className="space-y-1">
              {conversations.map((conv) => {
                const isActive = conv.id === activeConvId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConv(conv)}
                    className={`group flex items-center justify-between rounded-xl px-3 py-2 text-xs cursor-pointer transition ${
                      isActive
                        ? "bg-zinc-800 text-white font-medium"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                    }`}
                  >
                    <span className="truncate pr-2">{conv.title}</span>
                    <button
                      onClick={(e) => void handleDeleteConv(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-red-400 transition"
                      title="Delete chat"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Footer: User Profile */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between">
          {user ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600/30 text-indigo-300 font-bold text-xs border border-indigo-500/20">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-zinc-400 truncate font-mono">{user.email}</p>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">Guest Student</p>
              <button
                onClick={() => openAuth("login")}
                className="text-[10px] text-indigo-400 hover:underline"
              >
                Sign in to sync across devices
              </button>
            </div>
          )}

          {user && (
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition"
              title="Sign Out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Top Header */}
        <header className="h-14 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur px-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-sm font-semibold text-white truncate">
              {conversations.find((c) => c.id === activeConvId)?.title || "Doubt Solver Workspace"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>{documents.length} PDF{documents.length === 1 ? "" : "s"} in Qdrant</span>
            </span>
          </div>
        </header>

        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6 max-w-4xl mx-auto w-full">
          {messages.length === 0 ? (
            <div className="py-12 sm:py-20 text-center space-y-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">Ask Any Engineering Doubt</h3>
                <p className="mt-2 text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
                  {documents.length > 0
                    ? `RAG is active across your ${documents.length} uploaded PDF(s). Ask for step-by-step proofs, formulas, or conceptual explanations.`
                    : "Upload your engineering PDF notes using the sidebar or paperclip icon, then ask any doubt for grounded derivations."}
                </p>
              </div>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto text-left">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition"
                  >
                    &ldquo;{prompt}&rdquo;
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
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                      AI
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-4 py-3 max-w-[85%] sm:max-w-[75%] ${
                      isUser
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "border border-zinc-800 bg-zinc-900/80 text-zinc-100 shadow-sm"
                    }`}
                  >
                    {isUser ? (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    ) : (
                      <div className="space-y-3">
                        {message.content ? (
                          <MarkdownBody content={message.content} />
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-zinc-400 py-1">
                            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                            <span>Retrieving vectors from Qdrant Cloud and writing step-by-step derivation…</span>
                          </div>
                        )}

                        {message.sources && message.sources.length > 0 && (
                          <div className="pt-2 border-t border-zinc-800/80">
                            <SourcesPanel sources={message.sources} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Area */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800/80 max-w-4xl mx-auto w-full">
          <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/90 p-2 focus-within:border-indigo-500 transition shadow-lg">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={
                documents.length > 0
                  ? "Ask about circuits, thermodynamics, mechanics formulas…"
                  : "Ask a doubt or upload a PDF to get started…"
              }
              className="w-full resize-none bg-transparent px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none max-h-36"
            />

            <div className="flex items-center justify-between pt-1 px-1">
              {/* PDF Upload Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition"
                title="Attach Engineering PDF"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span>Attach PDF</span>
              </button>

              {/* Send Button */}
              <button
                onClick={() => handleSend()}
                disabled={isStreaming || !input.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40 disabled:hover:bg-indigo-600 shadow-sm"
              >
                {isStreaming ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-zinc-500">
            Enter to send • Shift + Enter for a new line • Answers verified via Qdrant Cloud RAG
          </p>
        </div>
      </main>
    </div>
  );
}
