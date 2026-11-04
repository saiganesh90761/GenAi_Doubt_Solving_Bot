"use client";

import React from "react";
import { useAuth } from "./AuthContext";
import type { DocumentRecord } from "@/lib/documents";
import type { Conversation } from "@/lib/conversations";

interface StudentDashboardProps {
  documents: DocumentRecord[];
  conversations: Conversation[];
  bookmarkedCount: number;
  onOpenChat: (convId?: string) => void;
  onOpenDocuments: () => void;
  onOpenBookmarks: () => void;
  onUploadClick: () => void;
}

export function StudentDashboard({
  documents,
  conversations,
  bookmarkedCount,
  onOpenChat,
  onOpenDocuments,
  onOpenBookmarks,
  onUploadClick,
}: StudentDashboardProps) {
  const { user, openAuth } = useAuth();

  const totalQuestions = conversations.reduce(
    (acc, c) => acc + (c.messages ? c.messages.filter((m) => m.role === "user").length : 0),
    0,
  );

  const readyDocs = documents.filter((d) => d.status === "ready");
  const recentDocs = documents.slice(0, 4);
  const recentConvs = conversations.slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 max-w-6xl mx-auto w-full space-y-8 animate-in fade-in duration-150">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-zinc-900 to-zinc-900 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400 mb-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{user?.major || "Engineering Student"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Welcome back, {user ? user.name : "Engineering Student"}
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-zinc-400 max-w-xl">
              {readyDocs.length > 0
                ? `Your RAG knowledge base is active with ${readyDocs.length} indexed document(s). Ready to solve derivations and concepts.`
                : "Upload your engineering notes or textbooks to activate grounded RAG doubt solving with zero hallucinations."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenChat()}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span>Ask a Doubt</span>
            </button>

            <button
              onClick={onUploadClick}
              className="rounded-xl border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 px-4 py-2.5 text-xs font-semibold text-zinc-200 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Upload PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5">
          <p className="text-xs font-medium text-zinc-400">Questions Solved</p>
          <p className="mt-2 text-2xl font-bold text-white">{totalQuestions}</p>
          <p className="mt-1 text-[11px] text-zinc-500">Across all sessions</p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5">
          <p className="text-xs font-medium text-zinc-400">Indexed In Qdrant</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{readyDocs.length}</span>
            <span className="text-xs text-zinc-500">documents</span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-400">Grounded semantic search</p>
        </div>

        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5">
          <p className="text-xs font-medium text-zinc-400">Study Sessions</p>
          <p className="mt-2 text-2xl font-bold text-white">{conversations.length}</p>
          <p className="mt-1 text-[11px] text-zinc-500">Persisted in cloud</p>
        </div>

        <div
          onClick={onOpenBookmarks}
          className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 sm:p-5 cursor-pointer hover:border-indigo-500/50 transition group"
        >
          <p className="text-xs font-medium text-zinc-400 group-hover:text-indigo-400 transition">Saved Derivations</p>
          <p className="mt-2 text-2xl font-bold text-white">{bookmarkedCount}</p>
          <p className="mt-1 text-[11px] text-indigo-400 flex items-center gap-1">
            <span>View bookmarks</span>
            <span>→</span>
          </p>
        </div>
      </div>

      {/* Two Column Layout: Recent Documents & Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Uploaded Documents Box */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base text-indigo-400">📚</span>
              <h2 className="text-sm font-bold text-white">My Academic Documents</h2>
            </div>
            <button
              onClick={onOpenDocuments}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition"
            >
              View All ({documents.length}) →
            </button>
          </div>

          {recentDocs.length === 0 ? (
            <div
              onClick={onUploadClick}
              className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center cursor-pointer hover:border-indigo-500/50 transition"
            >
              <p className="text-xs text-zinc-300 font-medium">No documents uploaded yet</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Upload your lecture notes, formula sheets, or textbook PDFs to activate RAG.
              </p>
              <button
                type="button"
                className="mt-3 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 text-xs font-medium"
              >
                + Upload First PDF
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/80 p-3 hover:border-zinc-700 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">📄</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-zinc-100 truncate">{doc.name}</p>
                      <p className="text-[11px] text-zinc-500">
                        {doc.pageCount || 1} pages • {doc.chunkCount || 0} vectors
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      doc.status === "ready"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : doc.status === "error"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {doc.status === "ready" ? "Indexed" : doc.status === "error" ? "Failed" : "Processing"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Doubt Sessions Box */}
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base text-indigo-400">💬</span>
              <h2 className="text-sm font-bold text-white">Recent Study Sessions</h2>
            </div>
            <button
              onClick={() => onOpenChat()}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition"
            >
              Open Tutor Chat →
            </button>
          </div>

          {recentConvs.length === 0 ? (
            <div
              onClick={() => onOpenChat()}
              className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center cursor-pointer hover:border-indigo-500/50 transition"
            >
              <p className="text-xs text-zinc-300 font-medium">No previous doubt sessions</p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Start a session to solve circuit laws, thermodynamics derivations, or mechanics formulas.
              </p>
              <button
                type="button"
                className="mt-3 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 text-xs font-medium"
              >
                Start First Session
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentConvs.map((conv) => {
                const lastMsg = conv.messages && conv.messages[conv.messages.length - 1];
                return (
                  <div
                    key={conv.id}
                    onClick={() => onOpenChat(conv.id)}
                    className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/80 p-3 hover:border-indigo-500/40 cursor-pointer transition"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-xs font-semibold text-zinc-100 truncate">{conv.title}</p>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {lastMsg?.content ? lastMsg.content.slice(0, 60) + "…" : "Empty conversation"}
                      </p>
                    </div>
                    <span className="text-xs text-zinc-400 font-mono">→</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Guest Notice */}
      {!user && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div>
            <span className="font-semibold">You are currently using guest mode.</span>
            <span className="text-amber-300/80 ml-1">
              Create a free student account to sync your uploaded PDFs, derivations, and study history across devices.
            </span>
          </div>
          <button
            onClick={() => openAuth("register")}
            className="rounded-lg bg-amber-500 text-zinc-950 font-semibold px-3 py-1.5 text-xs hover:bg-amber-400 transition"
          >
            Create Account
          </button>
        </div>
      )}
    </div>
  );
}
