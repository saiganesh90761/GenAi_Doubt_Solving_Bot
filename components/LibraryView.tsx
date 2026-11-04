"use client";

import React, { useState, useMemo, useRef } from "react";
import { useToast } from "./Toast";
import type { DocumentRecord } from "@/lib/documents";

interface LibraryViewProps {
  documents: DocumentRecord[];
  onRefresh: () => Promise<void>;
  sessionId: string;
}

export function LibraryView({ documents, onRefresh, sessionId }: LibraryViewProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("All");
  const [selectedScope, setSelectedScope] = useState<"all" | "global" | "private">("all");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadScope, setUploadScope] = useState<"private" | "global">("private");
  const [uploadSubject, setUploadSubject] = useState("General Engineering");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      if (d.subject) set.add(d.subject);
    });
    return ["All", ...Array.from(set)];
  }, [documents]);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchSearch =
        searchQuery === "" ||
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.subject.toLowerCase().includes(searchQuery.toLowerCase());

      const matchSubject =
        selectedSubject === "All" ||
        doc.subject.toLowerCase() === selectedSubject.toLowerCase();

      const matchScope =
        selectedScope === "all" || doc.knowledgeScope === selectedScope;

      return matchSearch && matchSubject && matchScope;
    });
  }, [documents, searchQuery, selectedSubject, selectedScope]);

  const handleDelete = async (doc: DocumentRecord) => {
    if (!confirm(`Are you sure you want to delete "${doc.name}"? This removes all vector embeddings and stored files.`)) {
      return;
    }

    setIsDeleting(doc.id);
    try {
      const res = await fetch(`/api/library/${doc.id}`, {
        method: "DELETE",
        headers: {
          "x-session-id": sessionId,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete document.");
      }

      showToast(`Deleted "${doc.name}" and removed vector embeddings.`, "success");
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete document";
      showToast(msg, "error");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      showToast("Please choose a PDF document to upload", "error");
      return;
    }

    const file = files[0];
    setIsUploading(true);
    setUploadProgress(`Processing and indexing ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scope", uploadScope);
      formData.append("subject", uploadSubject);
      if (sessionId) {
        formData.append("sessionId", sessionId);
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Upload failed for ${file.name}`);
      }

      showToast(`Successfully indexed "${file.name}" (${data.chunkCount || 0} chunks).`, "success");
      setUploadModalOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      showToast(msg, "error");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Academic Document Library
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Browse and manage reference textbooks and personal student notes indexed in Qdrant Cloud.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void onRefresh()}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 transition-colors"
          >
            <span>🔄</span> Refresh
          </button>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-sm transition-all"
          >
            <span>+ Upload PDF</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="my-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or subject..."
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 outline-none focus:border-sky-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-zinc-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Scope selector */}
        <div>
          <select
            value={selectedScope}
            onChange={(e) => setSelectedScope(e.target.value as "all" | "global" | "private")}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 outline-none focus:border-sky-500 transition-colors"
          >
            <option value="all">All Documents ({documents.length})</option>
            <option value="global">Global Reference Only</option>
            <option value="private">My Personal Notes Only</option>
          </select>
        </div>

        {/* Subject selector */}
        <div>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 outline-none focus:border-sky-500 transition-colors"
          >
            {subjects.map((sub) => (
              <option key={sub} value={sub}>
                Subject: {sub}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center my-8">
          <p className="text-3xl mb-2">📄</p>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            No documents found
          </h3>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
            {searchQuery || selectedScope !== "all" || selectedSubject !== "All"
              ? "No materials match your active filters. Try resetting search filters."
              : "No PDF materials have been indexed yet. Upload a syllabus or textbook to get started."}
          </p>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="mt-4 inline-flex items-center gap-1 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 transition-all"
          >
            <span>Upload First PDF</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs dark:border-zinc-800/80 dark:bg-zinc-900/40 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
            >
              <div>
                {/* Header with scope badge & status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      doc.knowledgeScope === "global"
                        ? "bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 border border-indigo-500/20"
                        : "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/20"
                    }`}
                  >
                    <span>{doc.knowledgeScope === "global" ? "🏛️ Global" : "👤 Private"}</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        doc.status === "ready"
                          ? "bg-emerald-500"
                          : doc.status === "processing" || doc.status === "uploading"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-rose-500"
                      }`}
                    />
                    <span className="text-[11px] font-medium text-zinc-500 capitalize">
                      {doc.status}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3
                  className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2"
                  title={doc.name}
                >
                  {doc.name}
                </h3>
                <p className="mt-1 text-xs text-sky-600 dark:text-sky-400 font-medium">
                  {doc.subject || "General Engineering"}
                </p>

                {/* Metadata stats */}
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-100 dark:border-zinc-800/80 pt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <div>
                    <span className="block font-semibold text-zinc-900 dark:text-zinc-100">
                      {doc.pageCount || 1}
                    </span>
                    <span>Pages</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-zinc-900 dark:text-zinc-100">
                      {doc.chunkCount || 0}
                    </span>
                    <span>Chunks</span>
                  </div>
                  <div>
                    <span className="block font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatBytes(doc.fileSize)}
                    </span>
                    <span>Size</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                <span className="text-[10px] text-zinc-400">
                  Added {formatDate(doc.createdAt)}
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/library/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <span>Read PDF</span> ↗
                  </a>
                  <button
                    onClick={() => handleDelete(doc)}
                    disabled={isDeleting === doc.id}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-xs text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
                    title="Delete document"
                  >
                    {isDeleting === doc.id ? "…" : "🗑️"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Upload Academic Material
              </h2>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
              {/* File picker */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Select PDF Document
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  disabled={isUploading}
                  className="w-full text-xs text-zinc-600 dark:text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-800 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-200 cursor-pointer"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Subject Category
                </label>
                <select
                  value={uploadSubject}
                  onChange={(e) => setUploadSubject(e.target.value)}
                  disabled={isUploading}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 outline-none"
                >
                  <option value="Electrical Engineering">Electrical Engineering (Circuits, Signals)</option>
                  <option value="Mechanical Engineering">Mechanical Engineering (Thermo, Fluids)</option>
                  <option value="Computer Science">Computer Science & Engineering</option>
                  <option value="Civil Engineering">Civil Engineering (Structures, Materials)</option>
                  <option value="Chemical Engineering">Chemical & Process Engineering</option>
                  <option value="General Engineering">General Engineering & Mathematics</option>
                </select>
              </div>

              {/* Scope Selector */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Knowledge Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadScope("private")}
                    disabled={isUploading}
                    className={`rounded-xl border p-2.5 text-left text-xs transition-all ${
                      uploadScope === "private"
                        ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-semibold"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <span className="block font-bold">🔒 Private Notes</span>
                    <span className="text-[10px] opacity-75">Only visible in your current session</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadScope("global")}
                    disabled={isUploading}
                    className={`rounded-xl border p-2.5 text-left text-xs transition-all ${
                      uploadScope === "global"
                        ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-200 font-semibold"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    <span className="block font-bold">🏛️ Global Library</span>
                    <span className="text-[10px] opacity-75">Accessible to all student questions</span>
                  </button>
                </div>
              </div>

              {uploadProgress && (
                <div className="rounded-xl bg-zinc-100 dark:bg-zinc-900 p-3 text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                  <span className="animate-spin text-sm">⏳</span>
                  <span>{uploadProgress}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={isUploading}
                  className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
                >
                  {isUploading ? "Uploading & Indexing…" : "Upload to Qdrant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

