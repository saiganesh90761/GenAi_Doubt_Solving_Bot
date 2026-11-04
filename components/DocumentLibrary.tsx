"use client";

import React, { useState, useRef, useMemo } from "react";
import { useToast } from "./Toast";
import type { DocumentRecord } from "@/lib/documents";

interface DocumentLibraryProps {
  documents: DocumentRecord[];
  onRefresh: () => Promise<void>;
  userId: string;
  onSelectForChat?: (docId: string) => void;
}

export function DocumentLibrary({
  documents,
  onRefresh,
  userId,
  onSelectForChat,
}: DocumentLibraryProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
  const [filterStatus, setFilterStatus] = useState<"all" | "ready" | "processing" | "error">("all");

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // File Upload Handler
  const handleUploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Only PDF files are supported.", "error");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      showToast("File size exceeds maximum limit of 25MB.", "error");
      return;
    }

    setIsUploading(true);
    setUploadStatusText(`Extracting & indexing ${file.name} in Qdrant Cloud…`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);
      formData.append("sessionId", userId);
      formData.append("scope", "private");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Upload failed for ${file.name}`);
      }

      showToast(`Indexed "${file.name}" (${data.chunkCount || 0} vectors in Qdrant Cloud)!`, "success");
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload error";
      showToast(msg, "error");
    } finally {
      setIsUploading(false);
      setUploadStatusText(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      void handleUploadFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleUploadFile(e.dataTransfer.files[0]);
    }
  };

  // Delete Document Handler
  const handleDeleteDocument = async (doc: DocumentRecord) => {
    if (!confirm(`Permanently delete "${doc.name}" and all its vector embeddings from Qdrant Cloud?`)) {
      return;
    }

    setIsDeleting(doc.id);
    try {
      const res = await fetch(`/api/library/${doc.id}`, {
        method: "DELETE",
        headers: { "x-session-id": userId },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete document");
      }

      showToast(`Removed "${doc.name}" from your Qdrant knowledge base.`, "success");
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Deletion failed";
      showToast(msg, "error");
    } finally {
      setIsDeleting(null);
    }
  };

  // Filtered & Sorted Documents
  const filteredDocs = useMemo(() => {
    return documents
      .filter((doc) => {
        const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus =
          filterStatus === "all"
            ? true
            : filterStatus === "ready"
            ? doc.status === "ready"
            : filterStatus === "error"
            ? doc.status === "error"
            : doc.status === "uploading" || doc.status === "processing";
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "size") return (b.fileSize || 0) - (a.fileSize || 0);
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [documents, searchQuery, filterStatus, sortBy]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 max-w-6xl mx-auto w-full space-y-6 animate-in fade-in duration-150">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header & Upload Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Academic Document Library</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Upload your course textbooks, lecture slides, and formula sheets. All materials are chunked and stored in Qdrant Cloud.
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition flex items-center gap-2 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Upload PDF</span>
        </button>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center cursor-pointer transition ${
          isDragging
            ? "border-indigo-500 bg-indigo-500/10"
            : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70"
        }`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-white">
          {isDragging ? "Drop your PDF here" : "Click or drag & drop engineering PDF files here"}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Max file size: 25MB • Automatically extracted & embedded in Qdrant Cloud
        </p>
      </div>

      {/* Upload Progress Banner */}
      {isUploading && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-xs text-indigo-300 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            <span className="font-medium">{uploadStatusText}</span>
          </div>
          <span className="font-mono text-[11px] text-indigo-400">INDEXING IN QDRANT</span>
        </div>
      )}

      {/* Controls Bar: Search, Filter, Sort */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by name…"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2 pl-9 text-xs text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filters & Sorters */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "all" | "ready" | "processing" | "error")}
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="ready">Indexed in Qdrant</option>
            <option value="processing">Processing</option>
            <option value="error">Failed</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "name" | "size")}
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="date">Sort by Recent</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
          </select>
        </div>
      </div>

      {/* Document Grid / Table */}
      {filteredDocs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-12 text-center">
          <p className="text-sm font-semibold text-white">No documents found</p>
          <p className="mt-1 text-xs text-zinc-400">
            {searchQuery
              ? `No documents match "${searchQuery}". Try clearing your search.`
              : "You haven't uploaded any PDF notes or textbooks yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-5 flex flex-col justify-between hover:border-zinc-700 transition space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                    <span className="text-xl">📄</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate" title={doc.name}>
                      {doc.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400">
                      <span>{doc.pageCount || 1} pages</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.fileSize)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold flex items-center gap-1 ${
                    doc.status === "ready"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : doc.status === "error"
                      ? "bg-red-500/10 text-red-400 border border-red-500/20"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      doc.status === "ready" ? "bg-emerald-400" : doc.status === "error" ? "bg-red-400" : "bg-amber-400 animate-ping"
                    }`}
                  />
                  <span>
                    {doc.status === "ready"
                      ? `${doc.chunkCount || 0} vectors`
                      : doc.status === "error"
                      ? "Failed"
                      : "Indexing"}
                  </span>
                </span>
              </div>

              {/* Error reason if any */}
              {doc.errorMessage && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-2.5 text-[11px] text-red-300">
                  {doc.errorMessage}
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                <a
                  href={`/api/library/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                >
                  <span>Read PDF</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>

                <div className="flex items-center gap-2">
                  {onSelectForChat && doc.status === "ready" && (
                    <button
                      onClick={() => onSelectForChat(doc.id)}
                      className="rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1 text-xs font-semibold transition"
                    >
                      Ask Doubts
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteDocument(doc)}
                    disabled={isDeleting === doc.id}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"
                    title="Delete document and vectors from Qdrant Cloud"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

