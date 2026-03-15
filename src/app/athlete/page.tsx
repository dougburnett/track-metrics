"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Pencil, Check, X } from "lucide-react";
import { useStore, type Athlete } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import { Skeleton } from "@/components/Skeleton";

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

const fmtVal = (n: number) => parseFloat(n.toFixed(2));
const GRADE_LABELS: Record<number, string> = { 9: "Freshmen", 10: "Sophomores", 11: "Juniors", 12: "Seniors" };
const GRADE_SHORT: Record<number, string> = { 9: "Fr", 10: "So", 11: "Jr", 12: "Sr" };
type RankFilter = "team" | "gender" | "grade" | "gradeGender";

function AthleteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const athleteId = params.get("id");
  const { athletes, metrics, categories, saveAthlete } = useStore();
  const { role } = useAuth();
  const isAdmin = role === "super_admin" || role === "admin";
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Athlete | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [editResultValue, setEditResultValue] = useState("");
  const [savingResult, setSavingResult] = useState(false);
  const [rankFilter, setRankFilter] = useState<RankFilter>("team");
  const [allBestResults, setAllBestResults] = useState<{ athlete_id: string; metric_id: string; value: number }[]>([]);

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

  // Load all athletes' best results for ranking
  useEffect(() => {
    if (results.length === 0) return;
    const metricIds = [...new Set(results.map(r => r.metricId))];
    if (metricIds.length === 0) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.rpc("best_results", { metric_ids: metricIds });
      if (data) {
        setAllBestResults(
          (data as { athlete_id: string; metric_id: string; value: number }[]).map(r => ({
            athlete_id: r.athlete_id,
            metric_id: r.metric_id,
            value: Number(r.value),
          }))
        );
      }
    })();
  }, [results]);

  // Compute rankings per metric based on filter
  const rankings: Record<string, number> = useMemo(() => {
    if (!athlete || allBestResults.length === 0) return {};
    const out: Record<string, number> = {};
    const metricIds = [...new Set(allBestResults.map(r => r.metric_id))];

    for (const metricId of metricIds) {
      const metric = metrics.find(m => m.id === metricId);
      const lowerIsBetter = metric?.lowerIsBetter ?? false;

      // Filter athletes based on rank filter
      let eligibleAthleteIds: Set<string>;
      if (rankFilter === "team") {
        eligibleAthleteIds = new Set(athletes.map(a => a.id));
      } else if (rankFilter === "gender") {
        eligibleAthleteIds = new Set(athletes.filter(a => a.gender === athlete.gender).map(a => a.id));
      } else if (rankFilter === "grade") {
        eligibleAthleteIds = new Set(athletes.filter(a => a.grade === athlete.grade).map(a => a.id));
      } else {
        eligibleAthleteIds = new Set(athletes.filter(a => a.grade === athlete.grade && a.gender === athlete.gender).map(a => a.id));
      }

      const metricResults = allBestResults
        .filter(r => r.metric_id === metricId && eligibleAthleteIds.has(r.athlete_id))
        .sort((a, b) => lowerIsBetter ? a.value - b.value : b.value - a.value);

      const idx = metricResults.findIndex(r => r.athlete_id === athlete.id);
      if (idx !== -1) {
        out[metricId] = idx + 1;
      }
    }
    return out;
  }, [athlete, allBestResults, athletes, metrics, rankFilter]);

  const rankTotal: Record<string, number> = useMemo(() => {
    if (!athlete || allBestResults.length === 0) return {};
    const out: Record<string, number> = {};
    const metricIds = [...new Set(allBestResults.map(r => r.metric_id))];

    for (const metricId of metricIds) {
      let eligibleAthleteIds: Set<string>;
      if (rankFilter === "team") {
        eligibleAthleteIds = new Set(athletes.map(a => a.id));
      } else if (rankFilter === "gender") {
        eligibleAthleteIds = new Set(athletes.filter(a => a.gender === athlete.gender).map(a => a.id));
      } else if (rankFilter === "grade") {
        eligibleAthleteIds = new Set(athletes.filter(a => a.grade === athlete.grade).map(a => a.id));
      } else {
        eligibleAthleteIds = new Set(athletes.filter(a => a.grade === athlete.grade && a.gender === athlete.gender).map(a => a.id));
      }

      out[metricId] = allBestResults.filter(r => r.metric_id === metricId && eligibleAthleteIds.has(r.athlete_id)).length;
    }
    return out;
  }, [athlete, allBestResults, athletes, rankFilter]);

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

  const handleEditResult = (r: Result) => {
    setEditingResultId(r.id);
    setEditResultValue(String(r.value));
  };

  const handleSaveResult = async () => {
    if (!editingResultId || savingResult) return;
    const newVal = parseFloat(editResultValue);
    if (isNaN(newVal)) return;
    setSavingResult(true);
    const supabase = createClient();
    await supabase.from("results").update({ value: newVal }).eq("id", editingResultId);
    setResults((prev) => prev.map((r) => r.id === editingResultId ? { ...r, value: newVal } : r));
    setEditingResultId(null);
    setEditResultValue("");
    setSavingResult(false);
  };

  if (!athlete) {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
          <button onClick={() => router.push("/")} className="cursor-pointer">
            <ArrowLeft size={24} className="text-[var(--foreground)]" />
          </button>
          <h1 className="font-headline text-lg text-[var(--foreground)]">
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
        <h1 className="flex-1 font-headline text-lg text-[var(--foreground)]">
          {athlete.firstName} {athlete.lastName}
        </h1>
        {isAdmin && !editing && (
          <button
            onClick={() => { setEditForm({ ...athlete }); setEditing(true); }}
            className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors"
          >
            <Pencil size={18} className="text-[var(--muted-foreground)]" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {/* Athlete Info */}
        {editing && editForm ? (
          <div className="p-5 bg-[var(--card)] border-b border-[var(--border)] flex flex-col gap-3">
            <input
              value={editForm.firstName}
              onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
              placeholder="First Name"
              className="w-full h-10 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--input)] px-4 font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)]"
            />
            <input
              value={editForm.lastName}
              onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
              placeholder="Last Name"
              className="w-full h-10 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--input)] px-4 font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)]"
            />
            <div className="flex gap-3">
              <select
                value={editForm.grade}
                onChange={(e) => setEditForm({ ...editForm, grade: Number(e.target.value) })}
                className="flex-1 h-10 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--input)] px-4 font-secondary text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] appearance-none cursor-pointer"
              >
                <option value={9}>Grade 9</option>
                <option value={10}>Grade 10</option>
                <option value={11}>Grade 11</option>
                <option value={12}>Grade 12</option>
              </select>
              <select
                value={editForm.gender}
                onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                className="flex-1 h-10 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--input)] px-4 font-secondary text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] appearance-none cursor-pointer"
              >
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setEditing(false); setEditForm(null); }}
                className="flex-1 h-10 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--border)] font-secondary text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !editForm.firstName || !editForm.lastName}
                onClick={async () => {
                  setSaving(true);
                  await saveAthlete(editForm);
                  setSaving(false);
                  setEditing(false);
                  setEditForm(null);
                }}
                className="flex-1 h-10 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 p-5 bg-[var(--card)] border-b border-[var(--border)] rounded-[var(--radius-s)]">
            <div className="w-14 h-14 rounded-full bg-[var(--primary)] flex items-center justify-center">
              <span className="font-mono text-xl font-bold text-[var(--primary-foreground)]">
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
        )}

        {/* Loading skeleton for results */}
        {loading && (
          <div className="px-4 py-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)] flex flex-col gap-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
            <div className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)] flex flex-col gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        )}

        {/* Category Tabs */}
        {!loading && summaries.length > 0 && (
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
        {!loading && filteredSummaries.length > 0 ? (
          <>
            <div className="px-4 pb-3">
              <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
                Key Metrics
              </h2>
              {/* Rank filter tabs */}
              {athlete && (
                <div className="flex items-center gap-1 mb-3 overflow-x-auto">
                  {([
                    { key: "team" as RankFilter, label: "All Team" },
                    { key: "gender" as RankFilter, label: `All ${athlete.gender === "M" ? "Boys" : "Girls"}` },
                    { key: "grade" as RankFilter, label: `All ${GRADE_LABELS[athlete.grade] || `Gr ${athlete.grade}`}` },
                    { key: "gradeGender" as RankFilter, label: `${GRADE_SHORT[athlete.grade] || athlete.grade} ${athlete.gender === "M" ? "Boys" : "Girls"}` },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setRankFilter(tab.key)}
                      className={`px-2.5 py-1 rounded-full font-secondary text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        rankFilter === tab.key
                          ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                          : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {filteredSummaries.map((s) => {
                  const rank = rankings[s.metricId];
                  const total = rankTotal[s.metricId];
                  return (
                  <div
                    key={s.metricId}
                    className="relative p-4 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]"
                  >
                    {rank && total && (
                      <span className="absolute top-2 right-2 font-mono text-[10px] font-bold text-[var(--primary)]">
                        #{rank}/{total}
                      </span>
                    )}
                    <div className="font-secondary text-xs text-[var(--muted-foreground)] mb-1 pr-10">
                      {s.metricName}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-bold text-[var(--foreground)]">
                        {fmtVal(s.latest)}
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
                          className={`font-mono text-xs font-semibold ${
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
                  );
                })}
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
                        className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-secondary text-sm font-medium text-[var(--foreground)]">
                            {s.metricName}
                          </span>
                          <span className="font-mono text-xs text-[var(--muted-foreground)]">
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
                                  <span className="font-mono text-[9px] sm:text-[10px] text-[var(--foreground)] mb-0.5 leading-none">
                                    {fmtVal(slot.value)}
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
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)] overflow-hidden">
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
                  {isAdmin && <span className="w-8" />}
                </div>
                {/* Table Rows */}
                {filteredResults.map((r) => {
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
                  const isEditingThis = editingResultId === r.id;

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
                      <span className="flex-1 font-mono text-sm font-medium text-[var(--foreground)]">
                        {r.metricAcronym}
                      </span>
                      {isEditingThis ? (
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editResultValue}
                          onChange={(e) => setEditResultValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveResult()}
                          autoFocus
                          className="w-20 h-7 rounded-[var(--radius-s)] bg-[var(--background)] border border-[var(--primary)] px-2 font-mono text-sm font-semibold text-[var(--foreground)] outline-none text-right"
                        />
                      ) : (
                        <span className="w-20 text-right font-mono text-sm font-semibold text-[var(--foreground)]">
                          {fmtVal(r.value)}
                          {r.subValues && (
                            <span className="block font-secondary text-[9px] text-[var(--muted-foreground)] font-normal">
                              {Object.entries(r.subValues).map(([k, v]) => `${k}:${v}`).join(" ")}
                            </span>
                          )}
                        </span>
                      )}
                      <span
                        className={`w-16 text-right font-mono text-xs font-semibold ${
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
                      {isAdmin && (
                        <span className="w-8 flex justify-end">
                          {isEditingThis ? (
                            <span className="flex gap-0.5">
                              <button
                                onClick={handleSaveResult}
                                disabled={savingResult}
                                className="p-1 cursor-pointer hover:bg-[var(--secondary)] rounded transition-colors disabled:opacity-40"
                              >
                                <Check size={12} className="text-[var(--color-success-foreground)]" />
                              </button>
                              <button
                                onClick={() => { setEditingResultId(null); setEditResultValue(""); }}
                                className="p-1 cursor-pointer hover:bg-[var(--secondary)] rounded transition-colors"
                              >
                                <X size={12} className="text-[var(--muted-foreground)]" />
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleEditResult(r)}
                              className="p-1 cursor-pointer hover:bg-[var(--secondary)] rounded transition-colors"
                            >
                              <Pencil size={12} className="text-[var(--muted-foreground)]" />
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : !loading ? (
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
        ) : null}
      </div>
    </div>
  );
}

function AthleteSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="h-5 w-36" />
      </div>
      <div className="flex items-center gap-4 p-5 bg-[var(--card)] border-b border-[var(--border)]">
        <Skeleton className="w-14 h-14 rounded-full shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-28" />
        </div>
      </div>
      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)] flex flex-col gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AthletePage() {
  return (
    <Suspense fallback={<AthleteSkeleton />}>
      <AthleteContent />
    </Suspense>
  );
}
