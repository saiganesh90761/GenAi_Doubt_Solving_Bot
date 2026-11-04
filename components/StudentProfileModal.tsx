"use client";

import React, { useState } from "react";
import { useAuth, type UserPreferences } from "./AuthContext";
import { useToast } from "./Toast";

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export function StudentProfileModal({ isOpen, onClose }: StudentProfileModalProps) {
  const { user, updateProfile, updatePreferences, resetPassword, deleteAccount } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"profile" | "preferences" | "security">("profile");

  const [name, setName] = useState(user?.name || "");
  const [institution, setInstitution] = useState(user?.institution || "");
  const [major, setMajor] = useState(user?.major || "General Engineering");
  const [year, setYear] = useState(user?.year || "Undergraduate");

  const [explanationDepth, setExplanationDepth] = useState<UserPreferences["explanationDepth"]>(
    user?.preferences?.explanationDepth || "standard",
  );
  const [mathDetail, setMathDetail] = useState<UserPreferences["mathDetail"]>(
    user?.preferences?.mathDetail || "step_by_step",
  );

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !user) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile({ name, institution, major, year });
      showToast("Profile updated successfully!", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updatePreferences({ explanationDepth, mathDetail });
      showToast("Learning preferences saved!", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to update preferences", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    try {
      await resetPassword(user.email);
      showToast("Password reset link sent to your email!", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Password reset failed", "error");
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account? All your uploaded notes and chats will be unlinked.")) {
      return;
    }
    try {
      await deleteAccount();
      showToast("Account signed out and deleted.", "info");
      onClose();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Deletion failed", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-7 shadow-2xl text-zinc-100 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-sm shadow-md">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{user.name}</h2>
              <p className="text-xs text-zinc-400 font-mono">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-zinc-800/80 p-1 my-5 border border-zinc-700/50">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === "profile" ? "bg-zinc-700 text-white shadow-xs" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Academic Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("preferences")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === "preferences" ? "bg-zinc-700 text-white shadow-xs" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Learning Style
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === "security" ? "bg-zinc-700 text-white shadow-xs" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Account & Security
          </button>
        </div>

        {/* Tab: Academic Profile */}
        {activeTab === "profile" && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Engineering Discipline / Major</label>
              <select
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                {ENGINEERING_MAJORS.map((m) => (
                  <option key={m} value={m} className="bg-zinc-800 text-white">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Institution / University</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. Stanford University / IIT Delhi / TU Delft"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Academic Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="1st Year Undergraduate">1st Year Undergraduate</option>
                <option value="2nd Year Undergraduate">2nd Year Undergraduate</option>
                <option value="3rd Year Undergraduate">3rd Year Undergraduate</option>
                <option value="Final Year Undergraduate">Final Year Undergraduate</option>
                <option value="Postgraduate / Master's">Postgraduate / Master&apos;s</option>
                <option value="PhD Candidate">PhD Candidate</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-semibold text-white transition shadow-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Academic Profile"}
            </button>
          </form>
        )}

        {/* Tab: Learning Preferences */}
        {activeTab === "preferences" && (
          <form onSubmit={handleSavePreferences} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Default Explanation Rigor
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "intuitive", label: "Intuitive", desc: "Everyday analogies first" },
                  { id: "standard", label: "Standard", desc: "Balanced theory & math" },
                  { id: "rigorous", label: "Rigorous", desc: "Formal theorems & proofs" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExplanationDepth(opt.id as UserPreferences["explanationDepth"])}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      explanationDepth === opt.id
                        ? "border-indigo-500 bg-indigo-500/10 text-white"
                        : "border-zinc-800 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Mathematical Detail in Derivations
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "concise", label: "Concise", desc: "Key formulas only" },
                  { id: "step_by_step", label: "Step-by-Step", desc: "Show algebraic steps" },
                  { id: "exhaustive", label: "Exhaustive", desc: "Complete proofs from first principles" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMathDetail(opt.id as UserPreferences["mathDetail"])}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      mathDetail === opt.id
                        ? "border-indigo-500 bg-indigo-500/10 text-white"
                        : "border-zinc-800 bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-semibold text-white transition shadow-sm disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Learning Preferences"}
            </button>
          </form>
        )}

        {/* Tab: Account & Security */}
        {activeTab === "security" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-800/40 p-4">
              <h3 className="text-xs font-semibold text-white">Reset Password</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Send a secure password reset link to your email ({user.email}).
              </p>
              <button
                type="button"
                onClick={handleSendPasswordReset}
                className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:text-white hover:bg-zinc-700 transition"
              >
                Send Password Reset Email
              </button>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <h3 className="text-xs font-semibold text-red-300">Delete Account</h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Permanently delete your student profile, conversation history, and unbind your documents.
              </p>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="mt-3 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/20 transition"
              >
                Delete Student Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
