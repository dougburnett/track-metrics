"use client";

import { useRouter } from "next/navigation";
import { Search, Settings, LogOut } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { DynamicIcon } from "@/components/DynamicIcon";

export default function Dashboard() {
  const router = useRouter();
  const { stations, metrics, athletes, loading } = useStore();
  const { role, signOut } = useAuth();
  const [search, setSearch] = useState("");

  const filteredAthletes = athletes.filter((a) => {
    const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
        <h1 className="font-headline text-lg text-[var(--foreground)]">
          CHS Metrics
        </h1>
        <div className="flex items-center gap-3">
          {role === "super_admin" && (
            <button onClick={() => router.push("/admin/metrics")} className="cursor-pointer" title="Settings">
              <Settings size={20} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors" />
            </button>
          )}
          <button onClick={async () => { await signOut(); router.push("/login"); router.refresh(); }} className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center cursor-pointer" title="Sign out">
            <LogOut size={16} className="text-[var(--primary-foreground)]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Station Selector */}
        <div className="px-4 pt-4 pb-4">
          <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
            Stations
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {stations.map((station) => {
              const assignedMetric = metrics.find(m => m.id === station.metricId);
              return (
                <button
                  key={station.id}
                  onClick={() => router.push(`/station?id=${station.id}`)}
                  className="flex flex-col gap-2 p-4 bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors cursor-pointer text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0">
                    <DynamicIcon name={station.icon} size={18} className="text-[var(--primary-foreground)]" />
                  </div>
                  <div>
                    <div className="font-headline text-sm text-[var(--foreground)]">
                      {station.name}
                    </div>
                    <div className="font-secondary text-xs text-[var(--muted-foreground)]">
                      {assignedMetric ? assignedMetric.name : station.description}
                    </div>
                    {station.location && (
                      <div className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5">
                        {station.location}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sticky Search + Athletes */}
        <div className="px-4 pb-6">
          <div className="sticky top-0 z-10 bg-[var(--background)] pb-3 pt-1">
            <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
              Athletes ({filteredAthletes.length})
            </h2>
            <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-pill)] px-4 h-10">
              <Search size={16} className="text-[var(--muted-foreground)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search athletes..."
                className="flex-1 bg-transparent font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col bg-[var(--card)] border border-[var(--border)]">
            {filteredAthletes.map((athlete) => (
              <button
                key={athlete.id}
                onClick={() => router.push(`/athlete?id=${athlete.id}`)}
                className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)] transition-colors cursor-pointer text-left"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--secondary)] flex items-center justify-center shrink-0">
                  <span className="font-mono text-xs font-semibold text-[var(--secondary-foreground)]">
                    {athlete.firstName[0]}{athlete.lastName[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-secondary text-sm font-medium text-[var(--foreground)]">
                    {athlete.firstName} {athlete.lastName}
                  </div>
                  <div className="font-secondary text-xs text-[var(--muted-foreground)]">
                    Grade {athlete.grade} · {athlete.gender === "M" ? "Male" : "Female"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
