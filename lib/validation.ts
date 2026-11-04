import crypto from "node:crypto";

export const MAX_FILE_SIZE_GLOBAL = 50 * 1024 * 1024; // 50 MB for global reference textbooks
export const MAX_FILE_SIZE_STUDENT = 15 * 1024 * 1024; // 15 MB for student personal uploads

export type ValidationResult = {
  valid: boolean;
  error?: string;
  fileHash: string;
  fileSize: number;
};

/**
 * Validates PDF file size, extension, MIME type, and binary magic bytes (%PDF-).
 * Computes SHA-256 hash for deduplication.
 */
export function validatePdfFile(
  bytes: Uint8Array,
  fileName: string,
  mimeType?: string,
  isGlobal = false,
): ValidationResult {
  const fileSize = bytes.length;
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  const maxBytes = isGlobal ? MAX_FILE_SIZE_GLOBAL : MAX_FILE_SIZE_STUDENT;

  if (fileSize === 0) {
    return {
      valid: false,
      error: "The uploaded file is empty (0 bytes).",
      fileHash: hash,
      fileSize,
    };
  }

  if (fileSize > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    return {
      valid: false,
      error: `File size exceeds the maximum limit of ${limitMb}MB.`,
      fileHash: hash,
      fileSize,
    };
  }

  const lowerName = fileName.toLowerCase();
  if (!lowerName.endsWith(".pdf")) {
    return {
      valid: false,
      error: "Invalid file extension. Only .pdf files are supported.",
      fileHash: hash,
      fileSize,
    };
  }

  if (mimeType && mimeType !== "application/pdf" && mimeType !== "application/x-pdf") {
    return {
      valid: false,
      error: `Invalid MIME type (${mimeType}). Only application/pdf is supported.`,
      fileHash: hash,
      fileSize,
    };
  }

  // Validate PDF magic bytes: %PDF- (hex: 0x25 0x50 0x44 0x46 0x2D)
  if (bytes.length < 5) {
    return {
      valid: false,
      error: "File is too small to be a valid PDF document.",
      fileHash: hash,
      fileSize,
    };
  }

  const header = Buffer.from(bytes.slice(0, 5)).toString("utf8");
  if (header !== "%PDF-") {
    return {
      valid: false,
      error: "Invalid PDF file signature. The file does not start with standard PDF header (%PDF-).",
      fileHash: hash,
      fileSize,
    };
  }

  return {
    valid: true,
    fileHash: hash,
    fileSize,
  };
}

