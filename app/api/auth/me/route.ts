import { verifyToken, getUserById } from "@/lib/auth";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return Response.json({ user: null }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const verified = verifyToken(token);
  if (!verified) {
    return Response.json({ user: null }, { status: 401 });
  }

  const user = getUserById(verified.userId);
  if (!user) {
    return Response.json({ user: null }, { status: 401 });
  }

  return Response.json({ user });
}

