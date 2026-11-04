"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Navbar, type NavTab } from "@/components/Navbar";
import { ChatView } from "@/components/ChatView";
import { LibraryView } from "@/components/LibraryView";
import { LandingView } from "@/components/LandingView";
import { AdminView } from "@/components/AdminView";
import { ToastProvider } from "@/components/Toast";
import type { DocumentRecord } from "@/lib/documents";

function AppContent() {
  const [activeTab, setActiveTab] = useState<NavTab>("chat");
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  // Persistent student session ID across page reloads
  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    let id = sessionStorage.getItem("engineering_doubt_session_id");
    if (!id) {
      id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem("engineering_doubt_session_id", id);
    }
    return id;
  });

  const refreshLibrary = useCallback(async () => {
    try {
      const url = sessionId
        ? `/api/library?sessionId=${encodeURIComponent(sessionId)}`
        : "/api/library";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      // ignore
    }
  }, [sessionId]);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  return (
    <div className="flex flex-col h-screen min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 font-sans antialiased overflow-hidden">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        documentCount={documents.length}
      />

      {/* Main View Area */}
      <main className="flex flex-1 overflow-hidden relative">
        {activeTab === "chat" && (
          <ChatView
            sessionId={sessionId}
            onRefreshLibrary={refreshLibrary}
          />
        )}

        {activeTab === "library" && (
          <LibraryView
            documents={documents}
            onRefresh={refreshLibrary}
            sessionId={sessionId}
          />
        )}

        {activeTab === "how-it-works" && (
          <LandingView
            onNavigate={setActiveTab}
            documentCount={documents.length}
          />
        )}

        {activeTab === "admin" && (
          <AdminView
            documents={documents}
            onRefresh={refreshLibrary}
            sessionId={sessionId}
          />
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
