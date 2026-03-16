"use client";

import { useRouter } from "next/navigation";
import { Search, Settings, User, LayoutGrid, Users, Trophy, ChevronLeft, ClipboardCheck, ChevronDown, Check, X } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import type { Metric } from "@/lib/store";
import { DynamicIcon } from "@/components/DynamicIcon";
import { Skeleton } from "@/components/Skeleton";

export default function Dashboard() {
  const router = useRouter();
  const { stations, metrics, athletes, loading } = useStore();
  const { role, user } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const [activeTab, setActiveTab] = useState<"overview" | "athletes" | "leaderboards" | "attendance">("overview");
  const [search, setSearch] = useState("");
  const [genderTab, setGenderTab] = useState<"M" | "F">("M");
  const [athletesWithData, setAthletesWithData] = useState<Set<string>>(new Set());
  const [athleteGenderFilter, setAthleteGenderFilter] = useState<"all" | "M" | "F">("all");
  const [athleteGradeFilter, setAthleteGradeFilter] = useState<number | "all">("all");
  const [athleteResultsFilter, setAthleteResultsFilter] = useState<"all" | "has" | "none">("all");
  const [lbGenderFilter, setLbGenderFilter] = useState<"all" | "M" | "F">("all");
  const [lbGradeFilter, setLbGradeFilter] = useState<number | "all">("all");
  const [lbExpandedMetric, setLbExpandedMetric] = useState<string | null>(null);
  const [lbCategoryFilter, setLbCategoryFilter] = useState<string>("all");
  const [bestResults, setBestResults] = useState<{ athlete_id: string; metric_id: string; value: number }[]>([]);

  // Attendance state
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [attendanceGrade, setAttendanceGrade] = useState<number | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, string>>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceDirty, setAttendanceDirty] = useState(false);
  const [expandedStatusId, setExpandedStatusId] = useState<string | null>(null);
  const [allAttendance, setAllAttendance] = useState<{ athlete_id: string; date: string; status: string }[]>([]);
  const [expandedHistoryDate, setExpandedHistoryDate] = useState<string | null>(null);

  // Visible athletes (not hidden)
  const visibleAthletes = useMemo(() => athletes.filter(a => !a.hidden), [athletes]);

  // Derive which athletes have any results from bestResults
  useEffect(() => {
    if (bestResults.length > 0) {
      setAthletesWithData(new Set(bestResults.map((r) => r.athlete_id)));
    }
  }, [bestResults]);

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
    const athleteMap = new Map(visibleAthletes.map((a) => [a.id, a]));
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
  }, [bestResults, visibleAthletes, metrics, lbGenderFilter, lbGradeFilter]);

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

  // Get unique categories from metrics that have leaderboard data
  const lbCategories = useMemo(() => {
    const cats = new Set<string>();
    metrics.forEach((m) => {
      if (leaderboardData[m.id] && m.category) cats.add(m.category);
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [metrics, leaderboardData]);

  // Filter and group metrics by category for leaderboard
  const lbGroupedMetrics = useMemo(() => {
    const filtered = metrics
      .filter((m) => leaderboardData[m.id] && leaderboardData[m.id].length > 0)
      .filter((m) => lbCategoryFilter === "all" || m.category === lbCategoryFilter)
      .sort((a, b) => a.name.localeCompare(b.name));
    const groups: Record<string, typeof metrics> = {};
    for (const m of filtered) {
      const cat = m.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [metrics, leaderboardData, lbCategoryFilter]);

  const filteredAthletes = visibleAthletes.filter((a) => {
    const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  const maleAthletes = filteredAthletes.filter((a) => a.gender === "M");
  const femaleAthletes = filteredAthletes.filter((a) => a.gender === "F");

  const athleteTabFiltered = filteredAthletes.filter((a) => {
    if (athleteGenderFilter !== "all" && a.gender !== athleteGenderFilter) return false;
    if (athleteGradeFilter !== "all" && a.grade !== athleteGradeFilter) return false;
    if (athleteResultsFilter === "has" && !athletesWithData.has(a.id)) return false;
    if (athleteResultsFilter === "none" && athletesWithData.has(a.id)) return false;
    return true;
  });

  // Load attendance records when date or tab changes
  useEffect(() => {
    if (activeTab !== "attendance") return;
    const supabase = createClient();
    supabase
      .from("attendance")
      .select("athlete_id, status")
      .eq("date", attendanceDate)
      .then(({ data }: { data: { athlete_id: string; status: string }[] | null }) => {
        if (data) {
          const records: Record<string, string> = {};
          data.forEach((r) => {
            records[r.athlete_id] = r.status;
          });
          setAttendanceRecords(records);
          setAttendanceDirty(false);
        }
      });
  }, [activeTab, attendanceDate]);

  // Load all attendance records for history & summary
  useEffect(() => {
    if (activeTab !== "attendance") return;
    const supabase = createClient();
    supabase
      .from("attendance")
      .select("athlete_id, date, status")
      .order("date", { ascending: false })
      .then(({ data }: { data: { athlete_id: string; date: string; status: string }[] | null }) => {
        if (data) setAllAttendance(data);
      });
  }, [activeTab]);

  const handleAttendanceSave = useCallback(async () => {
    if (attendanceSaving) return;
    setAttendanceSaving(true);
    const supabase = createClient();

    // Get current DB records for this date to know what to delete
    const { data: existing } = await supabase
      .from("attendance")
      .select("id, athlete_id")
      .eq("date", attendanceDate);

    const existingMap = new Map((existing || []).map((r: { id: string; athlete_id: string }) => [r.athlete_id, r.id]));

    // Upserts for records with status
    const upserts = Object.entries(attendanceRecords)
      .filter(([, status]) => status)
      .map(([athlete_id, status]) => ({
        athlete_id,
        date: attendanceDate,
        status,
        recorded_by: user?.id,
      }));

    // Deletes for records that were cleared
    const athleteIdsWithStatus = new Set(upserts.map(u => u.athlete_id));
    const deleteIds = (existing || [])
      .filter((r: { id: string; athlete_id: string }) => !athleteIdsWithStatus.has(r.athlete_id))
      .map((r: { id: string }) => r.id);

    if (upserts.length > 0) {
      await supabase.from("attendance").upsert(upserts, { onConflict: "athlete_id,date" });
    }
    if (deleteIds.length > 0) {
      await supabase.from("attendance").delete().in("id", deleteIds);
    }

    // Sync local allAttendance
    setAllAttendance(prev => {
      const filtered = prev.filter(r => r.date !== attendanceDate);
      const newRecords = Object.entries(attendanceRecords)
        .filter(([, status]) => status)
        .map(([athlete_id, status]) => ({ athlete_id, date: attendanceDate, status }));
      return [...filtered, ...newRecords];
    });

    setAttendanceDirty(false);
    setAttendanceSaving(false);
  }, [attendanceRecords, attendanceDate, attendanceSaving, user?.id]);

  // Attendance helpers
  const attendanceGradeAthletes = useMemo(() => {
    if (attendanceGrade === null) return [];
    return visibleAthletes
      .filter(a => a.grade === attendanceGrade)
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [visibleAthletes, attendanceGrade]);

  const attendanceBoys = useMemo(() => attendanceGradeAthletes.filter(a => a.gender === "M"), [attendanceGradeAthletes]);
  const attendanceGirls = useMemo(() => attendanceGradeAthletes.filter(a => a.gender === "F"), [attendanceGradeAthletes]);

  const attendanceSummary = useMemo(() => {
    const summary: Record<number, { total: number; present: number }> = {};
    [9, 10, 11, 12].forEach(grade => {
      const gradeAthletes = visibleAthletes.filter(a => a.grade === grade);
      const present = gradeAthletes.filter(a => attendanceRecords[a.id] && attendanceRecords[a.id] !== "").length;
      summary[grade] = { total: gradeAthletes.length, present };
    });
    return summary;
  }, [visibleAthletes, attendanceRecords]);

  // Attendance history: unique dates with counts
  const attendanceDates = useMemo(() => {
    const dateMap: Record<string, { present: number; total: number }> = {};
    allAttendance.forEach(r => {
      if (!dateMap[r.date]) dateMap[r.date] = { present: 0, total: 0 };
      dateMap[r.date].total++;
      if (["present", "late", "excused_late", "unexcused_late"].includes(r.status)) {
        dateMap[r.date].present++;
      }
    });
    return Object.entries(dateMap)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allAttendance]);

  // Athletes recorded on expanded history date
  const expandedDateAthletes = useMemo(() => {
    if (!expandedHistoryDate) return [];
    return allAttendance
      .filter(r => r.date === expandedHistoryDate)
      .map(r => {
        const athlete = athletes.find(a => a.id === r.athlete_id);
        return athlete ? { ...athlete, status: r.status } : null;
      })
      .filter(Boolean) as (typeof athletes[0] & { status: string })[];
  }, [allAttendance, expandedHistoryDate, athletes]);

  // Per-athlete attendance counts (unexcused absences + unexcused lates)
  const athleteAttendanceCounts = useMemo(() => {
    const counts: Record<string, { unexcused: number; unexcused_late: number; total: number }> = {};
    allAttendance.forEach(r => {
      if (!counts[r.athlete_id]) counts[r.athlete_id] = { unexcused: 0, unexcused_late: 0, total: 0 };
      counts[r.athlete_id].total++;
      if (r.status === "unexcused") counts[r.athlete_id].unexcused++;
      if (r.status === "unexcused_late" || r.status === "late") counts[r.athlete_id].unexcused_late++;
    });
    return counts;
  }, [allAttendance]);

  const athletesWithAnyAttendance = useMemo(() => {
    return new Set(allAttendance.map(r => r.athlete_id));
  }, [allAttendance]);

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
        <h1 className="font-headline-brand text-2xl text-[var(--foreground)]">
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
                        <div className="font-headline text-xs font-bold text-[var(--foreground)] truncate">
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
                  Boys ({maleAthletes.length})
                </button>
                <button
                  onClick={() => setGenderTab("F")}
                  className={`flex-1 py-1.5 font-secondary text-xs font-semibold text-center transition-colors cursor-pointer ${
                    genderTab === "F"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]"
                  }`}
                >
                  Girls ({femaleAthletes.length})
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
                    Boys ({maleAthletes.length})
                  </h3>
                  <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                    {maleAthletes.map((a) => renderAthleteRow(a, true))}
                  </div>
                </div>
                <div>
                  <h3 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                    Girls ({femaleAthletes.length})
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
                <div className="w-px h-5 bg-[var(--border)] mx-1" />
                {([
                  { key: "all" as const, label: "All" },
                  { key: "has" as const, label: "Results" },
                  { key: "none" as const, label: "No Results" },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setAthleteResultsFilter(tab.key)}
                    className={`px-3 py-1 rounded-full font-secondary text-xs font-semibold transition-colors cursor-pointer ${
                      athleteResultsFilter === tab.key
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
                    <select
                      value={lbCategoryFilter}
                      onChange={(e) => setLbCategoryFilter(e.target.value)}
                      className="ml-auto px-2 py-1 rounded-[var(--radius-s)] border border-[var(--border)] bg-[var(--card)] font-secondary text-xs text-[var(--foreground)] cursor-pointer outline-none"
                    >
                      <option value="all">All Categories</option>
                      {lbCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  {lbGroupedMetrics.map(([category, catMetrics]) => (
                    <div key={category}>
                      <h3 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                        {category}
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {catMetrics.map((metric) => {
                          const entries = leaderboardData[metric.id];
                          const top5 = entries.slice(0, 5);
                          const bestValue = top5[0]?.value ?? 0;
                          return (
                            <div key={metric.id} className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)] p-4 flex flex-col">
                              <div className="flex items-start justify-between mb-3">
                                <h4 className="font-headline text-sm text-[var(--foreground)]">
                                  {metric.name}
                                </h4>
                                <button
                                  onClick={() => setLbExpandedMetric(metric.id)}
                                  className="shrink-0 px-2 py-0.5 rounded-[var(--radius-s)] border border-[var(--foreground)] text-[var(--foreground)] font-secondary text-[9px] font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                                >
                                  View all
                                </button>
                              </div>
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
                                      className="cursor-pointer text-left"
                                    >
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span className="font-secondary text-[10px] text-[var(--foreground)] truncate">
                                          <span className="font-mono text-[var(--muted-foreground)] mr-1.5">{i + 1}</span>
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
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {lbGroupedMetrics.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <p className="font-secondary text-sm text-[var(--muted-foreground)]">No results yet</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : activeTab === "attendance" ? (
          /* =================== ATTENDANCE TAB =================== */
          <div className="px-4 pb-6">
            {attendanceGrade === null ? (
              /* === Grade selection + history + athlete summary === */
              <div className="pt-3">
                {/* Take Attendance */}
                <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                  Take Attendance
                </h2>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="h-10 rounded-[var(--radius-pill)] bg-[var(--card)] border border-[var(--border)] px-4 font-secondary text-sm text-[var(--foreground)] outline-none cursor-pointer"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {([
                    { grade: 9, label: "Fr" },
                    { grade: 10, label: "So" },
                    { grade: 11, label: "Jr" },
                    { grade: 12, label: "Sr" },
                  ]).map(({ grade, label }) => (
                    <button
                      key={grade}
                      onClick={() => setAttendanceGrade(grade)}
                      className="flex flex-col items-center gap-1 p-3 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)] hover:border-[var(--primary)] transition-colors cursor-pointer"
                    >
                      <span className="font-headline text-sm text-[var(--foreground)]">{label}</span>
                      <span className="font-mono text-xs font-bold text-[var(--primary)]">
                        {attendanceSummary[grade]?.present || 0}/{attendanceSummary[grade]?.total || 0}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Attendance History */}
                {attendanceDates.length > 0 && (
                  <>
                    <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                      Attendance History
                    </h2>
                    <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)] mb-6">
                      {attendanceDates.map(({ date, present }) => {
                        const isExpanded = expandedHistoryDate === date;
                        const d = new Date(date + "T12:00:00");
                        const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                        const teamTotal = visibleAthletes.length;
                        const pct = teamTotal > 0 ? Math.round((present / teamTotal) * 100) : 0;
                        return (
                          <div key={date} className="border-b border-[var(--border)] last:border-b-0">
                            <button
                              onClick={() => setExpandedHistoryDate(isExpanded ? null : date)}
                              className="flex items-center gap-3 px-3 py-2.5 w-full text-left cursor-pointer hover:bg-[var(--secondary)] transition-colors"
                            >
                              <span className="font-secondary text-sm text-[var(--foreground)] flex-1">{label}</span>
                              <span className="font-mono text-xs font-semibold text-[var(--muted-foreground)]">
                                {present}/{teamTotal}
                              </span>
                              <span className="font-mono text-[10px] font-semibold text-[var(--muted-foreground)] w-8 text-right">
                                {pct}%
                              </span>
                              <ChevronDown size={14} className={`text-[var(--muted-foreground)] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                            {isExpanded && (
                              <div className="px-3 pb-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {expandedDateAthletes
                                    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
                                    .map((a) => {
                                      const isLate = ["late", "excused_late", "unexcused_late"].includes(a.status);
                                      const isExcused = a.status === "excused";
                                      const isUnexcused = a.status === "unexcused";
                                      return (
                                        <span
                                          key={a.id}
                                          className={`px-2 py-0.5 rounded-full font-secondary text-[10px] font-semibold ${
                                            isUnexcused
                                              ? "bg-red-100 text-red-700"
                                              : isLate
                                              ? "bg-yellow-100 text-yellow-700"
                                              : isExcused
                                              ? "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                                              : "bg-green-100 text-green-700"
                                          }`}
                                        >
                                          {a.firstName} {a.lastName[0]}.
                                          {isLate && " (L)"}
                                          {isExcused && " (E)"}
                                          {isUnexcused && " (U)"}
                                        </span>
                                      );
                                    })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Athlete Summary */}
                <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                  Athletes
                </h2>
                {(() => {
                  const summaryBoys = visibleAthletes
                    .filter(a => a.gender === "M")
                    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
                  const summaryGirls = visibleAthletes
                    .filter(a => a.gender === "F")
                    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

                  const renderSummaryRow = (athlete: typeof athletes[0]) => {
                    const counts = athleteAttendanceCounts[athlete.id];
                    const hasAny = athletesWithAnyAttendance.has(athlete.id);
                    const unexcused = counts?.unexcused || 0;
                    const unexcusedLate = counts?.unexcused_late || 0;
                    return (
                      <div
                        key={athlete.id}
                        className={`flex items-center gap-1.5 px-3 py-1.5 border-b border-[var(--border)] last:border-b-0 ${!hasAny ? "opacity-40" : ""}`}
                      >
                        <span className="font-secondary text-xs text-[var(--foreground)] truncate flex-1 min-w-0">
                          {athlete.firstName} {athlete.lastName}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0 flex-wrap justify-end">
                          {Array.from({ length: Math.min(unexcused, 8) }).map((_, i) => (
                            <span key={`u${i}`} className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          ))}
                          {unexcused > 8 && (
                            <span className="font-mono text-[9px] font-bold text-red-500">{unexcused}</span>
                          )}
                          {Array.from({ length: Math.min(unexcusedLate, 8) }).map((_, i) => (
                            <span key={`l${i}`} className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                          ))}
                          {unexcusedLate > 8 && (
                            <span className="font-mono text-[9px] font-bold text-yellow-500">{unexcusedLate}</span>
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <h3 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                          Boys ({summaryBoys.length})
                        </h3>
                        <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                          {summaryBoys.map(renderSummaryRow)}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                          Girls ({summaryGirls.length})
                        </h3>
                        <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                          {summaryGirls.map(renderSummaryRow)}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* === Athlete list view === */
              <div className="pt-3">
                <div className="sticky top-0 z-10 bg-[var(--background)] pb-3">
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => { setAttendanceGrade(null); setExpandedStatusId(null); }}
                      className="cursor-pointer"
                    >
                      <ChevronLeft size={20} className="text-[var(--foreground)]" />
                    </button>
                    <h2 className="font-headline text-lg text-[var(--foreground)] flex-1">
                      {attendanceGrade === 9 ? "Freshmen" : attendanceGrade === 10 ? "Sophomores" : attendanceGrade === 11 ? "Juniors" : "Seniors"}
                    </h2>
                    <input
                      type="date"
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="h-8 rounded-[var(--radius-pill)] bg-[var(--card)] border border-[var(--border)] px-3 font-secondary text-xs text-[var(--foreground)] outline-none cursor-pointer"
                    />
                  </div>
                  <span className="font-secondary text-xs text-[var(--muted-foreground)]">
                    {attendanceGradeAthletes.filter(a => attendanceRecords[a.id]).length} / {attendanceGradeAthletes.length} present
                  </span>
                </div>

                {(() => {
                  const renderAttendanceRow = (athlete: typeof athletes[0]) => {
                    const status = attendanceRecords[athlete.id] || "";
                    const isPresent = status === "present";
                    const isAbsent = !status;
                    const isExpanded = expandedStatusId === athlete.id;
                    const statusLabel = status === "excused_late" ? "Excused Late" : status === "unexcused_late" || status === "late" ? "Unexcused Late" : status === "excused" ? "Excused" : status === "unexcused" ? "Unexcused" : "";

                    return (
                      <div key={athlete.id} className="border-b border-[var(--border)] last:border-b-0">
                        <div
                          onClick={() => {
                            const newStatus = isPresent ? "" : "present";
                            setAttendanceRecords(prev => {
                              const next = { ...prev };
                              if (newStatus) next[athlete.id] = newStatus;
                              else delete next[athlete.id];
                              return next;
                            });
                            setAttendanceDirty(true);
                          }}
                          className={`flex items-center gap-2 px-3 py-2 transition-colors cursor-pointer hover:bg-[var(--secondary)] ${isAbsent ? "opacity-50" : ""}`}
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                            isPresent ? "bg-[var(--primary)]" : "bg-[var(--secondary)]"
                          }`}>
                            {isPresent ? (
                              <Check size={14} className="text-[var(--primary-foreground)]" />
                            ) : (
                              <span className="font-mono text-[10px] font-semibold text-[var(--secondary-foreground)]">
                                {athlete.firstName[0]}{athlete.lastName[0]}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-secondary text-xs font-medium text-[var(--foreground)] truncate block">
                              {athlete.firstName} {athlete.lastName}
                            </span>
                            {statusLabel && (
                              <span className="px-1.5 py-0.5 rounded-full bg-[var(--secondary)] font-secondary text-[9px] font-semibold text-[var(--muted-foreground)]">
                                {statusLabel}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedStatusId(isExpanded ? null : athlete.id); }}
                            className="cursor-pointer p-1 shrink-0"
                          >
                            <ChevronDown size={14} className={`text-[var(--muted-foreground)] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="flex items-center gap-1 px-3 pb-2 flex-wrap">
                            {([
                              { key: "present", label: "Present" },
                              { key: "excused_late", label: "Exc. Late" },
                              { key: "unexcused_late", label: "Unexc. Late" },
                              { key: "excused", label: "Excused" },
                              { key: "unexcused", label: "Unexcused" },
                            ]).map((opt) => (
                              <button
                                key={opt.key}
                                onClick={() => {
                                  setAttendanceRecords(prev => ({ ...prev, [athlete.id]: opt.key }));
                                  setAttendanceDirty(true);
                                  setExpandedStatusId(null);
                                }}
                                className={`px-2 py-0.5 rounded-full font-secondary text-[10px] font-semibold transition-colors cursor-pointer ${
                                  status === opt.key
                                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                            <button
                              onClick={() => {
                                setAttendanceRecords(prev => {
                                  const next = { ...prev };
                                  delete next[athlete.id];
                                  return next;
                                });
                                setAttendanceDirty(true);
                                setExpandedStatusId(null);
                              }}
                              className="px-2 py-0.5 rounded-full font-secondary text-[10px] font-semibold bg-[var(--secondary)] text-[var(--destructive)] hover:bg-[var(--color-error)] transition-colors cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <h3 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                          Boys ({attendanceBoys.length})
                        </h3>
                        <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                          {attendanceBoys.map(renderAttendanceRow)}
                          {attendanceBoys.length === 0 && (
                            <div className="px-2 py-4 text-center">
                              <p className="font-secondary text-xs text-[var(--muted-foreground)]">None</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                          Girls ({attendanceGirls.length})
                        </h3>
                        <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                          {attendanceGirls.map(renderAttendanceRow)}
                          {attendanceGirls.length === 0 && (
                            <div className="px-2 py-4 text-center">
                              <p className="font-secondary text-xs text-[var(--muted-foreground)]">None</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Sticky save button */}
                {attendanceDirty && (
                  <div className="sticky bottom-0 pt-3 pb-2 bg-[var(--background)]">
                    <button
                      onClick={handleAttendanceSave}
                      disabled={attendanceSaving}
                      className="w-full h-12 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                    >
                      {attendanceSaving ? "Saving..." : "Save Attendance"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center border-t border-[var(--border)] bg-[var(--card)] pt-[10px] pb-[20px]">
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
        {isAdmin && (
          <button
            onClick={() => setActiveTab("attendance")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 cursor-pointer transition-colors ${
              activeTab === "attendance" ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
            }`}
          >
            <ClipboardCheck size={20} />
            <span className="font-secondary text-[10px] font-semibold">Attendance</span>
          </button>
        )}
      </div>
    </div>
  );
}
