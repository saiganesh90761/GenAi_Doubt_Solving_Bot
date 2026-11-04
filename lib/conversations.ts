import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { ChatSource } from "./types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  error?: boolean;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_DIR = path.join(process.cwd(), "data", "storage");
const CONV_FILE = path.join(STORAGE_DIR, "conversations.json");

function ensureStorageDir() {
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function loadAllConversations(): Conversation[] {
  ensureStorageDir();
  if (!existsSync(CONV_FILE)) return [];
  try {
    const raw = readFileSync(CONV_FILE, "utf8");
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

function saveAllConversations(conversations: Conversation[]): void {
  ensureStorageDir();
  writeFileSync(CONV_FILE, JSON.stringify(conversations, null, 2), "utf8");
}

export function getUserConversations(userId: string): Conversation[] {
  const all = loadAllConversations();
  return all
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveUserConversation(
  userId: string,
  conv: { id: string; title: string; messages: ChatMessage[] },
): Conversation {
  const all = loadAllConversations();
  const index = all.findIndex((c) => c.id === conv.id && c.userId === userId);
  const now = Date.now();

  if (index >= 0) {
    all[index] = {
      ...all[index],
      title: conv.title,
      messages: conv.messages,
      updatedAt: now,
    };
    saveAllConversations(all);
    return all[index];
  } else {
    const newConv: Conversation = {
      id: conv.id,
      userId,
      title: conv.title || "New Doubt Session",
      messages: conv.messages || [],
      createdAt: now,
      updatedAt: now,
    };
    all.unshift(newConv);
    saveAllConversations(all);
    return newConv;
  }
}

export function deleteUserConversation(userId: string, convId: string): boolean {
  const all = loadAllConversations();
  const filtered = all.filter((c) => !(c.id === convId && c.userId === userId));
  if (filtered.length !== all.length) {
    saveAllConversations(filtered);
    return true;
  }
  return false;
}
