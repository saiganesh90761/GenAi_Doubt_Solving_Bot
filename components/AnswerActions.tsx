"use client";

import React, { useState } from "react";
import { useToast } from "./Toast";
import type { ChatSource } from "@/lib/types";

interface AnswerActionsProps {
  questionText: string;
  answerText: string;
  sources?: ChatSource[];
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onRegenerate?: () => void;
  onAppendToolOutput: (toolName: string, output: string) => void;
}

export function AnswerActions({
  questionText,
  answerText,
  isBookmarked,
  onToggleBookmark,
  onRegenerate,
  onAppendToolOutput,
}: AnswerActionsProps) {
  const { showToast } = useToast();
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(answerText);
    setCopied(true);
    showToast("Answer copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStudyTool = async (
    action: "simplify" | "derive" | "example" | "summary" | "flashcards" | "mcqs",
    label: string,
  ) => {
    if (activeTool) return;
    setActiveTool(action);

    try {
      const res = await fetch("/api/study-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          topic: questionText,
          answerContent: answerText,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to contact study assistant");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.text) {
              accumulated += parsed.text;
            }
          } catch {
            // ignore
          }
        }
      }

      if (accumulated.trim()) {
        onAppendToolOutput(label, accumulated);
        showToast(`${label} generated successfully!`, "success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Study tool error";
      showToast(msg, "error");
    } finally {
      setActiveTool(null);
    }
  };

  return (
    <div className="pt-2 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* Learning & Productivity Action Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => handleStudyTool("simplify", "Simplified Analogy")}
          disabled={Boolean(activeTool)}
          className="rounded-lg border border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:text-white transition disabled:opacity-40 flex items-center gap-1"
          title="Explain this answer in simpler language"
        >
          <span>💡</span>
          <span>{activeTool === "simplify" ? "Generating…" : "Explain Simply"}</span>
        </button>

        <button
          onClick={() => handleStudyTool("derive", "Step-by-Step Derivation")}
          disabled={Boolean(activeTool)}
          className="rounded-lg border border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:text-white transition disabled:opacity-40 flex items-center gap-1"
          title="Full mathematical step-by-step derivation"
        >
          <span>📐</span>
          <span>{activeTool === "derive" ? "Deriving…" : "Derivation Steps"}</span>
        </button>

        <button
          onClick={() => handleStudyTool("example", "Practical Engineering Example")}
          disabled={Boolean(activeTool)}
          className="rounded-lg border border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:text-white transition disabled:opacity-40 flex items-center gap-1"
          title="Real-world engineering system example"
        >
          <span>⚙️</span>
          <span>{activeTool === "example" ? "Generating…" : "Real-World Example"}</span>
        </button>

        <button
          onClick={() => handleStudyTool("mcqs", "Practice MCQs")}
          disabled={Boolean(activeTool)}
          className="rounded-lg border border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:text-white transition disabled:opacity-40 flex items-center gap-1"
          title="3 exam-style multiple choice questions"
        >
          <span>❓</span>
          <span>{activeTool === "mcqs" ? "Generating…" : "Practice MCQs"}</span>
        </button>

        <button
          onClick={() => handleStudyTool("flashcards", "Revision Flashcards")}
          disabled={Boolean(activeTool)}
          className="rounded-lg border border-zinc-800 bg-zinc-800/40 hover:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:text-white transition disabled:opacity-40 flex items-center gap-1"
          title="3 active recall revision flashcards"
        >
          <span>📝</span>
          <span>{activeTool === "flashcards" ? "Generating…" : "Flashcards"}</span>
        </button>
      </div>

      {/* Utility Buttons: Copy, Bookmark, Regenerate */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          title="Copy answer text"
        >
          {copied ? (
            <span className="text-[11px] text-emerald-400 font-semibold">Copied!</span>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          )}
        </button>

        <button
          onClick={onToggleBookmark}
          className={`p-1.5 rounded-lg transition ${
            isBookmarked
              ? "text-amber-400 hover:bg-zinc-800"
              : "text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
          }`}
          title={isBookmarked ? "Remove Bookmark" : "Bookmark this Derivation"}
        >
          <span className="text-sm">{isBookmarked ? "★" : "☆"}</span>
        </button>

        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 transition"
            title="Regenerate tutor answer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
