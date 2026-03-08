"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Mode = "signin" | "signup" | "forgot";

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState(params.get("error") === "auth_callback_failed" ? "Email verification failed. Please try again." : "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();
  const inputCls = "h-10 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--input)] px-4 font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)]";

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setMessage("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setMessage("");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email to confirm your account.");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setMessage("");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login`,
    });
    if (error) {
      setError(error.message);
    } else {
      setMessage("Check your email for a password reset link.");
    }
    setLoading(false);
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setError(""); setMessage("");
  };

  const title = mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Reset Password";
  const subtitle = mode === "signin"
    ? "Record athletic performance in real time"
    : mode === "signup"
    ? "Join your team on CHS App"
    : "Enter your email to receive a reset link";

  return (
    <div className="flex h-full items-start justify-center bg-[var(--background)] px-6 pt-[15vh]">
      <div className="w-full max-w-[390px] flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="Canby Cougars" width={72} height={72} className="w-[72px] h-[72px]" />
          <h1 className="font-headline text-3xl text-[var(--foreground)]">Canby Track Metrics</h1>
          <p className="font-secondary text-sm text-[var(--muted-foreground)]">{subtitle}</p>
        </div>

        <form
          onSubmit={mode === "signin" ? handleSignIn : mode === "signup" ? handleSignUp : handleForgotPassword}
          className="w-full flex flex-col gap-4 bg-[var(--card)] border border-[var(--border)] p-6 rounded-none shadow-sm"
        >
          {mode === "signup" && (
            <div className="flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className={inputCls}
                required
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@school.edu"
              className={inputCls}
              required
            />
          </div>

          {mode !== "forgot" && (
            <div className="flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className={"w-full pr-10 " + inputCls}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="font-secondary text-sm text-[var(--destructive)]">{error}</p>
          )}
          {message && (
            <p className="font-secondary text-sm text-[var(--foreground)] bg-[var(--color-success)] px-3 py-2 rounded-[var(--radius-m)]">{message}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-12 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-base font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? "..." : title}
          </button>

          {mode === "signin" && (
            <>
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                className="font-secondary text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
              >
                Forgot Password?
              </button>
              <p className="font-secondary text-sm text-center text-[var(--muted-foreground)]">
                Don&apos;t have an account?{" "}
                <button type="button" onClick={() => switchMode("signup")} className="text-[var(--primary)] hover:underline cursor-pointer font-medium">
                  Sign Up
                </button>
              </p>
            </>
          )}

          {mode === "signup" && (
            <p className="font-secondary text-sm text-center text-[var(--muted-foreground)]">
              Already have an account?{" "}
              <button type="button" onClick={() => switchMode("signin")} className="text-[var(--primary)] hover:underline cursor-pointer font-medium">
                Sign In
              </button>
            </p>
          )}

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="font-secondary text-sm text-[var(--primary)] hover:underline cursor-pointer"
            >
              Back to Sign In
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center bg-[var(--background)]"><span className="font-secondary text-sm text-[var(--muted-foreground)]">Loading...</span></div>}>
      <LoginContent />
    </Suspense>
  );
}
