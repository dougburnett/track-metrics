"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

const athleteData = {
  name: "Jordan Davis",
  initials: "JD",
  age: 16,
  team: "Varsity",
  events: "100m, 200m, Long Jump",
};

const metricHistory = [
  { id: 1, date: "Mar 7", metric: "RSI", value: "2.45", trend: "up", category: "Power" },
  { id: 2, date: "Mar 5", metric: "Sprint 40m", value: "5.08s", trend: "up", category: "Speed" },
  { id: 3, date: "Mar 3", metric: "Vertical Jump", value: '33"', trend: "up", category: "Power" },
  { id: 4, date: "Mar 1", metric: "Balance L", value: "42s", trend: "down", category: "Stability" },
  { id: 5, date: "Feb 28", metric: "RSI", value: "2.31", trend: "up", category: "Power" },
  { id: 6, date: "Feb 26", metric: "Sprint 40m", value: "5.12s", trend: "down", category: "Speed" },
  { id: 7, date: "Feb 24", metric: "Broad Jump", value: "8'4\"", trend: "up", category: "Power" },
  { id: 8, date: "Feb 20", metric: "Vertical Jump", value: '31"', trend: "down", category: "Power" },
];

const categories = ["All", "Power", "Speed", "Stability"];

function AthleteContent() {
  const router = useRouter();
  useSearchParams();
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered =
    activeCategory === "All"
      ? metricHistory
      : metricHistory.filter((m) => m.category === activeCategory);

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
        <button onClick={() => router.push("/")} className="cursor-pointer">
          <ArrowLeft size={24} className="text-[var(--foreground)]" />
        </button>
        <h1 className="font-primary text-lg font-semibold text-[var(--foreground)]">
          Athlete Profile
        </h1>
      </div>

      {/* Athlete Info */}
      <div className="flex items-center gap-4 p-5 bg-[var(--card)] border-b border-[var(--border)]">
        <div className="w-14 h-14 rounded-full bg-[var(--primary)] flex items-center justify-center">
          <span className="font-primary text-xl font-bold text-[var(--primary-foreground)]">
            {athleteData.initials}
          </span>
        </div>
        <div className="flex-1">
          <div className="font-primary text-lg font-semibold text-[var(--foreground)]">
            {athleteData.name}
          </div>
          <div className="font-secondary text-sm text-[var(--muted-foreground)]">
            Age {athleteData.age} · {athleteData.team}
          </div>
          <div className="font-secondary text-xs text-[var(--muted-foreground)]">
            {athleteData.events}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 px-4 py-3 overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-[var(--radius-pill)] font-secondary text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeCategory === cat
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Metric History */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        <div className="flex flex-col bg-[var(--card)] border border-[var(--border)]">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0"
            >
              <div className="flex-1 min-w-0">
                <div className="font-secondary text-sm font-medium text-[var(--foreground)]">
                  {entry.metric}
                </div>
                <div className="font-secondary text-xs text-[var(--muted-foreground)]">
                  {entry.date} · {entry.category}
                </div>
              </div>
              <span className="font-primary text-base font-semibold text-[var(--foreground)]">
                {entry.value}
              </span>
              {entry.trend === "up" ? (
                <TrendingUp size={16} className="text-[var(--color-success-foreground)]" />
              ) : (
                <TrendingDown size={16} className="text-[var(--color-error-foreground)]" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AthletePage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
      <AthleteContent />
    </Suspense>
  );
}
