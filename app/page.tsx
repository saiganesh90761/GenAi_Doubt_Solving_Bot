"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "@/components/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { ToastProvider, useToast } from "@/components/Toast";
import { HomeView } from "@/components/HomeView";
import { ChatWorkspace } from "@/components/ChatWorkspace";
import { StudentDashboard } from "@/components/StudentDashboard";
import { DocumentLibrary } from "@/components/DocumentLibrary";
import { BookmarkedAnswersView, type BookmarkedAnswer } from "@/components/BookmarkedAnswersView";
import { StudentProfileModal } from "@/components/StudentProfileModal";
import type { DocumentRecord } from "@/lib/documents";
import type { Conversation } from "@/lib/conversations";

type AppView = "home" | "dashboard" | "chat" | "documents" | "bookmarks";

function MainApp() {
  const { user, token, logout, openAuth } = useAuth();
  const { showToast } = useToast();

  const [currentView, setCurrentView] = useState<AppView>("home");
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkedAnswer[]>([]);
  const [selectedDocScope, setSelectedDocScope] = useState<string>("all");

  const userId = user ? user.id : "guest_user";

  // Load Bookmarks from Local Storage
  useEffect(() => {
    let ignore = false;
    Promise.resolve().then(() => {
      if (ignore) return;
      try {
        const saved = typeof window !== "undefined" ? localStorage.getItem(`eds_bookmarks_${userId}`) : null;
        if (saved) {
          setBookmarks(JSON.parse(saved));
        } else {
          setBookmarks([]);
        }
      } catch {
        setBookmarks([]);
      }
    });
    return () => {
      ignore = true;
    };
  }, [userId]);

  // Persist Bookmarks
  const saveBookmarks = (list: BookmarkedAnswer[]) => {
    setBookmarks(list);
    try {
      localStorage.setItem(`eds_bookmarks_${userId}`, JSON.stringify(list));
    } catch {
      // ignore
    }
  };

  const handleToggleBookmark = (answer: Omit<BookmarkedAnswer, "id" | "createdAt">) => {
    const existingIndex = bookmarks.findIndex((b) => b.answer === answer.answer);
    if (existingIndex >= 0) {
      const next = bookmarks.filter((_, idx) => idx !== existingIndex);
      saveBookmarks(next);
      showToast("Removed from saved derivations", "info");
    } else {
      const newBookmark: BookmarkedAnswer = {
        ...answer,
        id: `bm_${Math.random().toString(36).slice(2, 9)}`,
        createdAt: Date.now(),
      };
      saveBookmarks([newBookmark, ...bookmarks]);
      showToast("Saved to Bookmarked Derivations!", "success");
    }
  };

  const handleRemoveBookmark = (id: string) => {
    const next = bookmarks.filter((b) => b.id !== id);
    saveBookmarks(next);
    showToast("Removed bookmark", "info");
  };

  // Load Documents & Conversations
  const refreshDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/library?sessionId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    let ignore = false;
    const loadInitialData = async () => {
      try {
        const docRes = await fetch(`/api/library?sessionId=${encodeURIComponent(userId)}`);
        if (docRes.ok && !ignore) {
          const docData = await docRes.json();
          setDocuments(docData.documents || []);
        }

        const convRes = await fetch(`/api/conversations?userId=${encodeURIComponent(userId)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (convRes.ok && !ignore) {
          const convData = await convRes.json();
          setConversations(convData.conversations || []);
        }
      } catch {
        // ignore
      }
    };
    void loadInitialData();
    return () => {
      ignore = true;
    };
  }, [userId, token]);

  // If user signs in, direct them to dashboard or chat
  const handleEnterWorkspace = () => {
    setCurrentView("dashboard");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <AuthModal />
      <StudentProfileModal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} />

      {/* Global Top Nav when in logged-in / student views */}
      {currentView !== "home" && (
        <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur sticky top-0 z-30 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentView("dashboard")}
                className="flex items-center gap-2.5 hover:opacity-90 transition"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs shadow-md shadow-indigo-500/20">
                  EDS
                </div>
                <div className="hidden sm:block text-left">
                  <span className="font-bold text-sm tracking-tight text-white">Engineering Doubt Solver</span>
                </div>
              </button>
            </div>

            {/* View Switcher Tabs */}
            <nav className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setCurrentView("dashboard")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                  currentView === "dashboard"
                    ? "bg-zinc-800 text-white font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <span>📊</span>
                <span className="hidden sm:inline">Dashboard</span>
              </button>

              <button
                onClick={() => setCurrentView("chat")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                  currentView === "chat"
                    ? "bg-zinc-800 text-white font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <span>💬</span>
                <span className="hidden sm:inline">Doubt Solver</span>
              </button>

              <button
                onClick={() => setCurrentView("documents")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                  currentView === "documents"
                    ? "bg-zinc-800 text-white font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <span>📚</span>
                <span className="hidden sm:inline">Documents</span>
                {documents.length > 0 && (
                  <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.2 text-[10px] text-indigo-300 font-mono">
                    {documents.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setCurrentView("bookmarks")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-1.5 ${
                  currentView === "bookmarks"
                    ? "bg-zinc-800 text-white font-semibold"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                }`}
              >
                <span>🔖</span>
                <span className="hidden sm:inline">Saved</span>
                {bookmarks.length > 0 && (
                  <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] text-emerald-300 font-mono">
                    {bookmarks.length}
                  </span>
                )}
              </button>
            </nav>

            {/* User Pill / Settings / Auth */}
            <div className="flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-2">
                  {user.isGuest && (
                    <button
                      onClick={() => openAuth("register")}
                      className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20 transition"
                      title="Create a permanent account to sync notes across devices"
                    >
                      <span>⚡ Guest</span>
                      <span className="text-zinc-400">•</span>
                      <span className="underline">Save Account</span>
                    </button>
                  )}

                  <button
                    onClick={() => setProfileModalOpen(true)}
                    className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 hover:border-zinc-700 transition"
                    title="Student Profile & Settings"
                  >
                    <div className="h-6 w-6 rounded-lg bg-indigo-600/30 text-indigo-300 text-xs font-bold flex items-center justify-center">
                      {user.isGuest ? "⚡" : user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="hidden md:block text-left">
                      <p className="text-xs font-medium text-white leading-none">
                        {user.isGuest ? "Guest Student" : user.name}
                      </p>
                      <p className="text-[9px] text-zinc-400 font-mono leading-none mt-0.5">{user.major || "Engineering"}</p>
                    </div>
                    <span className="text-zinc-400 text-xs">⚙️</span>
                  </button>

                  <button
                    onClick={logout}
                    className="p-1.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition"
                    title={user.isGuest ? "Exit Guest Mode" : "Sign Out"}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openAuth("login")}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {currentView === "home" && (
          <HomeView onEnterWorkspace={handleEnterWorkspace} />
        )}

        {currentView === "dashboard" && (
          <StudentDashboard
            documents={documents}
            conversations={conversations}
            bookmarkedCount={bookmarks.length}
            onOpenChat={() => setCurrentView("chat")}
            onOpenDocuments={() => setCurrentView("documents")}
            onOpenBookmarks={() => setCurrentView("bookmarks")}
            onUploadClick={() => setCurrentView("documents")}
          />
        )}

        {currentView === "chat" && (
          <ChatWorkspace
            onBackToHome={() => setCurrentView("dashboard")}
            onOpenDashboard={() => setCurrentView("dashboard")}
            onOpenDocuments={() => setCurrentView("documents")}
            onOpenBookmarks={() => setCurrentView("bookmarks")}
            onOpenProfile={() => setProfileModalOpen(true)}
            initialDocScope={selectedDocScope}
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
          />
        )}

        {currentView === "documents" && (
          <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 max-w-6xl mx-auto w-full space-y-6">
            <DocumentLibrary
              documents={documents}
              onRefresh={refreshDocuments}
              userId={userId}
              onSelectForChat={(docId) => {
                setSelectedDocScope(docId);
                setCurrentView("chat");
              }}
            />
          </div>
        )}

        {currentView === "bookmarks" && (
          <BookmarkedAnswersView
            bookmarks={bookmarks}
            onRemoveBookmark={handleRemoveBookmark}
            onOpenChat={() => setCurrentView("chat")}
          />
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}
