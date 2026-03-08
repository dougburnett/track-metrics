"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/");
  };

  return (
    <div className="flex h-full items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-[390px] flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-[var(--primary)] flex items-center justify-center">
            <span className="font-primary text-[var(--primary-foreground)] text-xl font-bold">
              TM
            </span>
          </div>
          <h1 className="font-primary text-2xl font-bold text-[var(--foreground)]">
            Track Metrics
          </h1>
          <p className="font-secondary text-sm text-[var(--muted-foreground)]">
            Record athletic performance in real time
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="w-full flex flex-col gap-4 bg-[var(--card)] border border-[var(--border)] p-6 rounded-none shadow-sm"
        >
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@school.edu"
              className="h-10 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--input)] px-4 font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full h-10 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--input)] px-4 pr-10 font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="h-12 rounded-[var(--radius-pill)] bg-[var(--primary)] font-primary text-base font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
          >
            Sign In
          </button>

          <button
            type="button"
            className="font-secondary text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
          >
            Forgot Password?
          </button>
        </form>
      </div>
    </div>
  );
}
