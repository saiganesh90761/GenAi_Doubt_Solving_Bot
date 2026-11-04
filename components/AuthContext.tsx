"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface UserPreferences {
  explanationDepth: "intuitive" | "standard" | "rigorous";
  mathDetail: "concise" | "step_by_step" | "exhaustive";
  theme: "dark" | "light" | "system";
}

export interface User {
  id: string;
  name: string;
  email: string;
  institution?: string;
  major?: string;
  year?: string;
  preferences?: UserPreferences;
  isGuest?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, institution?: string, major?: string) => Promise<void>;
  loginAsGuest: (guestName?: string, major?: string) => void;
  logout: () => void;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (updates: { name?: string; institution?: string; major?: string; year?: string }) => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  deleteAccount: () => Promise<void>;
  openAuth: (mode?: "login" | "register" | "forgot") => void;
  closeAuth: () => void;
  authModalOpen: boolean;
  authModalMode: "login" | "register" | "forgot";
}

const DEFAULT_PREFERENCES: UserPreferences = {
  explanationDepth: "standard",
  mathDetail: "step_by_step",
  theme: "dark",
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register" | "forgot">("login");

  const buildUserFromSession = (u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User => {
    const meta = u.user_metadata || {};
    return {
      id: u.id,
      name: (meta.name as string) || (meta.full_name as string) || u.email?.split("@")[0] || "Student",
      email: u.email || "",
      institution: (meta.institution as string) || "Engineering Faculty",
      major: (meta.major as string) || "General Engineering",
      year: (meta.year as string) || "Undergraduate",
      preferences: (meta.preferences as UserPreferences) || DEFAULT_PREFERENCES,
    };
  };

  // Sync Supabase Auth Session or Guest Session
  useEffect(() => {
    let ignore = false;

    async function initSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!ignore && data.session?.user) {
          setUser(buildUserFromSession(data.session.user));
          setToken(data.session.access_token);
          return;
        }

        // If no active Supabase session, check for persistent guest session
        if (!ignore && typeof window !== "undefined") {
          const savedGuest = localStorage.getItem("eds_guest_user");
          if (savedGuest) {
            try {
              const parsed = JSON.parse(savedGuest) as User;
              if (parsed && parsed.id) {
                setUser(parsed);
              }
            } catch {
              // ignore
            }
          }
        }
      } catch (err) {
        console.warn("[Supabase Auth] Session fetch notice:", err);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(buildUserFromSession(session.user));
        setToken(session.access_token);
        if (typeof window !== "undefined") {
          localStorage.removeItem("eds_guest_user");
        }
      } else {
        // If logged out from Supabase, only clear if not in guest mode
        if (typeof window !== "undefined") {
          const savedGuest = localStorage.getItem("eds_guest_user");
          if (savedGuest) {
            try {
              setUser(JSON.parse(savedGuest) as User);
              return;
            } catch {
              // ignore
            }
          }
        }
        setUser(null);
        setToken(null);
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  const openAuth = useCallback((mode: "login" | "register" | "forgot" = "login") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const loginAsGuest = useCallback((guestName = "Guest Student", guestMajor = "General Engineering") => {
    let existingGuestId = typeof window !== "undefined" ? localStorage.getItem("eds_guest_id") : null;
    if (!existingGuestId) {
      existingGuestId = `guest_${Math.random().toString(36).slice(2, 9)}`;
      if (typeof window !== "undefined") {
        localStorage.setItem("eds_guest_id", existingGuestId);
      }
    }

    const guestUser: User = {
      id: existingGuestId,
      name: guestName,
      email: `${existingGuestId}@engineering.local`,
      institution: "Guest Workspace",
      major: guestMajor,
      year: "1st Year Undergraduate",
      preferences: DEFAULT_PREFERENCES,
      isGuest: true,
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("eds_guest_user", JSON.stringify(guestUser));
    }

    setUser(guestUser);
    setToken(null);
    setAuthModalOpen(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("eds_guest_user");
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error(error.message || "Invalid login credentials.");
    }

    if (data.session?.user) {
      setUser(buildUserFromSession(data.session.user));
      setToken(data.session.access_token);
      setAuthModalOpen(false);
    }
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, institution?: string, major?: string) => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("eds_guest_user");
      }

      const cleanName = name.trim();
      const cleanEmail = email.trim();

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            name: cleanName,
            institution: institution?.trim() || "Engineering Faculty",
            major: major?.trim() || "General Engineering",
            preferences: DEFAULT_PREFERENCES,
          },
        },
      });

      if (error) {
        // If email rate limit was exceeded, check if the account was already registered and attempt immediate sign-in
        if (error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("exceeded")) {
          try {
            const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });
            if (!loginErr && loginData.session?.user) {
              setUser(buildUserFromSession(loginData.session.user));
              setToken(loginData.session.access_token);
              setAuthModalOpen(false);
              return;
            }
          } catch {
            // ignore and throw friendly error below
          }

          throw new Error(
            "Supabase email rate limit exceeded (Free tier limits default verification emails to 3/hour). To fix this instantly: In your Supabase Dashboard → Authentication → Providers → Email, turn OFF 'Confirm email', then click Create Account again."
          );
        }

        throw new Error(error.message || "Registration failed.");
      }

      if (data.session?.user) {
        setUser(buildUserFromSession(data.session.user));
        setToken(data.session.access_token);
        setAuthModalOpen(false);
      } else if (data.user) {
        setUser(buildUserFromSession(data.user));
        setAuthModalOpen(false);
      }
    },
    [],
  );

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
    });
    if (error) {
      throw new Error(error.message || "Could not send password reset email.");
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: { name?: string; institution?: string; major?: string; year?: string }) => {
      if (user?.isGuest) {
        const updated: User = {
          ...user,
          ...updates,
        };
        setUser(updated);
        if (typeof window !== "undefined") {
          localStorage.setItem("eds_guest_user", JSON.stringify(updated));
        }
        return;
      }

      const { data, error } = await supabase.auth.updateUser({
        data: updates,
      });
      if (error) {
        throw new Error(error.message || "Failed to update profile.");
      }
      if (data.user) {
        setUser(buildUserFromSession(data.user));
      }
    },
    [user],
  );

  const updatePreferences = useCallback(
    async (newPrefs: Partial<UserPreferences>) => {
      if (!user) return;
      const merged: UserPreferences = {
        ...(user.preferences || DEFAULT_PREFERENCES),
        ...newPrefs,
      };

      if (user.isGuest) {
        const updated: User = {
          ...user,
          preferences: merged,
        };
        setUser(updated);
        if (typeof window !== "undefined") {
          localStorage.setItem("eds_guest_user", JSON.stringify(updated));
        }
        return;
      }

      const { data, error } = await supabase.auth.updateUser({
        data: { preferences: merged },
      });
      if (error) {
        throw new Error(error.message || "Failed to update preferences.");
      }
      if (data.user) {
        setUser(buildUserFromSession(data.user));
      }
    },
    [user],
  );

  const deleteAccount = useCallback(async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("eds_guest_user");
      localStorage.removeItem("eds_guest_id");
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setToken(null);
  }, []);

  const logout = useCallback(async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("eds_guest_user");
    }
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isGuest: Boolean(user?.isGuest),
        login,
        register,
        loginAsGuest,
        logout,
        resetPassword,
        updateProfile,
        updatePreferences,
        deleteAccount,
        openAuth,
        closeAuth,
        authModalOpen,
        authModalMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
