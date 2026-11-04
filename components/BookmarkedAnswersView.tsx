"use client";

import React, { useState } from "react";
import { MarkdownBody } from "./MarkdownBody";
import { SourcesPanel } from "./SourcesPanel";
import { useToast } from "./Toast";
import type { ChatSource } from "@/lib/types";

export interface BookmarkedAnswer {
  id: string;
  userId: string;
  conversationId?: string;
  question: string;
  answer: string;
  sources?: ChatSource[];
  createdAt: number;
}

interface BookmarkedAnswersViewProps {
  bookmarks: BookmarkedAnswer[];
  onRemoveBookmark: (id: string) => void;
  onOpenChat: (convId?: string) => void;
}

export function BookmarkedAnswersView({
  bookmarks,
  onRemoveBookmark,
  onOpenChat,
}: BookmarkedAnswersViewProps) {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");

  const filtered = bookmarks.filter(
    (b) =>
      b.question.toLowerCase().includes(search.toLowerCase()) ||
      b.answer.toLowerCase().includes(search.toLowerCase()),
  );

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    showToast("Answer copied to clipboard!", "success");
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 max-w-5xl mx-auto w-full space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Saved Derivations & Formulas</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Your personal engineering formula and concept archive. Review saved proofs, circuit analysis, and practice problems.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search saved derivations…"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 pl-9 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Bookmarks List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 mb-3">
            ⭐
          </div>
          <p className="text-sm font-semibold text-white">No saved derivations yet</p>
          <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
            {search
              ? `No saved answers match "${search}".`
              : "When you ask a doubt, click the ⭐ icon under the tutor's answer to bookmark formulas, theorems, and derivations here."}
          </p>
          <button
            onClick={() => onOpenChat()}
            className="mt-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition"
          >
            Start a Doubt Session
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 shadow-md space-y-4"
            >
              {/* Question Bar */}
              <div className="flex items-start justify-between gap-3 border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base text-indigo-400">❓</span>
                  <h3 className="text-sm font-bold text-white truncate">{item.question}</h3>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleCopy(item.answer)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                    title="Copy Answer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>

                  {item.conversationId && (
                    <button
                      onClick={() => onOpenChat(item.conversationId)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition"
                      title="Open in Chat"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  )}

                  <button
                    onClick={() => onRemoveBookmark(item.id)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition"
                    title="Remove Bookmark"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Rendered Answer with KaTeX */}
              <div className="text-zinc-200">
                <MarkdownBody content={item.answer} />
              </div>

              {/* Source References */}
              {item.sources && item.sources.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/80">
                  <SourcesPanel sources={item.sources} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
