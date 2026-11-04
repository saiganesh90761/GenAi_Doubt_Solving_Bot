import { registerUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();
    const result = registerUser(name, email, password);
    return Response.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}

