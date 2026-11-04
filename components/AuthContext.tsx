"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  openAuth: (mode?: "login" | "register") => void;
  closeAuth: () => void;
  authModalOpen: boolean;
  authModalMode: "login" | "register";
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("login");

  // Sync Supabase Auth Session
  useEffect(() => {
    let ignore = false;

    async function initSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!ignore && data.session?.user) {
          const u = data.session.user;
          setUser({
            id: u.id,
            name: (u.user_metadata?.name as string) || u.email?.split("@")[0] || "Student",
            email: u.email || "",
          });
          setToken(data.session.access_token);
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
        const u = session.user;
        setUser({
          id: u.id,
          name: (u.user_metadata?.name as string) || u.email?.split("@")[0] || "Student",
          email: u.email || "",
        });
        setToken(session.access_token);
      } else {
        setUser(null);
        setToken(null);
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  const openAuth = useCallback((mode: "login" | "register" = "login") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      throw new Error(error.message || "Invalid login credentials.");
    }

    if (data.session?.user) {
      const u = data.session.user;
      setUser({
        id: u.id,
        name: (u.user_metadata?.name as string) || u.email?.split("@")[0] || "Student",
        email: u.email || "",
      });
      setToken(data.session.access_token);
      setAuthModalOpen(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: cleanName,
        },
      },
    });

    if (error) {
      throw new Error(error.message || "Registration failed.");
    }

    if (data.session?.user) {
      const u = data.session.user;
      setUser({
        id: u.id,
        name: cleanName || u.email?.split("@")[0] || "Student",
        email: u.email || "",
      });
      setToken(data.session.access_token);
      setAuthModalOpen(false);
    } else if (data.user) {
      // Supabase email confirmation might be enabled
      setUser({
        id: data.user.id,
        name: cleanName,
        email: data.user.email || cleanEmail,
      });
      setAuthModalOpen(false);
    }
  }, []);

  const logout = useCallback(async () => {
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
        login,
        register,
        logout,
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
