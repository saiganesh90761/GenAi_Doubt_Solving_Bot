"use client";

import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./Toast";

const ENGINEERING_MAJORS = [
  "General Engineering",
  "Computer Science & Engineering",
  "Electrical & Electronics Engineering",
  "Mechanical Engineering",
  "Civil & Structural Engineering",
  "Chemical & Process Engineering",
  "Aerospace Engineering",
  "Biomedical Engineering",
];

export function AuthModal() {
  const { authModalOpen, authModalMode, closeAuth, login, register, loginAsGuest, resetPassword, openAuth } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [major, setMajor] = useState("General Engineering");
  const [institution, setInstitution] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  if (!authModalOpen) return null;

  const isLogin = authModalMode === "login";
  const isForgot = authModalMode === "forgot";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      if (isForgot) {
        await resetPassword(email);
        setResetSent(true);
        showToast("Password reset link sent to your email!", "info");
      } else if (isLogin) {
        await login(email, password);
        showToast("Welcome back to Engineering Doubt Solver!", "success");
      } else {
        await register(name, email, password, institution, major);
        showToast("Account created successfully! Welcome to your academic workspace.", "success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication error";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeAuth}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={closeAuth}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isForgot
              ? "Reset your password"
              : isLogin
              ? "Welcome back"
              : "Create your student account"}
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            {isForgot
              ? "Enter your email to receive a password reset link"
              : isLogin
              ? "Sign in to access your uploaded documents & doubts"
              : "Join to index your textbooks in Qdrant and save conversations"}
          </p>
        </div>

        {/* Mode Switcher */}
        {!isForgot && (
          <div className="flex rounded-xl bg-zinc-800/80 p-1 mb-5 border border-zinc-700/50">
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                openAuth("login");
              }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                isLogin
                  ? "bg-zinc-700 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                openAuth("register");
              }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                !isLogin
                  ? "bg-zinc-700 text-white shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 space-y-2">
            <p className="font-medium">{errorMessage}</p>
            {errorMessage.toLowerCase().includes("rate limit") && (
              <div className="pt-2 border-t border-red-500/20 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    openAuth("login");
                  }}
                  className="rounded-lg bg-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-zinc-700 transition"
                >
                  Try Signing In Instead →
                </button>
                <button
                  type="button"
                  onClick={closeAuth}
                  className="text-[11px] text-zinc-400 hover:text-white underline"
                >
                  Continue as Guest
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reset Confirmation */}
        {resetSent && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            Password reset link dispatched. Please check your inbox and spam folder.
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!isLogin && !isForgot && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@university.edu"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {!isLogin && !isForgot && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Engineering Discipline / Major</label>
                <select
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {ENGINEERING_MAJORS.map((m) => (
                    <option key={m} value={m} className="bg-zinc-800 text-white">
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">University / Institute (Optional)</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. Stanford / MIT / IIT / TU Munich"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {!isForgot && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-zinc-300">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setResetSent(false);
                      openAuth("forgot");
                    }}
                    className="text-[11px] text-indigo-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-sm font-semibold text-white transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : isForgot ? (
              "Send Reset Link"
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Create Student Account"
            )}
          </button>
        </form>

        {!isForgot && (
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => {
                loginAsGuest();
                showToast("Signed in as Guest Student! All features active.", "success");
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/90 hover:bg-zinc-800 hover:border-indigo-500/60 py-2.5 text-xs font-semibold text-zinc-200 hover:text-white transition flex items-center justify-center gap-2 group shadow-sm"
            >
              <span className="text-amber-400">⚡</span>
              <span>Continue as Guest Student (Instant Access)</span>
            </button>
            <p className="mt-2 text-center text-[10px] text-zinc-500">
              No email verification required • Full PDF upload & Qdrant RAG enabled
            </p>
          </div>
        )}

        {isForgot && (
          <div className="mt-4 text-center">
            <button
              onClick={() => openAuth("login")}
              className="text-xs text-indigo-400 hover:underline"
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        <p className="mt-5 text-center text-[10px] text-zinc-500">
          Grounded on Qdrant Cloud • Powered by NVIDIA Nemotron 3
        </p>
      </div>
    </div>
  );
}
