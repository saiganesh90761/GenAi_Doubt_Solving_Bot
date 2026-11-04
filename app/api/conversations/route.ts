import { verifyToken } from "@/lib/auth";
import {
  getUserConversations,
  saveUserConversation,
  deleteUserConversation,
} from "@/lib/conversations";

function getUserId(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const verified = verifyToken(authHeader.slice(7));
    if (verified) return verified.userId;
  }
  // Optional fallback from query or custom header for compatibility
  const url = new URL(request.url);
  const fallbackId = request.headers.get("x-user-id") || url.searchParams.get("userId");
  return fallbackId || null;
}

export async function GET(request: Request) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ conversations: [] }, { status: 401 });
  }

  const conversations = await getUserConversations(userId);
  return Response.json({ conversations });
}

export async function POST(request: Request) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const saved = await saveUserConversation(userId, body);
    return Response.json({ conversation: saved });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to save conversation";
    return Response.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const userId = getUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const convId = searchParams.get("id");
  if (!convId) {
    return Response.json({ error: "Missing conversation id" }, { status: 400 });
  }

  const deleted = await deleteUserConversation(userId, convId);
  return Response.json({ success: deleted });
}

