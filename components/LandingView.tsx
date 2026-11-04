"use client";

import React from "react";
import type { NavTab } from "./Navbar";

interface LandingViewProps {
  onNavigate: (tab: NavTab) => void;
  documentCount: number;
}

export function LandingView({ onNavigate, documentCount }: LandingViewProps) {
  const steps = [
    {
      num: "01",
      title: "Document Ingestion",
      desc: "Academic textbooks and personal student notes are validated, parsed with page accuracy, and segmented into semantic chunks.",
      icon: "📄",
    },
    {
      num: "02",
      title: "2048-Dim Embeddings",
      desc: "Each chunk is transformed into high-dimensional vector representations capturing engineering formulas, terminology, and physical principles.",
      icon: "🧬",
    },
    {
      num: "03",
      title: "Qdrant Cloud Indexing",
      desc: "Vectors are indexed in a managed Qdrant Cloud cluster with strict session payload isolation and multi-attribute subject filtering.",
      icon: "⚡",
    },
    {
      num: "04",
      title: "Semantic Hybrid Retrieval",
      desc: "When you ask a question, conversational contextualization extracts query intent and retrieves top-k relevant excerpts matching threshold criteria.",
      icon: "🎯",
    },
    {
      num: "05",
      title: "Reasoning & LaTeX Derivations",
      desc: "NVIDIA Nemotron 3 Ultra synthesizes verified textbook excerpts into step-by-step mathematical proofs with precise in-text citations.",
      icon: "📐",
    },
  ];

  const features = [
    {
      title: "Mathematical Proofs & LaTeX",
      desc: "Full KaTeX rendering of equations, algebraic steps, vector calculus, thermodynamics cycles, and circuit node laws.",
      badge: "Pedagogy",
      icon: "∫",
    },
    {
      title: "Zero Hallucination Grounding",
      desc: "If textbook context is insufficient, the tutor explicitly declares it rather than manufacturing fake citations or formulas.",
      badge: "Academic Rigor",
      icon: "🛡️",
    },
    {
      title: "Dual-Scope Document Isolation",
      desc: "Admins manage permanent global academic textbooks, while students upload private course notes with zero cross-session leakage.",
      badge: "Security",
      icon: "🔒",
    },
    {
      title: "Precise In-Text Citations",
      desc: "Every claim cites the exact textbook title, page number, and similarity score, with one-click direct PDF viewing.",
      badge: "Verification",
      icon: "📖",
    },
    {
      title: "Conversational Memory",
      desc: "Ask iterative follow-ups ('What if the resistor is in parallel?') — conversational rewriters maintain full engineering context.",
      badge: "Follow-ups",
      icon: "💬",
    },
    {
      title: "Real-Time SSE Streaming",
      desc: "Instant Server-Sent Event streaming delivers source citations immediately followed by tokens and code block syntax highlighting.",
      badge: "Low Latency",
      icon: "⚡",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:px-6 lg:px-8 bg-gradient-to-b from-zinc-50 via-white to-zinc-50 dark:from-zinc-950 dark:via-zinc-900/50 dark:to-zinc-950 border-b border-zinc-200/60 dark:border-zinc-800/60">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(56,189,248,0.12),rgba(0,0,0,0))]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
            <span>Qdrant Cloud + NVIDIA Nemotron 3 Ultra</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
            Master Engineering Concepts with{" "}
            <span className="bg-gradient-to-r from-sky-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Textbook-Grounded RAG
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg leading-7 sm:leading-8 text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            An intelligent AI doubt solver built specifically for engineering students.
            Get step-by-step mathematical derivations, LaTeX equations, and verified textbook
            citations — with zero hallucinations.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => onNavigate("chat")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-sm transition-all"
            >
              <span>🚀 Ask a Question</span>
            </button>
            <button
              onClick={() => onNavigate("library")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/80 transition-all"
            >
              <span>📚 Explore Library ({documentCount} docs)</span>
            </button>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-zinc-200/60 dark:border-zinc-800/60 pt-8 sm:grid-cols-4 text-center">
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">2048</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Embedding Dimensions</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">&lt; 15ms</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Qdrant Vector Recall</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">100%</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Page-Accurate Citations</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">KaTeX</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">LaTeX Math Rendered</p>
            </div>
          </div>
        </div>
      </section>

      {/* How RAG Works Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            Architecture
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            How The RAG Pipeline Operates
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            From raw textbook upload to step-by-step LaTeX derivations — every stage is mathematically grounded.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {steps.map((step) => (
            <div
              key={step.num}
              className="relative flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/60"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">{step.icon}</span>
                <span className="text-xs font-mono font-bold text-zinc-400 dark:text-zinc-600">
                  {step.num}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                {step.title}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 max-w-6xl mx-auto border-t border-zinc-200/60 dark:border-zinc-800/60">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            Capabilities
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            Engineered For Academic Excellence
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => (
            <div
              key={feat.title}
              className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-lg">
                  {feat.icon}
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {feat.badge}
                </span>
              </div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                {feat.title}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="px-4 py-16 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="rounded-3xl border border-zinc-200 bg-gradient-to-r from-sky-50 to-indigo-50 p-8 sm:p-12 text-center dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Ready to solve your engineering doubts?
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto">
            Upload your course syllabus or lecture slides, ask complex derivation questions,
            and review step-by-step mathematical answers backed by verifiable academic citations.
          </p>
          <button
            onClick={() => onNavigate("chat")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
          >
            <span>Start Tutor Chat →</span>
          </button>
        </div>
      </section>
    </div>
  );
}

