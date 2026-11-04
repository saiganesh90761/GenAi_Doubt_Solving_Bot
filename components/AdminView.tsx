"use client";

import React, { useState, useRef } from "react";
import { useToast } from "./Toast";
import type { DocumentRecord } from "@/lib/documents";

interface AdminViewProps {
  documents: DocumentRecord[];
  onRefresh: () => Promise<void>;
  sessionId: string;
}

export function AdminView({ documents, onRefresh, sessionId }: AdminViewProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadSubject, setUploadSubject] = useState("Electrical Engineering");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const globalDocs = documents.filter((d) => d.knowledgeScope === "global");

  const handleAdminUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      showToast("Please choose an academic textbook PDF", "error");
      return;
    }

    const file = files[0];
    setIsUploading(true);
    setUploadProgress(`Validating, extracting, and indexing ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("scope", "global"); // Force global scope for admin materials
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
        throw new Error(data?.error || `Admin upload failed for ${file.name}`);
      }

      showToast(`Global textbook "${file.name}" indexed successfully (${data.chunkCount || 0} chunks).`, "success");
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

  const handleDelete = async (doc: DocumentRecord) => {
    if (!confirm(`Are you sure you want to delete "${doc.name}" from the global library?`)) {
      return;
    }

    setIsDeleting(doc.id);
    try {
      const res = await fetch(`/api/library/${doc.id}`, {
        method: "DELETE",
        headers: { "x-session-id": sessionId },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete reference document.");
      }

      showToast(`Purged "${doc.name}" from Qdrant Cloud.`, "success");
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      showToast(msg, "error");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            Admin Studio
          </span>
          <span className="text-xs text-zinc-400">• Reference Library Management</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Global Academic Reference Library
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Upload and manage official course textbooks, lecture slides, and reference manuals accessible to all students.
        </p>
      </div>

      {/* Cloud & Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60 shadow-xs">
          <p className="text-xs font-medium text-zinc-500">Vector Database</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Qdrant Cloud</span>
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-1 text-xs text-zinc-400 font-mono">engineering_doubt_solver</p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60 shadow-xs">
          <p className="text-xs font-medium text-zinc-500">Embedding Engine</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">2048 Dimensions</span>
            <span className="text-xs text-sky-500 font-semibold">Cosine</span>
          </div>
          <p className="mt-1 text-xs text-zinc-400 font-mono">nvidia/nemotron-3-embed-1b</p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60 shadow-xs">
          <p className="text-xs font-medium text-zinc-500">Indexed Global Textbooks</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {globalDocs.length} {globalDocs.length === 1 ? "Book" : "Books"}
            </span>
            <span className="text-xs text-zinc-400">
              {globalDocs.reduce((acc, d) => acc + (d.chunkCount || 0), 0)} Chunks
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400">Available to all students</p>
        </div>
      </div>

      {/* Admin Upload Section */}
      <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/30">
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
          Ingest Academic Reference Textbook
        </h2>
        <p className="text-xs text-zinc-500 mb-6">
          Global reference documents support up to 50MB files and are chunked, embedded, and stored in persistent object storage.
        </p>

        <form onSubmit={handleAdminUpload} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Select Textbook PDF (Max 50MB)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              required
              disabled={isUploading}
              className="w-full text-xs text-zinc-600 dark:text-zinc-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white file:text-zinc-800 hover:file:bg-zinc-100 dark:file:bg-zinc-800 dark:file:text-zinc-200 cursor-pointer border border-zinc-200 dark:border-zinc-700 rounded-xl p-1 bg-white dark:bg-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Engineering Subject
            </label>
            <select
              value={uploadSubject}
              onChange={(e) => setUploadSubject(e.target.value)}
              disabled={isUploading}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 outline-none"
            >
              <option value="Electrical Engineering">Electrical Engineering</option>
              <option value="Mechanical Engineering">Mechanical Engineering</option>
              <option value="Computer Science">Computer Science & Engineering</option>
              <option value="Civil Engineering">Civil Engineering</option>
              <option value="Chemical Engineering">Chemical Engineering</option>
              <option value="General Engineering">General Engineering & Mathematics</option>
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={isUploading}
              className="w-full rounded-xl bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-all shadow-sm"
            >
              {isUploading ? "Extracting & Embedding…" : "Index Reference Textbook"}
            </button>
          </div>
        </form>

        {uploadProgress && (
          <div className="mt-4 rounded-xl bg-white dark:bg-zinc-900 p-3.5 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <span className="animate-spin text-sm">⏳</span>
            <span>{uploadProgress}</span>
          </div>
        )}
      </div>

      {/* Global Documents Table */}
      <div>
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Active Reference Textbooks ({globalDocs.length})
        </h2>

        {globalDocs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-500">
            No global academic reference documents have been indexed yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900/60 font-semibold text-zinc-700 dark:text-zinc-300">
                <tr>
                  <th className="px-4 py-3 text-left">Document Title</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Pages</th>
                  <th className="px-4 py-3 text-left">Chunks</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {globalDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {doc.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {doc.subject}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {doc.pageCount || 1}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {doc.chunkCount || 0}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/api/library/${doc.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          View ↗
                        </a>
                        <button
                          onClick={() => handleDelete(doc)}
                          disabled={isDeleting === doc.id}
                          className="rounded-lg text-rose-600 hover:bg-rose-50 px-2 py-1 text-xs dark:hover:bg-rose-950/40 transition-colors"
                        >
                          {isDeleting === doc.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

