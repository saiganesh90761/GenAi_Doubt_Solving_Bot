"use client";

import React from "react";
import type { ChatSource } from "@/lib/types";

export function SourcesPanel({ sources }: { sources: ChatSource[] }) {
  if (!sources || sources.length === 0) {
    return (
      <div className="mt-3 text-xs text-zinc-400 dark:text-zinc-500 italic flex items-center gap-1.5">
        <span>ℹ</span> Answer generated from general engineering knowledge (no specific textbook matches).
      </div>
    );
  }

  return (
    <details className="group mt-3 rounded-xl border border-zinc-200 bg-zinc-50/80 text-xs dark:border-zinc-800 dark:bg-zinc-900/60 transition-all">
      <summary className="flex cursor-pointer select-none items-center justify-between px-3.5 py-2.5 font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100">
        <span className="flex items-center gap-2">
          <span>📚</span>
          <span>
            {sources.length} Academic Reference {sources.length === 1 ? "Citation" : "Citations"}
          </span>
        </span>
        <span className="text-xs text-zinc-400 group-open:hidden flex items-center gap-1">
          <span>View Excerpts</span> ▾
        </span>
        <span className="hidden text-xs text-zinc-400 group-open:inline flex items-center gap-1">
          <span>Hide</span> ▴
        </span>
      </summary>
      <ul className="space-y-2 border-t border-zinc-200/80 p-3 dark:border-zinc-800">
        {sources.map((source, index) => (
          <li
            key={`${source.file}-${source.page}-${index}`}
            className="rounded-lg border border-zinc-200/60 bg-white p-3 dark:border-zinc-800/80 dark:bg-zinc-950 transition-all"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {index + 1}
                </span>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {source.file}{" "}
                  <span className="font-normal text-zinc-500 dark:text-zinc-400">
                    p. {source.page}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {source.score !== undefined && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      source.score >= 0.75
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                    }`}
                  >
                    {Math.round(source.score * 100)}% match
                  </span>
                )}
                {source.documentId && (
                  <a
                    href={`/api/library/${source.documentId}#page=${source.page}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Open PDF ↗
                  </a>
                )}
              </div>
            </div>
            {source.subject && (
              <p className="mt-1 text-[11px] font-medium text-zinc-400">
                Subject: {source.subject}
              </p>
            )}
            <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400 border-l-2 border-zinc-200 dark:border-zinc-800 pl-2.5 italic">
              &ldquo;{source.snippet}&rdquo;
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

