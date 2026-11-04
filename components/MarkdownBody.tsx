"use client";

import React, { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

function CodeBlock({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"code"> & { inline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const isInline = !match && !String(children).includes("\n");
  const codeText = String(children).replace(/\n$/, "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (isInline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded text-[0.88em] font-mono bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60"
        {...props}
      >
        {children}
      </code>
    );
  }

  const lang = match ? match[1] : "code";

  return (
    <div className="relative my-3 rounded-xl border border-zinc-200 bg-zinc-950 dark:border-zinc-800 overflow-hidden text-zinc-100 shadow-sm">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-900/80 border-b border-zinc-800/80 text-xs font-mono text-zinc-400">
        <span className="uppercase tracking-wider text-[11px] font-semibold text-zinc-300">
          {lang}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          {copied ? (
            <>
              <span className="text-emerald-400">✓</span> Copied!
            </>
          ) : (
            <>
              <span>📋</span> Copy
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 text-xs leading-5 overflow-x-auto font-mono">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export const MarkdownBody = memo(function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="markdown-body text-sm leading-6 space-y-2 text-zinc-800 dark:text-zinc-200">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code: CodeBlock,
          h1: ({ children }) => (
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-4 mb-2 pb-1 border-b border-zinc-200 dark:border-zinc-800">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mt-3.5 mb-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => {
            const headingStr = String(children);
            // Highlight general engineering knowledge disclaimer as a formatted callout box
            if (headingStr.includes("General Engineering Knowledge")) {
              return (
                <div className="my-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 font-medium text-xs flex items-start gap-2">
                  <span className="text-sm">⚠️</span>
                  <div>
                    <p className="font-semibold">{headingStr}</p>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      The explanation below is provided from general engineering principles as the uploaded library had insufficient context for this specific topic.
                    </p>
                  </div>
                </div>
              );
            }
            return (
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-3 mb-1">
                {children}
              </h3>
            );
          },
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1 my-2 marker:text-zinc-400 dark:marker:text-zinc-500">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1 my-2 marker:text-zinc-500 dark:marker:text-zinc-400 font-medium">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-6">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-3.5 border-l-2 border-sky-500/80 italic text-zinc-600 dark:text-zinc-400 bg-sky-500/5 py-1 rounded-r-lg">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="bg-zinc-100 dark:bg-zinc-800/60 px-3 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800/60">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

