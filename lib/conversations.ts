import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { supabase } from "./supabase";
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

function loadLocalConversations(): Conversation[] {
  ensureStorageDir();
  if (!existsSync(CONV_FILE)) return [];
  try {
    const raw = readFileSync(CONV_FILE, "utf8");
    return JSON.parse(raw) as Conversation[];
  } catch {
    return [];
  }
}

function saveLocalConversations(conversations: Conversation[]): void {
  ensureStorageDir();
  writeFileSync(CONV_FILE, JSON.stringify(conversations, null, 2), "utf8");
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
  // 1. Try Supabase Cloud table
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data.map((row) => ({
        id: String(row.id),
        userId: String(row.user_id),
        title: String(row.title || "New Doubt Session"),
        messages: Array.isArray(row.messages) ? (row.messages as ChatMessage[]) : [],
        createdAt: Number(row.created_at) || Date.now(),
        updatedAt: Number(row.updated_at) || Date.now(),
      }));
    }
  } catch {
    // fallback to local mirror
  }

  // 2. Fallback to local storage mirror
  const all = loadLocalConversations();
  return all
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveUserConversation(
  userId: string,
  conv: { id: string; title: string; messages: ChatMessage[] },
): Promise<Conversation> {
  const now = Date.now();
  const title = conv.title || "New Doubt Session";
  const messages = conv.messages || [];

  const conversationRecord: Conversation = {
    id: conv.id,
    userId,
    title,
    messages,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Mirror to local storage
  try {
    const all = loadLocalConversations();
    const index = all.findIndex((c) => c.id === conv.id && c.userId === userId);
    if (index >= 0) {
      all[index] = {
        ...all[index],
        title,
        messages,
        updatedAt: now,
      };
      saveLocalConversations(all);
    } else {
      all.unshift(conversationRecord);
      saveLocalConversations(all);
    }
  } catch {
    // ignore
  }

  // 2. Persist to Supabase Cloud table
  try {
    await supabase.from("conversations").upsert({
      id: conv.id,
      user_id: userId,
      title,
      messages,
      updated_at: now,
    });
  } catch (err) {
    console.warn("[Supabase] Failed to persist conversation row to cloud:", err);
  }

  return conversationRecord;
}

export async function deleteUserConversation(userId: string, convId: string): Promise<boolean> {
  // 1. Delete from Supabase Cloud table
  try {
    await supabase
      .from("conversations")
      .delete()
      .eq("id", convId)
      .eq("user_id", userId);
  } catch {
    // ignore
  }

  // 2. Delete from local storage
  const all = loadLocalConversations();
  const filtered = all.filter((c) => !(c.id === convId && c.userId === userId));
  if (filtered.length !== all.length) {
    saveLocalConversations(filtered);
    return true;
  }
  return false;
}
