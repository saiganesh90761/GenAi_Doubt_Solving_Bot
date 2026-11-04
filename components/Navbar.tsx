"use client";

import React, { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

export type NavTab = "chat" | "library" | "how-it-works" | "admin";

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  documentCount?: number;
  onNewChat?: () => void;
}

export function Navbar({
  activeTab,
  onTabChange,
  documentCount = 0,
  onNewChat,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tabs: Array<{ id: NavTab; label: string; icon: string; badge?: number }> = [
    { id: "chat", label: "Tutor Chat", icon: "💬" },
    { id: "library", label: "Document Library", icon: "📚", badge: documentCount },
    { id: "how-it-works", label: "How RAG Works", icon: "⚡" },
    { id: "admin", label: "Admin Studio", icon: "⚙️" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-white/80 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/80 transition-colors">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-6">
        {/* Brand & Logo */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => onTabChange("how-it-works")}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-sm shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <span className="text-sm font-bold">ED</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Engineering Doubt Solver
                </span>
                <span className="hidden sm:inline-block rounded-full bg-sky-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                  v2.0 RAG
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Nav Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-900/60"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="ml-1 rounded-full bg-zinc-200 px-1.5 py-0.2 text-[10px] text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2">
          {activeTab === "chat" && onNewChat && (
            <button
              onClick={onNewChat}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
            >
              <span>+</span>
              <span>New Conversation</span>
            </button>
          )}

          <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />

          {/* Theme Switcher */}
          <ThemeToggle />

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                setMobileMenuOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-sm font-medium ${
                activeTab === tab.id
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs dark:bg-zinc-700">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
          {onNewChat && (
            <button
              onClick={() => {
                onNewChat();
                setMobileMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-sky-600 dark:text-sky-400 font-medium border-t border-zinc-100 dark:border-zinc-800 pt-2"
            >
              <span>+</span>
              <span>Start New Conversation</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}

