"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase";
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js";

export type UserRole = "super_admin" | "admin" | "athlete";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let claimedInvite = false;
    let roleLoadedFor: string | null = null;

    function loadRole(userId: string) {
      if (roleLoadedFor === userId) return;
      roleLoadedFor = userId;
      // Fire in background — never block rendering
      (async () => {
        if (!claimedInvite) {
          claimedInvite = true;
          try { await supabase.rpc("claim_invite"); } catch {}
        }
        console.log("[auth] loadRole: fetching profile...");
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .maybeSingle();
        console.log("[auth] loadRole: role=", data?.role, "error=", error?.message);
        setRole((data?.role as UserRole) ?? "athlete");
      })();
    }

    // Safety: if onAuthStateChange never fires, unblock after 3s
    let timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      console.warn("[auth] TIMEOUT: forcing loading=false after 3s");
      setLoading(false);
    }, 3000);

    // onAuthStateChange fires SIGNED_IN immediately — use it as primary auth source
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      const currentUser = session?.user ?? null;
      console.log("[auth] onAuthStateChange:", event, "user=", currentUser?.email ?? "null");
      if (timeout) { clearTimeout(timeout); timeout = null; }
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        loadRole(currentUser.id);
      } else {
        setRole(null);
      }
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = createClient();
    setUser(null);
    setRole(null);
    await supabase.auth.signOut();
  };

  const refreshRole = async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    setRole((data?.role as UserRole) ?? "athlete");
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
