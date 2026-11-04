"use client";

import React, { useState } from "react";
import { AuthProvider } from "@/components/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { ToastProvider } from "@/components/Toast";
import { HomeView } from "@/components/HomeView";
import { ChatWorkspace } from "@/components/ChatWorkspace";

function MainApp() {
  const [currentView, setCurrentView] = useState<"home" | "workspace">("home");

  return (
    <>
      <AuthModal />
      {currentView === "home" ? (
        <HomeView onEnterWorkspace={() => setCurrentView("workspace")} />
      ) : (
        <ChatWorkspace onBackToHome={() => setCurrentView("home")} />
      )}
    </>
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
