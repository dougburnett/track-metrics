"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useStore, type Athlete } from "@/lib/store";
import { createClient } from "@/lib/supabase";

interface Result {
  id: string;
  metricId: string;
  metricName: string;
  metricAcronym: string;
  category: string;
  value: number;
  unit: string;
  recordedAt: string;
  subValues: Record<string, number> | null;
}

interface MetricSummary {
  metricId: string;
  metricName: string;
  acronym: string;
  category: string;
  latest: number;
  previous: number | null;
  pctChange: number | null;
  unit: string;
  history: { value: number; date: string }[];
}

function AthleteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const athleteId = params.get("id");
  const { athletes, metrics, categories } = useStore();
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  const athlete: Athlete | undefined = athletes.find((a) => a.id === athleteId);

  // Load results for this athlete
  useEffect(() => {
    if (!athleteId) return;
    const supabase = createClient();

    async function loadResults() {
      const { data } = await supabase
        .from("results")
        .select("id, metric_id, value, unit, recorded_at, sub_values")
        .eq("athlete_id", athleteId)
        .order("recorded_at", { ascending: false });

      if (data) {
        setResults(
          data.map((r: { id: string; metric_id: string; value: number; unit: string; recorded_at: string; sub_values: Record<string, number> | null }) => {
            const metric = metrics.find((m) => m.id === r.metric_id);
            return {
              id: r.id,
              metricId: r.metric_id,
              metricName: metric?.name || "Unknown",
              metricAcronym: metric?.acronym || "?",
              category: metric?.category || "",
              value: Number(r.value),
              unit: r.unit,
              recordedAt: r.recorded_at,
              subValues: r.sub_values || null,
            };
          })
        );
      }
      setLoading(false);
    }

    loadResults();
  }, [athleteId, metrics]);

  // Build metric summaries
  const summaries: MetricSummary[] = useMemo(() => {
    const grouped: Record<string, Result[]> = {};
    results.forEach((r) => {
      if (!grouped[r.metricId]) grouped[r.metricId] = [];
      grouped[r.metricId].push(r);
    });

    return Object.entries(grouped).map(([metricId, entries]) => {
      // Already sorted desc by recorded_at
      const latest = entries[0];
      const previous = entries.length > 1 ? entries[1] : null;
      const pctChange =
        previous && previous.value !== 0
          ? ((latest.value - previous.value) / Math.abs(previous.value)) * 100
          : null;

      return {
        metricId,
        metricName: latest.metricName,
        acronym: latest.metricAcronym,
        category: latest.category,
        latest: latest.value,
        previous: previous?.value ?? null,
        pctChange,
        unit: latest.unit,
        history: entries
          .slice(0, 20)
          .reverse()
          .map((e) => ({
            value: e.value,
            date: new Date(e.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          })),
      };
    });
  }, [results]);

  // Filter by category
  const availableCategories = useMemo(() => {
    const cats = new Set(summaries.map((s) => s.category));
    return ["All", ...Array.from(cats).filter(Boolean).sort()];
  }, [summaries]);

  const filteredSummaries =
    activeCategory === "All"
      ? summaries
      : summaries.filter((s) => s.category === activeCategory);

  const filteredResults =
    activeCategory === "All"
      ? results
      : results.filter((r) => r.category === activeCategory);

  if (!athlete) {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
          <button onClick={() => router.push("/")} className="cursor-pointer">
            <ArrowLeft size={24} className="text-[var(--foreground)]" />
          </button>
          <h1 className="font-primary text-lg font-semibold text-[var(--foreground)]">
            Athlete Not Found
          </h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="font-secondary text-sm text-[var(--muted-foreground)]">
            This athlete could not be found.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
        <button onClick={() => router.push("/")} className="cursor-pointer">
          <ArrowLeft size={24} className="text-[var(--foreground)]" />
        </button>
        <h1 className="font-primary text-lg font-semibold text-[var(--foreground)]">
          {athlete.firstName} {athlete.lastName}
        </h1>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Athlete Info */}
        <div className="flex items-center gap-4 p-5 bg-[var(--card)] border-b border-[var(--border)]">
          <div className="w-14 h-14 rounded-full bg-[var(--primary)] flex items-center justify-center">
            <span className="font-primary text-xl font-bold text-[var(--primary-foreground)]">
              {athlete.firstName[0]}{athlete.lastName[0]}
            </span>
          </div>
          <div className="flex-1">
            <div className="font-primary text-lg font-semibold text-[var(--foreground)]">
              {athlete.firstName} {athlete.lastName}
            </div>
            <div className="font-secondary text-sm text-[var(--muted-foreground)]">
              Grade {athlete.grade} · {athlete.gender === "M" ? "Male" : "Female"}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        {summaries.length > 0 && (
          <div className="flex items-center gap-1 px-4 py-3 overflow-x-auto">
            {availableCategories.map((cat) => (
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
        )}

        {/* Key Metrics Cards */}
        {filteredSummaries.length > 0 ? (
          <>
            <div className="px-4 pb-3">
              <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                Key Metrics
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {filteredSummaries.map((s) => (
                  <div
                    key={s.metricId}
                    className="p-4 bg-[var(--card)] border border-[var(--border)]"
                  >
                    <div className="font-secondary text-xs text-[var(--muted-foreground)] mb-1">
                      {s.metricName}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-primary text-2xl font-bold text-[var(--foreground)]">
                        {s.latest}
                      </span>
                      {s.unit && (
                        <span className="font-secondary text-xs text-[var(--muted-foreground)]">
                          {s.unit}
                        </span>
                      )}
                    </div>
                    {s.pctChange !== null && (
                      <div className="flex items-center gap-1 mt-2">
                        {s.pctChange > 0 ? (
                          <TrendingUp size={14} className="text-[var(--color-success-foreground)]" />
                        ) : s.pctChange < 0 ? (
                          <TrendingDown size={14} className="text-[var(--color-error-foreground)]" />
                        ) : (
                          <Minus size={14} className="text-[var(--muted-foreground)]" />
                        )}
                        <span
                          className={`font-primary text-xs font-semibold ${
                            s.pctChange > 0
                              ? "text-[var(--color-success-foreground)]"
                              : s.pctChange < 0
                              ? "text-[var(--color-error-foreground)]"
                              : "text-[var(--muted-foreground)]"
                          }`}
                        >
                          {s.pctChange > 0 ? "+" : ""}
                          {s.pctChange.toFixed(1)}%
                        </span>
                        <span className="font-secondary text-xs text-[var(--muted-foreground)]">
                          vs prev
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Vertical Bar Charts */}
            <div className="px-4 pb-3">
              <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                Progress
              </h2>
              <div className="flex flex-col gap-4">
                {filteredSummaries
                  .filter((s) => s.history.length > 1)
                  .map((s) => {
                    const maxVal = Math.max(...s.history.map((h) => h.value));
                    const minSlots = 5;
                    const maxSlots = 20;
                    const slotCount = Math.max(minSlots, Math.min(maxSlots, s.history.length));
                    const slots: ({ value: number; date: string } | null)[] = [];
                    // Add actual data first (left to right, oldest to newest)
                    s.history.slice(-maxSlots).forEach((h) => slots.push(h));
                    // Pad with empty slots at the end if fewer than minSlots
                    for (let i = 0; i < slotCount - s.history.length; i++) {
                      slots.push(null);
                    }

                    return (
                      <div
                        key={s.metricId}
                        className="p-4 bg-[var(--card)] border border-[var(--border)]"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-secondary text-sm font-medium text-[var(--foreground)]">
                            {s.metricName}
                          </span>
                          <span className="font-primary text-xs text-[var(--muted-foreground)]">
                            {s.acronym}
                          </span>
                        </div>
                        <div className="flex items-end gap-1.5 sm:gap-2 h-32">
                          {slots.map((slot, i) => (
                            <div
                              key={i}
                              className="flex-1 flex flex-col items-center justify-end h-full"
                            >
                              {slot ? (
                                <>
                                  <span className="font-primary text-[9px] sm:text-[10px] text-[var(--foreground)] mb-0.5 leading-none">
                                    {slot.value}
                                  </span>
                                  <div
                                    className="w-full bg-[var(--primary)] rounded-t-sm transition-all"
                                    style={{
                                      height: `${maxVal > 0 ? (slot.value / maxVal) * 100 : 0}%`,
                                      minHeight: "4px",
                                    }}
                                  />
                                </>
                              ) : (
                                <div className="w-full h-1 bg-[var(--secondary)] rounded-sm" />
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Date labels */}
                        <div className="flex gap-1.5 sm:gap-2 mt-1">
                          {slots.map((slot, i) => (
                            <div
                              key={i}
                              className="flex-1 text-center"
                            >
                              <span className="font-secondary text-[8px] sm:text-[9px] text-[var(--muted-foreground)] leading-none">
                                {slot?.date?.replace(/\s/, "\n") || ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Results Table */}
            <div className="px-4 pb-6">
              <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                All Results ({filteredResults.length})
              </h2>
              <div className="bg-[var(--card)] border border-[var(--border)] overflow-hidden">
                {/* Table Header */}
                <div className="flex items-center px-4 py-2 bg-[var(--secondary)] border-b border-[var(--border)]">
                  <span className="flex-1 font-primary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Date
                  </span>
                  <span className="flex-1 font-primary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Metric
                  </span>
                  <span className="w-16 text-right font-primary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Value
                  </span>
                  <span className="w-16 text-right font-primary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                    Change
                  </span>
                </div>
                {/* Table Rows */}
                {filteredResults.map((r, idx) => {
                  // Find previous result for same metric
                  const sameMetric = filteredResults.filter(
                    (x) => x.metricId === r.metricId
                  );
                  const myIdx = sameMetric.findIndex((x) => x.id === r.id);
                  const prev = myIdx < sameMetric.length - 1 ? sameMetric[myIdx + 1] : null;
                  const pct =
                    prev && prev.value !== 0
                      ? ((r.value - prev.value) / Math.abs(prev.value)) * 100
                      : null;

                  return (
                    <div
                      key={r.id}
                      className="flex items-center px-4 py-2.5 border-b border-[var(--border)] last:border-b-0"
                    >
                      <span className="flex-1 font-secondary text-xs text-[var(--muted-foreground)]">
                        {new Date(r.recordedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="flex-1 font-secondary text-sm font-medium text-[var(--foreground)]">
                        {r.metricAcronym}
                      </span>
                      <span className="w-20 text-right font-primary text-sm font-semibold text-[var(--foreground)]">
                        {r.value}
                        {r.subValues && (
                          <span className="block font-secondary text-[9px] text-[var(--muted-foreground)] font-normal">
                            {Object.entries(r.subValues).map(([k, v]) => `${k}:${v}`).join(" ")}
                          </span>
                        )}
                      </span>
                      <span
                        className={`w-16 text-right font-primary text-xs font-semibold ${
                          pct === null
                            ? "text-[var(--muted-foreground)]"
                            : pct > 0
                            ? "text-[var(--color-success-foreground)]"
                            : pct < 0
                            ? "text-[var(--color-error-foreground)]"
                            : "text-[var(--muted-foreground)]"
                        }`}
                      >
                        {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-16 h-16 rounded-full bg-[var(--secondary)] flex items-center justify-center mb-4">
              <Minus size={24} className="text-[var(--muted-foreground)]" />
            </div>
            <p className="font-secondary text-sm font-medium text-[var(--foreground)] mb-1">
              No results yet
            </p>
            <p className="font-secondary text-xs text-[var(--muted-foreground)] text-center">
              Record metrics at a station to see this athlete&apos;s data here.
            </p>
          </div>
        )}
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
