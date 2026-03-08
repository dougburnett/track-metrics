"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";

export default function ProfilePage() {
  const router = useRouter();
  const { user, role, signOut, refreshRole } = useAuth();

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nameSaving, setNameSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [nameMsg, setNameMsg] = useState("");
  const [emailMsg, setEmailMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  const inputCls = "h-10 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--input)] px-4 font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)] w-full";

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameSaving(true);
    setNameMsg("");
    const supabase = createClient();

    const { error: authError } = await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
    if (authError) {
      setNameMsg(authError.message);
      setNameSaving(false);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user!.id);

    if (profileError) {
      setNameMsg(profileError.message);
    } else {
      setNameMsg("Name updated");
      refreshRole();
    }
    setNameSaving(false);
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailSaving(true);
    setEmailMsg("");
    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({ email });
    if (error) {
      setEmailMsg(error.message);
    } else {
      setEmailMsg("Confirmation email sent. Check your inbox.");
    }
    setEmailSaving(false);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMsg("");

    if (newPassword.length < 6) {
      setPasswordMsg("Password must be at least 6 characters");
      setPasswordSaving(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Passwords do not match");
      setPasswordSaving(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg(error.message);
    } else {
      setPasswordMsg("Password updated");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordSaving(false);
  };

  const roleLabel = role === "super_admin" ? "Super Admin" : role === "admin" ? "Admin" : "Athlete";

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
        <button onClick={() => router.push("/")} className="cursor-pointer">
          <ArrowLeft size={24} className="text-[var(--foreground)]" />
        </button>
        <h1 className="font-headline text-lg text-[var(--foreground)]">Profile</h1>
      </div>

      <div className="flex-1 overflow-auto p-4 flex flex-col gap-6">
        {/* Role display */}
        <div className="flex items-center gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-m)]">
          <span className="font-secondary text-sm font-medium text-[var(--foreground)]">Role</span>
          <span className="ml-auto font-secondary text-sm text-[var(--muted-foreground)]">{roleLabel}</span>
        </div>

        {/* Name section */}
        <form onSubmit={handleSaveName} className="flex flex-col gap-2">
          <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Name</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className={inputCls}
          />
          {nameMsg && (
            <p className="font-secondary text-xs text-[var(--muted-foreground)]">{nameMsg}</p>
          )}
          <button
            type="submit"
            disabled={nameSaving}
            className="self-end h-10 px-6 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {nameSaving ? "Saving..." : "Save Name"}
          </button>
        </form>

        {/* Email section */}
        <form onSubmit={handleSaveEmail} className="flex flex-col gap-2">
          <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className={inputCls}
          />
          {emailMsg && (
            <p className="font-secondary text-xs text-[var(--muted-foreground)]">{emailMsg}</p>
          )}
          <button
            type="submit"
            disabled={emailSaving}
            className="self-end h-10 px-6 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {emailSaving ? "Saving..." : "Save Email"}
          </button>
        </form>

        {/* Password section */}
        <form onSubmit={handleSavePassword} className="flex flex-col gap-2">
          <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className={inputCls}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className={inputCls}
          />
          {passwordMsg && (
            <p className="font-secondary text-xs text-[var(--muted-foreground)]">{passwordMsg}</p>
          )}
          <button
            type="submit"
            disabled={passwordSaving}
            className="self-end h-10 px-6 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
          >
            {passwordSaving ? "Saving..." : "Update Password"}
          </button>
        </form>

        {/* Sign Out */}
        <button
          onClick={async () => {
            await signOut();
            router.push("/login");
            router.refresh();
          }}
          className="flex items-center justify-center gap-2 h-12 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--border)] font-secondary text-sm font-medium text-[var(--destructive)] hover:bg-[var(--secondary)] transition-colors cursor-pointer mt-4 mb-6"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
