import { loginUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const result = loginUser(email, password);
    return Response.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid credentials.";
    return Response.json({ error: message }, { status: 401 });
  }
}
