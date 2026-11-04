import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();
    const cleanEmail = email?.trim();
    const cleanName = name?.trim();

    if (!cleanEmail || !password) {
      return Response.json({ error: "Email and password are required." }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { name: cleanName },
      },
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const user = data.user
      ? {
          id: data.user.id,
          name: cleanName || data.user.email?.split("@")[0] || "Student",
          email: data.user.email || cleanEmail,
        }
      : null;

    return Response.json({ user, token: data.session?.access_token || null });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Registration failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
