"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info, Search, Check, Pencil, Undo2, X, TrendingUp, TrendingDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";

const GRADE_LABELS: Record<number, string> = { 9: "Fr", 10: "So", 11: "Jr", 12: "Sr" };

function StationContent() {
  const router = useRouter();
  const params = useSearchParams();
  const stationId = params.get("id") || "rsi";
  const inputRef = useRef<HTMLInputElement>(null);
  const { stations, metrics, athletes } = useStore();
  const { role } = useAuth();
  const canRecord = role === "super_admin" || role === "admin";

  const station = stations.find(s => s.id === stationId);
  const assignedMetric = station ? metrics.find(m => m.id === station.metricId) : null;
  const stationName = station?.name || "Station";
  const stationInfoText = assignedMetric
    ? `${assignedMetric.measurementRules} · ${assignedMetric.gear}`
    : station?.description || "Follow standard protocol";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [results, setResults] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [baselines, setBaselines] = useState<Record<string, number>>({});

  const completed = Object.keys(results).length;
  const total = athletes.length;

  // Load baseline (most recent previous result per athlete for this metric)
  useEffect(() => {
    if (!station?.metricId) return;
    const supabase = createClient();

    async function loadBaselines() {
      const { data } = await supabase
        .from("results")
        .select("athlete_id, value")
        .eq("metric_id", station!.metricId)
        .order("recorded_at", { ascending: false });

      if (data) {
        const prev: Record<string, number> = {};
        data.forEach((r: { athlete_id: string; value: number }) => {
          if (!(r.athlete_id in prev)) {
            prev[r.athlete_id] = Number(r.value);
          }
        });
        setBaselines(prev);
      }
    }

    loadBaselines();
  }, [station?.metricId]);

  useEffect(() => {
    if (selectedId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedId]);

  const handleSelect = (id: string) => {
    if (results[id]) return;
    setSelectedId(id);
    setValue("");
  };

  const handleSave = async () => {
    if (selectedId && value && station) {
      const supabase = createClient();
      const metricId = station.metricId;
      if (metricId) {
        await supabase.from("results").insert({
          athlete_id: selectedId,
          metric_id: metricId,
          station_id: undefined,
          value: parseFloat(value),
          unit: assignedMetric?.acronym || "",
        });
      }
      setResults((prev) => ({ ...prev, [selectedId]: value }));
      setSelectedId(null);
      setValue("");
    }
  };

  const handleUndo = () => {
    setSelectedId(null);
    setValue("");
  };

  const filteredAthletes = athletes.filter((a) => {
    const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  const selectedAthlete = athletes.find((a) => a.id === selectedId);

  // Compute session stats
  const sessionStats = useMemo(() => {
    const entries = Object.entries(results);
    if (entries.length === 0) return null;

    // Build list of { athlete, value, pctChange }
    const recorded = entries.map(([athleteId, val]) => {
      const athlete = athletes.find((a) => a.id === athleteId);
      const numVal = parseFloat(val);
      const baseline = baselines[athleteId];
      const pctChange = baseline != null && baseline !== 0
        ? ((numVal - baseline) / Math.abs(baseline)) * 100
        : null;
      return { athlete, value: numVal, pctChange };
    }).filter((r) => r.athlete);

    // Top marks by grade x gender
    const topByGroup: Record<string, { value: number; name: string }> = {};
    recorded.forEach((r) => {
      const a = r.athlete!;
      const key = `${a.grade}-${a.gender}`;
      if (!topByGroup[key] || r.value > topByGroup[key].value) {
        topByGroup[key] = { value: r.value, name: `${a.firstName} ${a.lastName[0]}.` };
      }
    });

    // Top marks by gender
    const topMale = recorded
      .filter((r) => r.athlete!.gender === "M")
      .sort((a, b) => b.value - a.value)[0];
    const topFemale = recorded
      .filter((r) => r.athlete!.gender === "F")
      .sort((a, b) => b.value - a.value)[0];

    // Overall top
    const topOverall = [...recorded].sort((a, b) => b.value - a.value)[0];

    // % change leaders (only athletes with baselines)
    const withChange = recorded.filter((r) => r.pctChange !== null);
    const topHighPct = withChange.length
      ? [...withChange].sort((a, b) => b.pctChange! - a.pctChange!)[0]
      : null;
    const topLowPct = withChange.length
      ? [...withChange].sort((a, b) => a.pctChange! - b.pctChange!)[0]
      : null;

    return { topByGroup, topMale, topFemale, topOverall, topHighPct, topLowPct, recorded };
  }, [results, athletes, baselines]);

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
        <button onClick={() => router.push("/")} className="cursor-pointer">
          <ArrowLeft size={24} className="text-[var(--foreground)]" />
        </button>
        <h1 className="font-primary text-lg font-semibold text-[var(--foreground)]">
          {stationName}
        </h1>
        <button onClick={() => setShowInfo(!showInfo)} className="cursor-pointer">
          <Info size={24} className="text-[var(--muted-foreground)]" />
        </button>
      </div>

      {/* Info Bar */}
      {showInfo && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--secondary)]">
          <span className="font-secondary text-xs text-[var(--muted-foreground)]">
            {stationInfoText}
          </span>
          <button onClick={() => setShowInfo(false)} className="ml-auto cursor-pointer">
            <X size={14} className="text-[var(--muted-foreground)]" />
          </button>
        </div>
      )}

      {/* Entry Section */}
      {canRecord && selectedAthlete && (
        <div className="flex flex-col gap-4 p-5 bg-[var(--card)] border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[var(--secondary)] flex items-center justify-center">
              <span className="font-primary text-base font-semibold text-[var(--secondary-foreground)]">
                {selectedAthlete.firstName[0]}{selectedAthlete.lastName[0]}
              </span>
            </div>
            <div className="flex-1">
              <div className="font-primary text-base font-semibold text-[var(--foreground)]">
                {selectedAthlete.firstName} {selectedAthlete.lastName}
              </div>
              <div className="font-secondary text-xs text-[var(--muted-foreground)]">
                Grade {selectedAthlete.grade} · {selectedAthlete.gender === "M" ? "Male" : "Female"}
              </div>
            </div>
            <button onClick={handleUndo} className="cursor-pointer">
              <Undo2 size={20} className="text-[var(--muted-foreground)]" />
            </button>
          </div>

          <div className="flex items-center gap-2 h-16 rounded-[var(--radius-m)] bg-[var(--background)] border-2 border-[var(--primary)] px-5">
            <input
              ref={inputRef}
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent font-primary text-3xl font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="font-secondary text-sm text-[var(--muted-foreground)]">
              {assignedMetric?.acronym || stationId.toUpperCase()}
            </span>
          </div>

          <button
            onClick={handleSave}
            disabled={!value}
            className="h-12 rounded-[var(--radius-pill)] bg-[var(--primary)] font-primary text-base font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Result
          </button>
        </div>
      )}

      {/* Session Stats */}
      {sessionStats && (
        <div className="px-4 py-3 bg-[var(--card)] border-b border-[var(--border)]">
          <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
            Session Stats ({sessionStats.recorded.length} recorded)
          </h2>

          {/* Top Marks Table */}
          <div className="border border-[var(--border)] mb-3 overflow-hidden">
            {/* Table header */}
            <div className="flex bg-[var(--secondary)]">
              <div className="w-12 px-2 py-1.5">
                <span className="font-primary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Year</span>
              </div>
              <div className="flex-1 px-2 py-1.5">
                <span className="font-primary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Male</span>
              </div>
              <div className="flex-1 px-2 py-1.5">
                <span className="font-primary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Female</span>
              </div>
            </div>
            {/* Grade rows */}
            {[12, 11, 10, 9].map((grade) => {
              const maleKey = `${grade}-M`;
              const femaleKey = `${grade}-F`;
              const male = sessionStats.topByGroup[maleKey];
              const female = sessionStats.topByGroup[femaleKey];
              if (!male && !female) return null;
              return (
                <div key={grade} className="flex border-t border-[var(--border)]">
                  <div className="w-12 px-2 py-1.5 flex items-center">
                    <span className="font-primary text-xs font-semibold text-[var(--foreground)]">
                      {GRADE_LABELS[grade]}
                    </span>
                  </div>
                  <div className="flex-1 px-2 py-1.5">
                    {male ? (
                      <div>
                        <span className="font-primary text-sm font-bold text-[var(--foreground)]">{male.value}</span>
                        <span className="font-secondary text-[10px] text-[var(--muted-foreground)] ml-1">{male.name}</span>
                      </div>
                    ) : (
                      <span className="font-secondary text-xs text-[var(--muted-foreground)]">—</span>
                    )}
                  </div>
                  <div className="flex-1 px-2 py-1.5">
                    {female ? (
                      <div>
                        <span className="font-primary text-sm font-bold text-[var(--foreground)]">{female.value}</span>
                        <span className="font-secondary text-[10px] text-[var(--muted-foreground)] ml-1">{female.name}</span>
                      </div>
                    ) : (
                      <span className="font-secondary text-xs text-[var(--muted-foreground)]">—</span>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Overall row */}
            <div className="flex border-t border-[var(--border)] bg-[var(--secondary)]">
              <div className="w-12 px-2 py-1.5 flex items-center">
                <span className="font-primary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Top</span>
              </div>
              <div className="flex-1 px-2 py-1.5">
                {sessionStats.topMale ? (
                  <div>
                    <span className="font-primary text-sm font-bold text-[var(--foreground)]">{sessionStats.topMale.value}</span>
                    <span className="font-secondary text-[10px] text-[var(--muted-foreground)] ml-1">
                      {sessionStats.topMale.athlete!.firstName} {sessionStats.topMale.athlete!.lastName[0]}.
                    </span>
                  </div>
                ) : (
                  <span className="font-secondary text-xs text-[var(--muted-foreground)]">—</span>
                )}
              </div>
              <div className="flex-1 px-2 py-1.5">
                {sessionStats.topFemale ? (
                  <div>
                    <span className="font-primary text-sm font-bold text-[var(--foreground)]">{sessionStats.topFemale.value}</span>
                    <span className="font-secondary text-[10px] text-[var(--muted-foreground)] ml-1">
                      {sessionStats.topFemale.athlete!.firstName} {sessionStats.topFemale.athlete!.lastName[0]}.
                    </span>
                  </div>
                ) : (
                  <span className="font-secondary text-xs text-[var(--muted-foreground)]">—</span>
                )}
              </div>
            </div>
          </div>

          {/* % Change Leaders */}
          {(sessionStats.topHighPct || sessionStats.topLowPct) && (
            <div className="flex flex-col gap-1.5">
              <span className="font-primary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Top % Change
              </span>
              <div className="flex gap-3">
                {sessionStats.topHighPct && (
                  <div className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-[var(--color-success)] rounded-sm">
                    <TrendingUp size={14} className="text-[var(--color-success-foreground)] shrink-0" />
                    <div className="min-w-0">
                      <span className="font-primary text-sm font-bold text-[var(--color-success-foreground)]">
                        +{sessionStats.topHighPct.pctChange!.toFixed(1)}%
                      </span>
                      <span className="font-secondary text-[10px] text-[var(--color-success-foreground)] ml-1 truncate">
                        {sessionStats.topHighPct.athlete!.firstName} {sessionStats.topHighPct.athlete!.lastName[0]}.
                      </span>
                    </div>
                  </div>
                )}
                {sessionStats.topLowPct && (
                  <div className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-[var(--color-error)] rounded-sm">
                    <TrendingDown size={14} className="text-[var(--color-error-foreground)] shrink-0" />
                    <div className="min-w-0">
                      <span className="font-primary text-sm font-bold text-[var(--color-error-foreground)]">
                        {sessionStats.topLowPct.pctChange!.toFixed(1)}%
                      </span>
                      <span className="font-secondary text-[10px] text-[var(--color-error-foreground)] ml-1 truncate">
                        {sessionStats.topLowPct.athlete!.firstName} {sessionStats.topLowPct.athlete!.lastName[0]}.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Athlete Queue */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex-1 flex items-center gap-2">
            <Search size={16} className="text-[var(--muted-foreground)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search athletes..."
              className="flex-1 bg-transparent font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
            />
          </div>
          <span className="font-primary text-xs font-semibold text-[var(--muted-foreground)]">
            {completed}/{total}
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          {filteredAthletes.map((athlete) => {
            const isDone = !!results[athlete.id];
            const isSelected = selectedId === athlete.id;

            return (
              <button
                key={athlete.id}
                onClick={() => canRecord && handleSelect(athlete.id)}
                disabled={isDone || !canRecord}
                className={`flex items-center gap-3 w-full px-4 py-3 border-b border-[var(--border)] text-left transition-colors cursor-pointer disabled:cursor-default ${
                  isSelected
                    ? "bg-[var(--primary)]"
                    : isDone
                    ? "bg-[var(--color-success)]"
                    : "hover:bg-[var(--secondary)]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "bg-[var(--card)]"
                      : "bg-[var(--secondary)]"
                  }`}
                >
                  <span
                    className={`font-primary text-xs font-semibold ${
                      isSelected
                        ? "text-[var(--foreground)]"
                        : "text-[var(--secondary-foreground)]"
                    }`}
                  >
                    {athlete.firstName[0]}{athlete.lastName[0]}
                  </span>
                </div>
                <span
                  className={`flex-1 font-secondary text-sm font-medium ${
                    isSelected
                      ? "text-[var(--primary-foreground)] font-semibold"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {athlete.firstName} {athlete.lastName}
                </span>
                {isDone ? (
                  <>
                    <span className="font-primary text-sm font-semibold text-[var(--color-success-foreground)]">
                      {results[athlete.id]}
                    </span>
                    <Check size={16} className="text-[var(--color-success-foreground)]" />
                  </>
                ) : isSelected ? (
                  <Pencil size={16} className="text-[var(--primary-foreground)]" />
                ) : (
                  <span className="font-primary text-sm text-[var(--muted-foreground)]">
                    —
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function StationPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
      <StationContent />
    </Suspense>
  );
}
