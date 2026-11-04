import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const cleanEmail = email?.trim();

    if (!cleanEmail || !password) {
      return Response.json({ error: "Email and password are required." }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    const user = data.user
      ? {
          id: data.user.id,
          name: (data.user.user_metadata?.name as string) || data.user.email?.split("@")[0] || "Student",
          email: data.user.email || cleanEmail,
        }
      : null;

    return Response.json({ user, token: data.session?.access_token || null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid credentials.";
    return Response.json({ error: message }, { status: 401 });
  }
}
