"use client";

import { useRouter } from "next/navigation";
import { Search, Settings, User, LayoutGrid, Users, Trophy, ChevronLeft } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import type { Metric } from "@/lib/store";
import { DynamicIcon } from "@/components/DynamicIcon";
import { Skeleton } from "@/components/Skeleton";

export default function Dashboard() {
  const router = useRouter();
  const { stations, metrics, athletes, loading } = useStore();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "athletes" | "leaderboards">("overview");
  const [search, setSearch] = useState("");
  const [genderTab, setGenderTab] = useState<"M" | "F">("M");
  const [athletesWithData, setAthletesWithData] = useState<Set<string>>(new Set());
  const [athleteGenderFilter, setAthleteGenderFilter] = useState<"all" | "M" | "F">("all");
  const [athleteGradeFilter, setAthleteGradeFilter] = useState<number | "all">("all");
  const [lbGenderFilter, setLbGenderFilter] = useState<"all" | "M" | "F">("all");
  const [lbGradeFilter, setLbGradeFilter] = useState<number | "all">("all");
  const [lbExpandedMetric, setLbExpandedMetric] = useState<string | null>(null);
  const [bestResults, setBestResults] = useState<{ athlete_id: string; metric_id: string; value: number }[]>([]);

  // Load which athletes have any results (distinct)
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("results")
      .select("athlete_id")
      .limit(500)
      .then((res: { data: { athlete_id: string }[] | null }) => {
        if (res.data) {
          const ids = new Set(res.data.map((r) => r.athlete_id));
          setAthletesWithData(ids);
        }
      });
  }, []);

  // Load best results for leaderboards
  useEffect(() => {
    if (metrics.length === 0) return;
    const supabase = createClient();
    const metricIds = metrics.map((m) => m.id);
    supabase.rpc("best_results", { metric_ids: metricIds }).then(({ data }: { data: { athlete_id: string; metric_id: string; value: number }[] | null }) => {
      if (data) {
        setBestResults(
          (data as { athlete_id: string; metric_id: string; value: number }[]).map((r) => ({
            athlete_id: r.athlete_id,
            metric_id: r.metric_id,
            value: Number(r.value),
          }))
        );
      }
    });
  }, [metrics]);

  // Compute leaderboard data per metric, filtered by gender/grade
  const leaderboardData = useMemo(() => {
    const athleteMap = new Map(athletes.map((a) => [a.id, a]));
    const result: Record<string, { athlete: typeof athletes[0]; value: number }[]> = {};
    for (const m of metrics) {
      const entries = bestResults
        .filter((r) => r.metric_id === m.id)
        .map((r) => {
          const athlete = athleteMap.get(r.athlete_id);
          if (!athlete) return null;
          if (lbGenderFilter !== "all" && athlete.gender !== lbGenderFilter) return null;
          if (lbGradeFilter !== "all" && athlete.grade !== lbGradeFilter) return null;
          return { athlete, value: r.value };
        })
        .filter(Boolean) as { athlete: typeof athletes[0]; value: number }[];
      // Sort: lower is better → ascending, otherwise descending
      entries.sort((a, b) => m.lowerIsBetter ? a.value - b.value : b.value - a.value);
      if (entries.length > 0) {
        result[m.id] = entries;
      }
    }
    return result;
  }, [bestResults, athletes, metrics, lbGenderFilter, lbGradeFilter]);

  const formatValue = (value: number, metric: Metric) => {
    if (metric.unit === "seconds" || metric.unit === "s") {
      const mins = Math.floor(value / 60);
      const secs = value % 60;
      if (mins > 0) return `${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(2)}`;
      return `${secs.toFixed(2)}s`;
    }
    if (Number.isInteger(value)) return `${value}`;
    return `${value.toFixed(2)}`;
  };

  const filteredAthletes = athletes.filter((a) => {
    const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  const maleAthletes = filteredAthletes.filter((a) => a.gender === "M");
  const femaleAthletes = filteredAthletes.filter((a) => a.gender === "F");

  const athleteTabFiltered = filteredAthletes.filter((a) => {
    if (athleteGenderFilter !== "all" && a.gender !== athleteGenderFilter) return false;
    if (athleteGradeFilter !== "all" && a.grade !== athleteGradeFilter) return false;
    return true;
  });

  const renderAthleteRow = (athlete: typeof athletes[0], compact: boolean) => (
    <button
      key={athlete.id}
      onClick={() => router.push(`/athlete?id=${athlete.id}`)}
      className={`flex items-center ${compact ? "gap-2 px-3 py-2" : "gap-3 px-4 py-2.5"} border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)] transition-colors cursor-pointer text-left`}
    >
      <div className={`${compact ? "w-7 h-7" : "w-8 h-8"} rounded-full bg-[var(--secondary)] flex items-center justify-center shrink-0`}>
        <span className="font-mono text-[10px] font-semibold text-[var(--secondary-foreground)]">
          {athlete.firstName[0]}{athlete.lastName[0]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-secondary ${compact ? "text-xs" : "text-sm"} font-medium text-[var(--foreground)] truncate`}>
          {athlete.firstName} {athlete.lastName}
        </div>
        <div className={`font-secondary ${compact ? "text-[10px]" : "text-xs"} text-[var(--muted-foreground)]`}>
          {compact ? `Gr ${athlete.grade}` : `Grade ${athlete.grade}`}
        </div>
      </div>
      {athletesWithData.has(athlete.id) && (
        <div className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0" />
      )}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
        <h1 className="font-headline text-2xl text-[var(--foreground)]">
          Canby Track Metrics
        </h1>
        <div className="flex items-center gap-3">
          {(role === "super_admin" || role === "admin") && (
            <button onClick={() => router.push("/admin/metrics")} className="cursor-pointer" title="Settings">
              <Settings size={20} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors" />
            </button>
          )}
          <button onClick={() => router.push("/profile")} className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center cursor-pointer" title="Profile">
            <User size={16} className="text-[var(--primary-foreground)]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === "overview" ? (
          <>
            {/* Station Selector */}
            <div className="px-4 pt-3 pb-3">
              <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                Stations
              </h2>
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-20" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {stations.map((station) => {
                  const stationMetrics = station.metricIds.map(id => metrics.find(m => m.id === id)).filter(Boolean) as typeof metrics;
                  const metricLabel = stationMetrics.length === 0
                    ? station.description
                    : stationMetrics.length === 1
                    ? stationMetrics[0].name
                    : `${stationMetrics[0].name} (+${stationMetrics.length - 1})`;
                  return (
                    <button
                      key={station.id}
                      onClick={() => router.push(`/station?id=${station.id}`)}
                      className="flex items-center gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)] hover:border-[var(--primary)] transition-colors cursor-pointer text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0">
                        <DynamicIcon name={station.icon} size={16} className="text-[var(--primary-foreground)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-headline text-sm text-[var(--foreground)] truncate">
                          {station.name}
                        </div>
                        <div className="font-secondary text-xs text-[var(--muted-foreground)] truncate">
                          {metricLabel}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              )}
            </div>

            {/* Athletes Section (Overview) */}
            <div className="px-4 pb-6">
              <div className="sticky top-0 z-10 bg-[var(--background)] pb-2 pt-1">
                <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
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

              {loading ? (
                <div className="flex flex-col gap-1">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-[var(--card)] border-b border-[var(--border)]">
                      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <>
              {/* Gender tabs for narrow screens < 350px */}
              <div className="flex gap-1 mb-2 min-[350px]:hidden">
                <button
                  onClick={() => setGenderTab("M")}
                  className={`flex-1 py-1.5 font-secondary text-xs font-semibold text-center transition-colors cursor-pointer ${
                    genderTab === "M"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]"
                  }`}
                >
                  Men ({maleAthletes.length})
                </button>
                <button
                  onClick={() => setGenderTab("F")}
                  className={`flex-1 py-1.5 font-secondary text-xs font-semibold text-center transition-colors cursor-pointer ${
                    genderTab === "F"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]"
                  }`}
                >
                  Women ({femaleAthletes.length})
                </button>
              </div>

              {/* Single column (narrow < 350px) */}
              <div className="min-[350px]:hidden">
                <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                  {(genderTab === "M" ? maleAthletes : femaleAthletes).map((a) =>
                    renderAthleteRow(a, false)
                  )}
                </div>
              </div>

              {/* Two columns (>= 350px) */}
              <div className="hidden min-[350px]:grid grid-cols-2 gap-3">
                <div>
                  <h3 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                    Men ({maleAthletes.length})
                  </h3>
                  <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                    {maleAthletes.map((a) => renderAthleteRow(a, true))}
                  </div>
                </div>
                <div>
                  <h3 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                    Women ({femaleAthletes.length})
                  </h3>
                  <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                    {femaleAthletes.map((a) => renderAthleteRow(a, true))}
                  </div>
                </div>
              </div>
              </>
              )}
            </div>
          </>
        ) : activeTab === "athletes" ? (
          /* =================== ATHLETES TAB =================== */
          <div className="px-4 pb-6">
            <div className="sticky top-0 z-10 bg-[var(--background)] pb-2 pt-3">
              <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-pill)] px-4 h-10 mb-3">
                <Search size={16} className="text-[var(--muted-foreground)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search athletes..."
                  className="flex-1 bg-transparent font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
                />
              </div>
              {/* Gender filter */}
              <div className="flex items-center gap-1 mb-2">
                {([
                  { key: "all" as const, label: "All" },
                  { key: "M" as const, label: "Boys" },
                  { key: "F" as const, label: "Girls" },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setAthleteGenderFilter(tab.key)}
                    className={`px-3 py-1 rounded-full font-secondary text-xs font-semibold transition-colors cursor-pointer ${
                      athleteGenderFilter === tab.key
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "bg-[#D8D6CD] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <div className="w-px h-5 bg-[var(--border)] mx-1" />
                {/* Grade filter */}
                {([
                  { key: "all" as const, label: "All" },
                  { key: 9, label: "Fr" },
                  { key: 10, label: "So" },
                  { key: 11, label: "Jr" },
                  { key: 12, label: "Sr" },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setAthleteGradeFilter(tab.key)}
                    className={`px-3 py-1 rounded-full font-secondary text-xs font-semibold transition-colors cursor-pointer ${
                      athleteGradeFilter === tab.key
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "bg-[#D8D6CD] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="font-secondary text-[10px] text-[var(--muted-foreground)]">
                {athleteTabFiltered.length} athlete{athleteTabFiltered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col gap-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-[var(--card)] border-b border-[var(--border)]">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                {athleteTabFiltered.map((a) => renderAthleteRow(a, false))}
                {athleteTabFiltered.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <p className="font-secondary text-sm text-[var(--muted-foreground)]">No athletes match filters</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === "leaderboards" ? (
          /* =================== LEADERBOARDS TAB =================== */
          <div className="px-4 pb-6">
            {lbExpandedMetric ? (
              /* === Full metric leaderboard === */
              (() => {
                const metric = metrics.find((m) => m.id === lbExpandedMetric);
                if (!metric) return null;
                const entries = leaderboardData[metric.id] || [];
                const bestValue = entries[0]?.value ?? 0;
                return (
                  <>
                    <div className="sticky top-0 z-10 bg-[var(--background)] pb-2 pt-3">
                      <button
                        onClick={() => setLbExpandedMetric(null)}
                        className="flex items-center gap-1 text-[var(--primary)] font-secondary text-sm mb-2 cursor-pointer"
                      >
                        <ChevronLeft size={16} /> Back
                      </button>
                      <h2 className="font-headline text-lg text-[var(--foreground)] mb-2">
                        {metric.name}
                      </h2>
                      {/* Filters */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {([
                          { key: "all" as const, label: "All" },
                          { key: "M" as const, label: "Boys" },
                          { key: "F" as const, label: "Girls" },
                        ]).map((tab) => (
                          <button
                            key={tab.key}
                            onClick={() => setLbGenderFilter(tab.key)}
                            className={`px-3 py-1 rounded-full font-secondary text-xs font-semibold transition-colors cursor-pointer ${
                              lbGenderFilter === tab.key
                                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                : "bg-[#D8D6CD] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                        <div className="w-px h-5 bg-[var(--border)] mx-1" />
                        {([
                          { key: "all" as const, label: "All" },
                          { key: 9, label: "Fr" },
                          { key: 10, label: "So" },
                          { key: 11, label: "Jr" },
                          { key: 12, label: "Sr" },
                        ]).map((tab) => (
                          <button
                            key={tab.key}
                            onClick={() => setLbGradeFilter(tab.key)}
                            className={`px-3 py-1 rounded-full font-secondary text-xs font-semibold transition-colors cursor-pointer ${
                              lbGradeFilter === tab.key
                                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                : "bg-[#D8D6CD] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      <span className="font-secondary text-[10px] text-[var(--muted-foreground)] mt-1 block">
                        {entries.length} athlete{entries.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {entries.map((entry, i) => {
                        const pct = bestValue !== 0
                          ? metric.lowerIsBetter
                            ? (bestValue / entry.value) * 100
                            : (entry.value / bestValue) * 100
                          : 0;
                        return (
                          <button
                            key={entry.athlete.id}
                            onClick={() => router.push(`/athlete?id=${entry.athlete.id}`)}
                            className="flex items-center gap-3 cursor-pointer text-left"
                          >
                            <span className="font-mono text-xs text-[var(--muted-foreground)] w-6 text-right shrink-0">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="font-secondary text-sm text-[var(--foreground)] truncate">
                                  {entry.athlete.firstName} {entry.athlete.lastName}
                                </span>
                                <span className="font-mono text-xs text-[var(--foreground)] shrink-0 ml-2">
                                  {formatValue(entry.value, metric)} {metric.unit && !["seconds", "s"].includes(metric.unit) ? metric.unit : ""}
                                </span>
                              </div>
                              <div className="w-full h-2 bg-[#D8D6CD] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(pct, 2)}%`,
                                    backgroundColor: i === 0 ? "var(--primary)" : i < 3 ? "var(--primary)" : "var(--muted-foreground)",
                                    opacity: i < 3 ? 1 : 0.5,
                                  }}
                                />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      {entries.length === 0 && (
                        <div className="px-4 py-8 text-center">
                          <p className="font-secondary text-sm text-[var(--muted-foreground)]">No results for this filter</p>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()
            ) : (
              /* === Leaderboard overview: top 5 per metric === */
              <>
                <div className="sticky top-0 z-10 bg-[var(--background)] pb-2 pt-3">
                  {/* Filters */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {([
                      { key: "all" as const, label: "All" },
                      { key: "M" as const, label: "Boys" },
                      { key: "F" as const, label: "Girls" },
                    ]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setLbGenderFilter(tab.key)}
                        className={`px-3 py-1 rounded-full font-secondary text-xs font-semibold transition-colors cursor-pointer ${
                          lbGenderFilter === tab.key
                            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : "bg-[#D8D6CD] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                    <div className="w-px h-5 bg-[var(--border)] mx-1" />
                    {([
                      { key: "all" as const, label: "All" },
                      { key: 9, label: "Fr" },
                      { key: 10, label: "So" },
                      { key: 11, label: "Jr" },
                      { key: 12, label: "Sr" },
                    ]).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setLbGradeFilter(tab.key)}
                        className={`px-3 py-1 rounded-full font-secondary text-xs font-semibold transition-colors cursor-pointer ${
                          lbGradeFilter === tab.key
                            ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                            : "bg-[#D8D6CD] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {metrics
                    .filter((m) => leaderboardData[m.id] && leaderboardData[m.id].length > 0)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((metric) => {
                      const entries = leaderboardData[metric.id];
                      const top5 = entries.slice(0, 5);
                      const bestValue = top5[0]?.value ?? 0;
                      return (
                        <div key={metric.id} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)] p-3 flex flex-col">
                          <h3 className="font-headline text-sm text-[var(--foreground)] mb-2">
                            {metric.name}
                          </h3>
                          <div className="flex flex-col gap-1.5 flex-1">
                            {top5.map((entry, i) => {
                              const pct = bestValue !== 0
                                ? metric.lowerIsBetter
                                  ? (bestValue / entry.value) * 100
                                  : (entry.value / bestValue) * 100
                                : 0;
                              return (
                                <button
                                  key={entry.athlete.id}
                                  onClick={() => router.push(`/athlete?id=${entry.athlete.id}`)}
                                  className="flex items-center gap-2 cursor-pointer text-left"
                                >
                                  <span className="font-mono text-[10px] text-[var(--muted-foreground)] w-4 text-right shrink-0">
                                    {i + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="font-secondary text-[10px] text-[var(--foreground)] truncate">
                                        {entry.athlete.firstName} {entry.athlete.lastName}
                                      </span>
                                      <span className="font-mono text-[9px] text-[var(--foreground)] shrink-0 ml-1">
                                        {formatValue(entry.value, metric)} {metric.unit && !["seconds", "s"].includes(metric.unit) ? metric.unit : ""}
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-[#D8D6CD] rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${Math.max(pct, 2)}%`,
                                          backgroundColor: i === 0 ? "var(--primary)" : i < 3 ? "var(--primary)" : "var(--muted-foreground)",
                                          opacity: i < 3 ? 1 : 0.5,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <button
                            onClick={() => setLbExpandedMetric(metric.id)}
                            className="mt-3 w-full py-1.5 rounded-[var(--radius-s)] border border-[var(--foreground)] text-[var(--foreground)] font-secondary text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            View all ({entries.length})
                          </button>
                        </div>
                      );
                    })}
                  {metrics.filter((m) => leaderboardData[m.id]).length === 0 && (
                    <div className="col-span-2 px-4 py-8 text-center">
                      <p className="font-secondary text-sm text-[var(--muted-foreground)]">No results yet</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center border-t border-[var(--border)] bg-[var(--card)]">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 cursor-pointer transition-colors ${
            activeTab === "overview" ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
          }`}
        >
          <LayoutGrid size={20} />
          <span className="font-secondary text-[10px] font-semibold">Overview</span>
        </button>
        <button
          onClick={() => setActiveTab("leaderboards")}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 cursor-pointer transition-colors ${
            activeTab === "leaderboards" ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
          }`}
        >
          <Trophy size={20} />
          <span className="font-secondary text-[10px] font-semibold">Leaderboards</span>
        </button>
        <button
          onClick={() => setActiveTab("athletes")}
          className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 cursor-pointer transition-colors ${
            activeTab === "athletes" ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
          }`}
        >
          <Users size={20} />
          <span className="font-secondary text-[10px] font-semibold">Athletes</span>
        </button>
      </div>
    </div>
  );
}
