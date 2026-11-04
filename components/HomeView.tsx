"use client";

import React from "react";
import { useAuth } from "./AuthContext";

interface HomeViewProps {
  onEnterWorkspace: () => void;
}

export function HomeView({ onEnterWorkspace }: HomeViewProps) {
  const { user, openAuth } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Clean Top Navigation */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-sm shadow-md shadow-indigo-500/20">
              EDS
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white">Engineering Doubt Solver</span>
              <span className="hidden sm:inline-block ml-2 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
                Qdrant RAG
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-medium text-white">{user.name}</p>
                  <p className="text-[10px] text-zinc-400 font-mono">{user.email}</p>
                </div>
                <button
                  onClick={onEnterWorkspace}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition flex items-center gap-1.5"
                >
                  <span>Open Workspace</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openAuth("login")}
                  className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition"
                >
                  Sign In
                </button>
                <button
                  onClick={() => openAuth("register")}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-24 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400 mb-6">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>AI Tutor Grounded on Your Uploaded PDFs</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.15]">
          Clear Any Engineering Doubt with <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Zero Hallucinations</span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
          Upload your textbooks, lecture notes, and syllabus PDFs. Ask questions to get step-by-step mathematical derivations, formula breakdowns, and circuit analysis strictly verified against your materials.
        </p>

        {/* Primary Action */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              if (user) {
                onEnterWorkspace();
              } else {
                openAuth("register");
              }
            }}
            className="w-full sm:w-auto rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-2 group"
          >
            <span>{user ? "Open Tutor Workspace" : "Start Solving Doubts Free"}</span>
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>

          {!user && (
            <button
              onClick={() => openAuth("login")}
              className="w-full sm:w-auto rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 px-6 py-3.5 text-sm font-semibold text-zinc-300 hover:text-white transition"
            >
              Log in to Existing Account
            </button>
          )}
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-16 sm:mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left w-full">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white">Upload Any PDF</h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Upload your engineering notes, problem sets, and textbooks. Fast text extraction and automatic 2048-dim vector embedding into Qdrant Cloud.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30 mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white">KaTeX Math & Equations</h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Step-by-step mathematical derivations with full KaTeX rendering. Complex integrals, matrices, circuit loops, and mechanical stress formulas.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 mb-4">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white">Verified Citations</h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Every answer links directly to the exact page and paragraph in your uploaded PDF. Zero made-up references or textbook hallucinations.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        Engineering Doubt Solver • Powered by Qdrant Cloud Vector Database & NVIDIA Nemotron
      </footer>
    </div>
  );
}
