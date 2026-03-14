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

    async function loadRole(userId: string) {
      // Fire claim_invite in background — never block auth on it
      if (!claimedInvite) {
        claimedInvite = true;
        (async () => { try { await supabase.rpc("claim_invite"); } catch {} })();
      }

      console.log("[auth] loadRole: fetching profile...");
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      console.log("[auth] loadRole: role=", data?.role, "error=", error?.message);
      setRole((data?.role as UserRole) ?? "athlete");
    }

    async function loadUser() {
      try {
        console.log("[auth] loadUser: calling getSession...");
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        console.log("[auth] loadUser: user=", currentUser?.email ?? "null");
        setUser(currentUser);
        if (currentUser) {
          await loadRole(currentUser.id);
        }
      } catch (e) {
        console.error("[auth] loadUser error:", e);
      }
      console.log("[auth] loadUser: done, setting loading=false");
      setLoading(false);
    }

    // Timeout: if auth takes more than 6s, stop blocking the app
    const timeout = setTimeout(() => {
      console.warn("[auth] TIMEOUT: forcing loading=false after 6s");
      setLoading(false);
    }, 6000);
    loadUser().finally(() => clearTimeout(timeout));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      const currentUser = session?.user ?? null;
      console.log("[auth] onAuthStateChange:", event, "user=", currentUser?.email ?? "null");
      setUser(currentUser);
      // Only reload role on actual auth events, not token refreshes
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        if (currentUser) await loadRole(currentUser.id);
      } else if (event === "SIGNED_OUT") {
        setRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
