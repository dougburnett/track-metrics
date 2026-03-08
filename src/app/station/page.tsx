"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info, Search, Check, Pencil, Undo2, X, TrendingUp, TrendingDown } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import { evaluateFormula, indexToVar } from "@/lib/formula";

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
  const [subValues, setSubValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [baselines, setBaselines] = useState<Record<string, number>>({});
  const [genderTab, setGenderTab] = useState<"M" | "F">("M");

  const isMultiInput = !!(assignedMetric?.inputs && assignedMetric.inputs.length > 1);

  const computedResult = useMemo(() => {
    if (!isMultiInput || !assignedMetric?.inputs) return null;
    const numericValues: Record<string, number> = {};
    let allFilled = true;
    assignedMetric.inputs.forEach((_, i) => {
      const key = indexToVar(i);
      const raw = subValues[key];
      if (!raw || raw === "") { allFilled = false; return; }
      const n = parseFloat(raw);
      if (isNaN(n)) { allFilled = false; return; }
      numericValues[key] = n;
    });
    if (!allFilled) return null;
    try {
      const formula = assignedMetric.formula || assignedMetric.inputs.map((_, i) => indexToVar(i)).join(" + ");
      const result = evaluateFormula(formula, numericValues);
      if (!isFinite(result)) return null;
      return result;
    } catch {
      return null;
    }
  }, [subValues, assignedMetric, isMultiInput]);

  const completed = Object.keys(results).length;
  const total = athletes.length;

  // Load today's results and baselines (pre-today) for this metric
  useEffect(() => {
    if (!station?.metricId) return;
    const supabase = createClient();

    async function loadData() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data } = await supabase
        .from("results")
        .select("athlete_id, value, recorded_at")
        .eq("metric_id", station!.metricId)
        .order("recorded_at", { ascending: false });

      if (data) {
        const todayResults: Record<string, string> = {};
        const prev: Record<string, number> = {};

        data.forEach((r: { athlete_id: string; value: number; recorded_at: string }) => {
          const isToday = r.recorded_at >= todayISO;
          if (isToday) {
            if (!(r.athlete_id in todayResults)) {
              todayResults[r.athlete_id] = String(r.value);
            }
          } else {
            if (!(r.athlete_id in prev)) {
              prev[r.athlete_id] = Number(r.value);
            }
          }
        });

        setResults(todayResults);
        setBaselines(prev);
      }
    }

    loadData();
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
    if (!selectedId || !station?.metricId) return;
    const supabase = createClient();
    const metricId = station.metricId;

    if (isMultiInput && computedResult !== null) {
      const numericSubValues: Record<string, number> = {};
      assignedMetric!.inputs!.forEach((_, i) => {
        const key = indexToVar(i);
        numericSubValues[key] = parseFloat(subValues[key]);
      });
      await supabase.from("results").insert({
        athlete_id: selectedId,
        metric_id: metricId,
        value: computedResult,
        unit: assignedMetric?.acronym || "",
        sub_values: numericSubValues,
      });
      const displayVal = Number.isInteger(computedResult) ? String(computedResult) : computedResult.toFixed(2);
      setResults((prev) => ({ ...prev, [selectedId]: displayVal }));
      setSelectedId(null);
      setSubValues({});
    } else if (value) {
      await supabase.from("results").insert({
        athlete_id: selectedId,
        metric_id: metricId,
        value: parseFloat(value),
        unit: assignedMetric?.acronym || "",
      });
      setResults((prev) => ({ ...prev, [selectedId]: value }));
      setSelectedId(null);
      setValue("");
    }
  };

  const handleUndo = () => {
    setSelectedId(null);
    setValue("");
    setSubValues({});
  };

  const filteredAthletes = athletes.filter((a) => {
    const fullName = `${a.firstName} ${a.lastName}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  const selectedAthlete = athletes.find((a) => a.id === selectedId);
  const maleFiltered = filteredAthletes.filter((a) => a.gender === "M");
  const femaleFiltered = filteredAthletes.filter((a) => a.gender === "F");

  // Compute session stats
  const sessionStats = useMemo(() => {
    const entries = Object.entries(results);
    if (entries.length === 0) return null;

    const recorded = entries.map(([athleteId, val]) => {
      const athlete = athletes.find((a) => a.id === athleteId);
      const numVal = parseFloat(val);
      const baseline = baselines[athleteId];
      const pctChange = baseline != null && baseline !== 0
        ? ((numVal - baseline) / Math.abs(baseline)) * 100
        : null;
      return { athlete, value: numVal, pctChange };
    }).filter((r) => r.athlete);

    const topByGroup: Record<string, { value: number; name: string }> = {};
    recorded.forEach((r) => {
      const a = r.athlete!;
      const key = `${a.grade}-${a.gender}`;
      if (!topByGroup[key] || r.value > topByGroup[key].value) {
        topByGroup[key] = { value: r.value, name: `${a.firstName} ${a.lastName[0]}.` };
      }
    });

    const topMale = recorded
      .filter((r) => r.athlete!.gender === "M")
      .sort((a, b) => b.value - a.value)[0];
    const topFemale = recorded
      .filter((r) => r.athlete!.gender === "F")
      .sort((a, b) => b.value - a.value)[0];

    const topOverall = [...recorded].sort((a, b) => b.value - a.value)[0];

    const withChange = recorded.filter((r) => r.pctChange !== null);
    const topHighPct = withChange.length
      ? [...withChange].sort((a, b) => b.pctChange! - a.pctChange!)[0]
      : null;
    const topLowPct = withChange.length
      ? [...withChange].sort((a, b) => a.pctChange! - b.pctChange!)[0]
      : null;

    return { topByGroup, topMale, topFemale, topOverall, topHighPct, topLowPct, recorded };
  }, [results, athletes, baselines]);

  const renderAthleteRow = (athlete: typeof athletes[0], compact: boolean) => {
    const isDone = !!results[athlete.id];
    const isSelected = selectedId === athlete.id;
    return (
      <button
        key={athlete.id}
        onClick={() => canRecord && handleSelect(athlete.id)}
        disabled={isDone || !canRecord}
        className={`flex items-center ${compact ? "gap-2 px-2.5 py-2" : "gap-3 px-4 py-3"} w-full border-b border-[var(--border)] last:border-b-0 text-left transition-colors cursor-pointer disabled:cursor-default ${
          isSelected
            ? "bg-[var(--primary)]"
            : isDone
            ? "bg-[var(--color-success)]"
            : "hover:bg-[var(--secondary)]"
        }`}
      >
        <div
          className={`${compact ? "w-7 h-7" : "w-9 h-9"} rounded-full flex items-center justify-center shrink-0 ${
            isSelected ? "bg-[var(--card)]" : "bg-[var(--secondary)]"
          }`}
        >
          <span
            className={`font-mono ${compact ? "text-[10px]" : "text-xs"} font-semibold ${
              isSelected
                ? "text-[var(--foreground)]"
                : "text-[var(--secondary-foreground)]"
            }`}
          >
            {athlete.firstName[0]}{athlete.lastName[0]}
          </span>
        </div>
        <span
          className={`flex-1 min-w-0 font-secondary ${compact ? "text-xs truncate" : "text-sm"} font-medium ${
            isSelected
              ? "text-[var(--primary-foreground)] font-semibold"
              : "text-[var(--foreground)]"
          }`}
        >
          {athlete.firstName} {athlete.lastName}
        </span>
        {isDone ? (
          <>
            <span className={`font-mono ${compact ? "text-xs" : "text-sm"} font-semibold text-[var(--color-success-foreground)] shrink-0`}>
              {results[athlete.id]}
            </span>
            {!compact && <Check size={16} className="text-[var(--color-success-foreground)]" />}
          </>
        ) : isSelected ? (
          <Pencil size={compact ? 12 : 16} className="text-[var(--primary-foreground)] shrink-0" />
        ) : (
          <span className={`font-mono ${compact ? "text-xs" : "text-sm"} text-[var(--muted-foreground)] shrink-0`}>
            —
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--background)] overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
        <button onClick={() => router.push("/")} className="cursor-pointer">
          <ArrowLeft size={24} className="text-[var(--foreground)]" />
        </button>
        <h1 className="font-headline text-lg text-[var(--foreground)]">
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
              <span className="font-mono text-base font-semibold text-[var(--secondary-foreground)]">
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

          {isMultiInput ? (
            <>
              <div className="flex flex-col gap-2">
                {assignedMetric!.inputs!.map((inp, i) => {
                  const key = indexToVar(i);
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--primary)] w-16 shrink-0 truncate">
                        {inp.label || key}
                      </span>
                      <div className="flex-1 flex items-center gap-2 h-12 rounded-[var(--radius-m)] bg-[var(--background)] border border-[var(--input)] px-4 overflow-hidden">
                        <input
                          ref={i === 0 ? inputRef : undefined}
                          type="number"
                          step="0.01"
                          value={subValues[key] || ""}
                          onChange={(e) => setSubValues(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder="0.00"
                          className="flex-1 min-w-0 bg-transparent font-mono text-lg font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-[var(--secondary)] rounded-[var(--radius-m)]">
                <span className="font-secondary text-sm text-[var(--muted-foreground)]">
                  Result {assignedMetric?.formula ? `(${assignedMetric.formula})` : "(sum)"}
                </span>
                <span className="font-mono text-2xl font-bold text-[var(--foreground)]">
                  {computedResult !== null ? (Number.isInteger(computedResult) ? computedResult : computedResult.toFixed(2)) : "—"}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 h-16 rounded-[var(--radius-m)] bg-[var(--background)] border-2 border-[var(--primary)] px-5 overflow-hidden">
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
                className="flex-1 min-w-0 bg-transparent font-mono text-3xl font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="font-secondary text-sm text-[var(--muted-foreground)] shrink-0">
                {assignedMetric?.acronym || stationId.toUpperCase()}
              </span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={isMultiInput ? computedResult === null : !value}
            className="h-12 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-base font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save Result
          </button>
        </div>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto">
        {/* Session Stats */}
        {sessionStats && (
          <div className="px-4 py-3">
            <h2 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">
              Session · {sessionStats.recorded.length} recorded
            </h2>

            {/* Top Marks Table */}
            <div className="bg-[var(--card)] border border-[var(--border)] mb-2">
              {/* Header */}
              <div className="flex px-3 py-1 border-b border-[var(--border)]">
                <span className="w-10 font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Yr</span>
                <span className="flex-1 font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Men</span>
                <span className="flex-1 font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Women</span>
              </div>
              {/* Grade rows */}
              {[12, 11, 10, 9].map((grade) => {
                const maleKey = `${grade}-M`;
                const femaleKey = `${grade}-F`;
                const male = sessionStats.topByGroup[maleKey];
                const female = sessionStats.topByGroup[femaleKey];
                if (!male && !female) return null;
                return (
                  <div key={grade} className="flex items-center px-3 py-1 border-b border-[var(--border)] last:border-b-0">
                    <span className="w-10 font-mono text-xs font-semibold text-[var(--foreground)]">
                      {GRADE_LABELS[grade]}
                    </span>
                    <div className="flex-1">
                      {male ? (
                        <>
                          <span className="font-mono text-sm font-bold text-[var(--foreground)]">{male.value}</span>
                          <span className="font-secondary text-[10px] text-[var(--muted-foreground)] ml-1">{male.name}</span>
                        </>
                      ) : (
                        <span className="font-mono text-xs text-[var(--muted-foreground)]">—</span>
                      )}
                    </div>
                    <div className="flex-1">
                      {female ? (
                        <>
                          <span className="font-mono text-sm font-bold text-[var(--foreground)]">{female.value}</span>
                          <span className="font-secondary text-[10px] text-[var(--muted-foreground)] ml-1">{female.name}</span>
                        </>
                      ) : (
                        <span className="font-mono text-xs text-[var(--muted-foreground)]">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Top overall row */}
              <div className="flex items-center px-3 py-1 border-t-2 border-[var(--primary)]">
                <span className="w-10 font-secondary text-[10px] font-bold text-[var(--foreground)] uppercase">Top</span>
                <div className="flex-1">
                  {sessionStats.topMale ? (
                    <>
                      <span className="font-mono text-sm font-bold text-[var(--foreground)]">{sessionStats.topMale.value}</span>
                      <span className="font-secondary text-[10px] text-[var(--muted-foreground)] ml-1">
                        {sessionStats.topMale.athlete!.firstName} {sessionStats.topMale.athlete!.lastName[0]}.
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">—</span>
                  )}
                </div>
                <div className="flex-1">
                  {sessionStats.topFemale ? (
                    <>
                      <span className="font-mono text-sm font-bold text-[var(--foreground)]">{sessionStats.topFemale.value}</span>
                      <span className="font-secondary text-[10px] text-[var(--muted-foreground)] ml-1">
                        {sessionStats.topFemale.athlete!.firstName} {sessionStats.topFemale.athlete!.lastName[0]}.
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* % Change Leaders */}
            {(sessionStats.topHighPct || sessionStats.topLowPct) && (
              <div className="flex gap-2">
                {sessionStats.topHighPct && (
                  <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--color-success)] border border-[var(--border)]">
                    <TrendingUp size={12} className="text-[var(--color-success-foreground)] shrink-0" />
                    <span className="font-mono text-xs font-bold text-[var(--color-success-foreground)]">
                      +{sessionStats.topHighPct.pctChange!.toFixed(1)}%
                    </span>
                    <span className="font-secondary text-[9px] text-[var(--color-success-foreground)] truncate">
                      {sessionStats.topHighPct.athlete!.firstName} {sessionStats.topHighPct.athlete!.lastName[0]}.
                    </span>
                  </div>
                )}
                {sessionStats.topLowPct && (
                  <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--color-error)] border border-[var(--border)]">
                    <TrendingDown size={12} className="text-[var(--color-error-foreground)] shrink-0" />
                    <span className="font-mono text-xs font-bold text-[var(--color-error-foreground)]">
                      {sessionStats.topLowPct.pctChange!.toFixed(1)}%
                    </span>
                    <span className="font-secondary text-[9px] text-[var(--color-error-foreground)] truncate">
                      {sessionStats.topLowPct.athlete!.firstName} {sessionStats.topLowPct.athlete!.lastName[0]}.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Athlete Queue */}
        <div className="px-4 pb-6">
          <div className="sticky top-0 z-10 bg-[var(--background)] pb-2 pt-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2">
                <Search size={16} className="text-[var(--muted-foreground)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search athletes..."
                  className="flex-1 bg-transparent font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
                />
              </div>
              <span className="font-mono text-xs font-semibold text-[var(--muted-foreground)]">
                {completed}/{total}
              </span>
            </div>
          </div>

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
              Men ({maleFiltered.length})
            </button>
            <button
              onClick={() => setGenderTab("F")}
              className={`flex-1 py-1.5 font-secondary text-xs font-semibold text-center transition-colors cursor-pointer ${
                genderTab === "F"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]"
              }`}
            >
              Women ({femaleFiltered.length})
            </button>
          </div>

          {/* Single column (narrow < 350px) */}
          <div className="min-[350px]:hidden">
            <div className="flex flex-col bg-[var(--card)] border border-[var(--border)]">
              {(genderTab === "M" ? maleFiltered : femaleFiltered).map((a) =>
                renderAthleteRow(a, false)
              )}
            </div>
          </div>

          {/* Two columns (>= 350px) */}
          <div className="hidden min-[350px]:grid grid-cols-2 gap-3">
            <div>
              <h3 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                Men ({maleFiltered.length})
              </h3>
              <div className="flex flex-col bg-[var(--card)] border border-[var(--border)]">
                {maleFiltered.map((a) => renderAthleteRow(a, true))}
              </div>
            </div>
            <div>
              <h3 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                Women ({femaleFiltered.length})
              </h3>
              <div className="flex flex-col bg-[var(--card)] border border-[var(--border)]">
                {femaleFiltered.map((a) => renderAthleteRow(a, true))}
              </div>
            </div>
          </div>
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
