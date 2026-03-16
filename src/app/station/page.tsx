"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info, Search, Check, Pencil, Undo2, X, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { useSync } from "@/lib/sync-manager";
import { createClient } from "@/lib/supabase";
import { evaluateFormula, indexToVar } from "@/lib/formula";
import { Skeleton } from "@/components/Skeleton";
import { getAllItems, putItem, getItem, addToSyncQueue } from "@/lib/offline-db";

const GRADE_LABELS: Record<number, string> = { 9: "Fr", 10: "So", 11: "Jr", 12: "Sr" };
const fmtVal = (n: number) => parseFloat(n.toFixed(2));

// Time helpers
const splitSeconds = (seconds: number): { min: string; sec: string } => {
  if (!isFinite(seconds)) return { min: "", sec: "" };
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return { min: mins > 0 ? String(mins) : "", sec: secs > 0 ? secs.toFixed(2) : "" };
};

const formatTimeDisplay = (seconds: number): string => {
  if (!isFinite(seconds)) return "";
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs.toFixed(2)}`;
  }
  return seconds.toFixed(2);
};

const timeFieldsToSeconds = (tf: { min: string; sec: string }): number => {
  const mins = parseInt(tf.min, 10) || 0;
  const secs = parseFloat(tf.sec) || 0;
  return mins * 60 + secs;
};

function StationContent() {
  const router = useRouter();
  const params = useSearchParams();
  const stationId = params.get("id") || "rsi";
  const inputRef = useRef<HTMLInputElement>(null);
  const { stations, metrics, athletes } = useStore();
  const { role } = useAuth();
  const { isOnline, refreshPendingCount } = useSync();
  const isSuperAdmin = role === "super_admin";
  const canRecord = isSuperAdmin || role === "admin";

  const station = stations.find(s => s.id === stationId);
  const assignedMetrics = station ? ([...new Set(station.metricIds)].map(id => metrics.find(m => m.id === id)).filter(Boolean) as typeof metrics).sort((a, b) => a.name.localeCompare(b.name)) : [];
  const isMultiMetric = assignedMetrics.length > 1;
  const stationName = station?.name || "Station";

  const [selectedMetricId, setSelectedMetricId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [subValues, setSubValues] = useState<Record<string, string>>({});
  // Multi-metric simultaneous entry state
  const [multiValues, setMultiValues] = useState<Record<string, string>>({});
  const [multiSubValues, setMultiSubValues] = useState<Record<string, Record<string, string>>>({});
  // Time input: separate min/sec fields keyed by metric ID
  const [timeFields, setTimeFields] = useState<Record<string, { min: string; sec: string }>>({});
  // allResults: { metricId: { athleteId: { value, resultId } } }
  const [allResults, setAllResults] = useState<Record<string, Record<string, { value: string; resultId: string }>>>({});
  const [search, setSearch] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [baselines, setBaselines] = useState<Record<string, number>>({});
  const [genderTab, setGenderTab] = useState<"M" | "F">("M");
  const [statsMode, setStatsMode] = useState<"today" | "allTime">("allTime");
  // Hydrate statsMode from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem("stationStatsMode") as "today" | "allTime" | null;
    if (saved) setStatsMode(saved);
  }, []);
  // allTimeResults: best-ever values per metric per athlete
  const [allTimeResults, setAllTimeResults] = useState<Record<string, Record<string, { value: string; resultId: string }>>>({});
  // Toast notifications
  const [toast, setToast] = useState<{ message: string; detail?: string; code?: string; type: "error" | "success" } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (t: typeof toast) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast(t);
    toastTimeout.current = setTimeout(() => setToast(null), t?.type === "error" ? 8000 : 3000);
  };

  // Initialize selectedMetricId when metrics load
  useEffect(() => {
    if (assignedMetrics.length > 0 && !selectedMetricId) {
      setSelectedMetricId(assignedMetrics[0].id);
    }
  }, [assignedMetrics, selectedMetricId]);

  const assignedMetric = metrics.find(m => m.id === selectedMetricId) || assignedMetrics[0] || null;
  const isMultiInput = !!(assignedMetric?.inputs && assignedMetric.inputs.length > 1);

  const stationInfoText = assignedMetric
    ? `${assignedMetric.measurementRules} · ${assignedMetric.gear}`
    : station?.description || "Follow standard protocol";

  // Derived results for the currently selected metric
  const results: Record<string, string> = useMemo(() => {
    const metricResults = allResults[selectedMetricId] || {};
    const out: Record<string, string> = {};
    for (const [aid, r] of Object.entries(metricResults)) {
      out[aid] = r.value;
    }
    return out;
  }, [allResults, selectedMetricId]);

  const resultIds: Record<string, string> = useMemo(() => {
    const metricResults = allResults[selectedMetricId] || {};
    const out: Record<string, string> = {};
    for (const [aid, r] of Object.entries(metricResults)) {
      out[aid] = r.resultId;
    }
    return out;
  }, [allResults, selectedMetricId]);

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

  const visibleAthletes = useMemo(() => athletes.filter(a => !a.hidden), [athletes]);
  const completed = isMultiMetric
    ? visibleAthletes.filter(a => assignedMetrics.every(m => !!allResults[m.id]?.[a.id])).length
    : Object.keys(results).length;
  const total = visibleAthletes.length;

  // Auto-select first incomplete athlete on load
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current || !canRecord || selectedId || assignedMetrics.length === 0 || visibleAthletes.length === 0) return;
    const firstIncomplete = visibleAthletes.find(a =>
      isMultiMetric
        ? !assignedMetrics.every(m => !!allResults[m.id]?.[a.id])
        : !allResults[assignedMetrics[0]?.id]?.[a.id]
    );
    if (firstIncomplete) {
      autoSelectedRef.current = true;
      setSelectedId(firstIncomplete.id);
      // Pre-fill values for the auto-selected athlete
      if (isMultiMetric) {
        const mv: Record<string, string> = {};
        const tf: Record<string, { min: string; sec: string }> = {};
        assignedMetrics.forEach(m => {
          const r = allResults[m.id]?.[firstIncomplete.id];
          if (r) {
            if (m.timeInput) {
              tf[m.id] = splitSeconds(parseFloat(r.value));
            } else {
              mv[m.id] = r.value;
            }
          }
        });
        setMultiValues(mv);
        setTimeFields(tf);
      } else {
        const r = allResults[assignedMetrics[0]?.id]?.[firstIncomplete.id];
        if (r) {
          if (assignedMetrics[0]?.timeInput) {
            setTimeFields({ [assignedMetrics[0].id]: splitSeconds(parseFloat(r.value)) });
          } else {
            setValue(r.value);
          }
        }
      }
    }
  }, [canRecord, selectedId, assignedMetrics, visibleAthletes, allResults]);

  // Load today's results + baselines + all-time bests (IDB-first, then Supabase background refresh)
  useEffect(() => {
    if (!station || station.metricIds.length === 0) return;
    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const cacheKeyBaselines = `baselines-${stationId}`;
    const cacheKeyAllTime = `alltime-${stationId}`;

    const buildResultsMap = (rows: { id: string; athlete_id: string; metric_id: string; value: number }[]) => {
      const m: Record<string, Record<string, { value: string; resultId: string }>> = {};
      rows.forEach(r => {
        if (!m[r.metric_id]) m[r.metric_id] = {};
        if (!(r.athlete_id in m[r.metric_id])) {
          m[r.metric_id][r.athlete_id] = { value: String(r.value), resultId: r.id };
        }
      });
      return m;
    };

    // Step 1: Instant load from IDB cache
    (async () => {
      try {
        // Today's results from IDB
        const idbResults = await getAllItems<{ id: string; athlete_id: string; metric_id: string; value: number; recorded_at?: string }>("results");
        const todayResults = idbResults.filter(r =>
          station!.metricIds.includes(r.metric_id) && r.recorded_at && r.recorded_at >= todayISO
        );
        if (todayResults.length > 0) {
          todayResults.sort((a, b) => (b.recorded_at || "").localeCompare(a.recorded_at || ""));
          setAllResults(buildResultsMap(todayResults as { id: string; athlete_id: string; metric_id: string; value: number }[]));
        }

        // Baselines from IDB meta
        const cachedBaselines = await getItem<{ key: string; data: Record<string, number> }>("meta", cacheKeyBaselines);
        if (cachedBaselines?.data) setBaselines(cachedBaselines.data);

        // All-time bests from IDB meta
        const cachedAllTime = await getItem<{ key: string; data: Record<string, Record<string, { value: string; resultId: string }>> }>("meta", cacheKeyAllTime);
        if (cachedAllTime?.data) setAllTimeResults(cachedAllTime.data);
      } catch {
        // IDB not available
      }
    })();

    // Step 2: Background refresh from Supabase
    (async () => {
      const { data: todayData } = await supabase
        .from("results")
        .select("id, athlete_id, metric_id, value")
        .in("metric_id", station!.metricIds)
        .gte("recorded_at", todayISO)
        .order("recorded_at", { ascending: false });

      if (todayData) {
        setAllResults(buildResultsMap(todayData as { id: string; athlete_id: string; metric_id: string; value: number }[]));
      }

      const { data: baselineData } = await supabase
        .from("results")
        .select("athlete_id, value")
        .eq("metric_id", station!.metricIds[0])
        .lt("recorded_at", todayISO)
        .order("recorded_at", { ascending: false })
        .limit(200);

      if (baselineData) {
        const prev: Record<string, number> = {};
        baselineData.forEach((r: { athlete_id: string; value: number }) => {
          if (!(r.athlete_id in prev)) prev[r.athlete_id] = Number(r.value);
        });
        setBaselines(prev);
        try { await putItem("meta", { key: cacheKeyBaselines, data: prev }); } catch {}
      }

      const { data: bestData } = await supabase
        .rpc("best_results", { metric_ids: station!.metricIds });

      if (bestData) {
        const allTimeBests = buildResultsMap(bestData as { id: string; athlete_id: string; metric_id: string; value: number }[]);
        setAllTimeResults(allTimeBests);
        try { await putItem("meta", { key: cacheKeyAllTime, data: allTimeBests }); } catch {}
      }
    })();
  }, [station?.metricIds.join(",")]);

  useEffect(() => {
    if (selectedId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedId]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const tf: Record<string, { min: string; sec: string }> = {};
    if (isMultiMetric) {
      // Pre-fill all metric values for this athlete
      const mv: Record<string, string> = {};
      assignedMetrics.forEach(m => {
        const r = allResults[m.id]?.[id];
        if (r) {
          if (m.timeInput) {
            tf[m.id] = splitSeconds(parseFloat(r.value));
          } else {
            mv[m.id] = r.value;
          }
        }
      });
      setMultiValues(mv);
      setMultiSubValues({});
      setTimeFields(tf);
    } else {
      if (results[id]) {
        if (assignedMetric?.timeInput) {
          tf[assignedMetric.id] = splitSeconds(parseFloat(results[id]));
        } else {
          setValue(results[id]);
        }
      } else {
        setValue("");
      }
      setSubValues({});
      setTimeFields(tf);
    }
  };

  const updateAllTime = (metricId: string, athleteId: string, numVal: number, resultId: string) => {
    const valStr = Number.isInteger(numVal) ? String(numVal) : numVal.toFixed(2);
    setAllTimeResults(prev => {
      const existing = prev[metricId]?.[athleteId];
      const lower = assignedMetric?.lowerIsBetter ?? false;
      if (!existing || (lower ? numVal < parseFloat(existing.value) : numVal > parseFloat(existing.value))) {
        return { ...prev, [metricId]: { ...(prev[metricId] || {}), [athleteId]: { value: valStr, resultId } } };
      }
      return prev;
    });
  };

  // Save a single metric result (shared by single-metric and multi-metric paths)
  const saveOneMetric = async (
    supabase: ReturnType<typeof createClient>,
    athleteId: string,
    metric: typeof assignedMetrics[0],
    numVal: number,
    existingId: string | undefined,
    extras?: Record<string, unknown>,
  ) => {
    const buildPayload = (val: number, ex?: Record<string, unknown>) => ({
      athlete_id: athleteId,
      metric_id: metric.id,
      value: val,
      unit: metric.acronym || "",
      recorded_at: new Date().toISOString(),
      ...ex,
    });

    const saveOffline = async (val: number, ex?: Record<string, unknown>) => {
      const tempId = `temp-${crypto.randomUUID()}`;
      const payload = { id: existingId || tempId, ...buildPayload(val, ex) };
      await putItem("results", payload);
      await addToSyncQueue({
        table: "results",
        operation: existingId ? "UPDATE" : "INSERT",
        payload: existingId ? { id: existingId, ...buildPayload(val, ex) } : buildPayload(val, ex),
        created_at: new Date().toISOString(),
        status: "pending",
        attempts: 0,
        temp_id: existingId ? undefined : tempId,
      });
      refreshPendingCount();
      return existingId || tempId;
    };

    if (!isOnline) return saveOffline(numVal, extras);

    if (existingId) {
      const { data: updated, error } = await supabase.from("results")
        .update({ value: numVal, ...extras })
        .eq("id", existingId)
        .select("id").maybeSingle();
      if (error) return saveOffline(numVal, extras);
      if (updated) {
        await putItem("results", { id: existingId, ...buildPayload(numVal, extras) });
        return existingId;
      }
    }

    const { data, error } = await supabase.from("results").insert({
      athlete_id: athleteId,
      metric_id: metric.id,
      value: numVal,
      unit: metric.acronym || "",
      ...extras,
    }).select("id").maybeSingle();
    if (error || !data?.id) return saveOffline(numVal, extras);
    await putItem("results", { id: data.id, ...buildPayload(numVal, extras) });
    return data.id;
  };

  const handleSave = async () => {
    if (!selectedId || saving) return;
    if (assignedMetrics.length === 0) {
      showToast({ message: "No metric assigned to this station. Add a metric in Settings first.", code: "R-000", type: "error" });
      return;
    }

    setSaving(true);
    const supabase = createClient();
    let savedAny = false;
    let offlineAny = false;

    try {
      if (isMultiMetric) {
        // Multi-metric: save all non-empty values
        for (const m of assignedMetrics) {
          const mIsMultiInput = !!(m.inputs && m.inputs.length > 1);
          const existingId = allResults[m.id]?.[selectedId]?.resultId;

          if (mIsMultiInput) {
            // Formula metric within multi-metric station
            const mSubValues = multiSubValues[m.id] || {};
            const numericVals: Record<string, number> = {};
            let allFilled = true;
            m.inputs!.forEach((_, i) => {
              const key = indexToVar(i);
              const raw = mSubValues[key];
              if (!raw || raw === "") { allFilled = false; return; }
              const n = parseFloat(raw);
              if (isNaN(n)) { allFilled = false; return; }
              numericVals[key] = n;
            });
            if (!allFilled) continue;
            const formula = m.formula || m.inputs!.map((_, i) => indexToVar(i)).join(" + ");
            let computed: number;
            try { computed = evaluateFormula(formula, numericVals); } catch { continue; }
            if (!isFinite(computed)) continue;

            const savedId = await saveOneMetric(supabase, selectedId, m, computed, existingId, { sub_values: numericVals });
            if (savedId) {
              const displayVal = Number.isInteger(computed) ? String(computed) : computed.toFixed(2);
              setAllResults(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), [selectedId]: { value: displayVal, resultId: savedId } } }));
              updateAllTime(m.id, selectedId, computed, savedId);
              savedAny = true;
              if (savedId.startsWith("temp-")) offlineAny = true;
            }
          } else {
            // Simple metric
            let numVal: number;
            if (m.timeInput) {
              const tf = timeFields[m.id];
              if (!tf || (tf.min === "" && tf.sec === "")) continue;
              numVal = timeFieldsToSeconds(tf);
            } else {
              const raw = multiValues[m.id];
              if (!raw || raw === "") continue;
              numVal = parseFloat(raw);
            }
            if (isNaN(numVal)) continue;
            if (m.minValue != null && numVal < m.minValue) continue;
            if (m.maxValue != null && numVal > m.maxValue) continue;

            const savedId = await saveOneMetric(supabase, selectedId, m, numVal, existingId);
            if (savedId) {
              const displayVal = Number.isInteger(numVal) ? String(numVal) : numVal.toFixed(2);
              setAllResults(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), [selectedId]: { value: displayVal, resultId: savedId } } }));
              updateAllTime(m.id, selectedId, numVal, savedId);
              savedAny = true;
              if (savedId.startsWith("temp-")) offlineAny = true;
            }
          }
        }
        if (savedAny) {
          if (offlineAny) showToast({ message: "Saved offline", type: "success" });
          setSelectedId(null);
          setMultiValues({});
          setMultiSubValues({});
          setTimeFields({});
        }
      } else {
        // Single-metric save
        const metric = assignedMetric!;
        const mIsMultiInput = !!(metric.inputs && metric.inputs.length > 1);
        const existingId = resultIds[selectedId];

        if (mIsMultiInput && computedResult !== null) {
          const numericSubVals: Record<string, number> = {};
          metric.inputs!.forEach((_, i) => {
            const key = indexToVar(i);
            numericSubVals[key] = parseFloat(subValues[key]);
          });
          const savedId = await saveOneMetric(supabase, selectedId, metric, computedResult, existingId, { sub_values: numericSubVals });
          if (savedId) {
            const displayVal = Number.isInteger(computedResult) ? String(computedResult) : computedResult.toFixed(2);
            setAllResults(prev => ({ ...prev, [metric.id]: { ...(prev[metric.id] || {}), [selectedId]: { value: displayVal, resultId: savedId } } }));
            updateAllTime(metric.id, selectedId, computedResult, savedId);
            if (savedId.startsWith("temp-")) showToast({ message: "Saved offline", type: "success" });
            setSelectedId(null);
            setSubValues({});
          }
        } else {
          let numVal: number;
          if (metric.timeInput) {
            const tf = timeFields[metric.id];
            if (!tf || (tf.min === "" && tf.sec === "")) { setSaving(false); return; }
            numVal = timeFieldsToSeconds(tf);
          } else {
            if (!value) { setSaving(false); return; }
            numVal = parseFloat(value);
          }
          if (isNaN(numVal)) { showToast({ message: "Enter a valid number.", code: "R-001", type: "error" }); setSaving(false); return; }
          if (metric.minValue != null && numVal < metric.minValue) { showToast({ message: `Value must be at least ${metric.minValue}.`, code: "R-002", type: "error" }); setSaving(false); return; }
          if (metric.maxValue != null && numVal > metric.maxValue) { showToast({ message: `Value must be at most ${metric.maxValue}.`, code: "R-003", type: "error" }); setSaving(false); return; }

          const savedId = await saveOneMetric(supabase, selectedId, metric, numVal, existingId);
          if (savedId) {
            const displayVal = Number.isInteger(numVal) ? String(numVal) : numVal.toFixed(2);
            setAllResults(prev => ({ ...prev, [metric.id]: { ...(prev[metric.id] || {}), [selectedId]: { value: displayVal, resultId: savedId } } }));
            updateAllTime(metric.id, selectedId, numVal, savedId);
            if (savedId.startsWith("temp-")) showToast({ message: "Saved offline", type: "success" });
            setSelectedId(null);
            setValue("");
            setTimeFields({});
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ message: "Something went wrong. Please try again.", detail: `Unexpected: ${msg}`, code: "R-099", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedEntry = selectedId !== null && (
    value !== "" ||
    Object.values(subValues).some(v => v !== "") ||
    Object.values(multiValues).some(v => v !== "") ||
    Object.values(multiSubValues).some(sv => Object.values(sv).some(v => v !== "")) ||
    Object.values(timeFields).some(tf => tf.min !== "" || tf.sec !== "")
  );

  const handleBack = () => {
    if (hasUnsavedEntry) {
      if (!confirm("You have an unsaved result. Leave without saving?")) return;
    }
    router.push("/");
  };

  const handleUndo = () => {
    setSelectedId(null);
    setValue("");
    setSubValues({});
    setMultiValues({});
    setMultiSubValues({});
    setTimeFields({});
  };

  const filteredAthletes = visibleAthletes.filter((a) => {
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
    const lower = assignedMetric?.lowerIsBetter ?? false;
    const isBetter = (a: number, b: number) => lower ? a < b : a > b;
    const sortBest = (a: { value: number }, b: { value: number }) => lower ? a.value - b.value : b.value - a.value;

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
      if (!topByGroup[key] || isBetter(r.value, topByGroup[key].value)) {
        topByGroup[key] = { value: r.value, name: `${a.firstName} ${a.lastName[0]}.` };
      }
    });

    const topMale = recorded
      .filter((r) => r.athlete!.gender === "M")
      .sort(sortBest)[0];
    const topFemale = recorded
      .filter((r) => r.athlete!.gender === "F")
      .sort(sortBest)[0];

    const topOverall = [...recorded].sort(sortBest)[0];

    const withChange = recorded.filter((r) => r.pctChange !== null);
    const topHighPct = withChange.length
      ? [...withChange].sort((a, b) => b.pctChange! - a.pctChange!)[0]
      : null;
    const topLowPct = withChange.length
      ? [...withChange].sort((a, b) => a.pctChange! - b.pctChange!)[0]
      : null;

    return { topByGroup, topMale, topFemale, topOverall, topHighPct, topLowPct, recorded };
  }, [results, athletes, baselines, assignedMetric?.lowerIsBetter]);

  // All-time best results for the selected metric
  const allTimeBestForMetric: Record<string, string> = useMemo(() => {
    const metricResults = allTimeResults[selectedMetricId] || {};
    const out: Record<string, string> = {};
    for (const [aid, r] of Object.entries(metricResults)) {
      out[aid] = r.value;
    }
    return out;
  }, [allTimeResults, selectedMetricId]);

  // Compute all-time stats (same structure as sessionStats)
  const allTimeStats = useMemo(() => {
    const entries = Object.entries(allTimeBestForMetric);
    if (entries.length === 0) return null;
    const lower = assignedMetric?.lowerIsBetter ?? false;
    const isBetter = (a: number, b: number) => lower ? a < b : a > b;
    const sortBest = (a: { value: number }, b: { value: number }) => lower ? a.value - b.value : b.value - a.value;

    const recorded = entries.map(([athleteId, val]) => {
      const athlete = athletes.find((a) => a.id === athleteId);
      const numVal = parseFloat(val);
      return { athlete, value: numVal, pctChange: null as number | null };
    }).filter((r) => r.athlete);

    const topByGroup: Record<string, { value: number; name: string }> = {};
    recorded.forEach((r) => {
      const a = r.athlete!;
      const key = `${a.grade}-${a.gender}`;
      if (!topByGroup[key] || isBetter(r.value, topByGroup[key].value)) {
        topByGroup[key] = { value: r.value, name: `${a.firstName} ${a.lastName[0]}.` };
      }
    });

    const topMale = recorded.filter((r) => r.athlete!.gender === "M").sort(sortBest)[0];
    const topFemale = recorded.filter((r) => r.athlete!.gender === "F").sort(sortBest)[0];
    const topOverall = [...recorded].sort(sortBest)[0];

    return { topByGroup, topMale, topFemale, topOverall, topHighPct: null, topLowPct: null, recorded };
  }, [allTimeBestForMetric, athletes, assignedMetric?.lowerIsBetter]);

  const activeStats = statsMode === "allTime" ? allTimeStats : sessionStats;
  const showStats = sessionStats !== null || allTimeStats !== null;

  const renderAthleteRow = (athlete: typeof athletes[0], compact: boolean) => {
    const isDone = isMultiMetric
      ? assignedMetrics.every(m => !!allResults[m.id]?.[athlete.id])
      : !!results[athlete.id];
    const isSelected = selectedId === athlete.id;

    // Collect all metric values for this athlete (for inline display)
    const metricValues = isMultiMetric ? assignedMetrics.map(m => {
      const r = allResults[m.id]?.[athlete.id];
      if (!r) return null;
      const num = parseFloat(r.value);
      return m.timeInput ? formatTimeDisplay(num) : String(fmtVal(num));
    }) : null;

    return (
      <button
        key={athlete.id}
        onClick={() => canRecord && handleSelect(athlete.id)}
        disabled={!canRecord}
        className={`flex items-center ${compact ? "gap-2 px-2.5 py-2" : "gap-3 px-4 py-3"} w-full border-b border-[var(--border)] last:border-b-0 text-left transition-colors cursor-pointer disabled:cursor-default ${
          isSelected
            ? "bg-[var(--primary)]"
            : isDone
            ? "bg-[var(--color-success)] hover:opacity-90"
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
        {/* Multi-metric inline values */}
        {isMultiMetric && metricValues && !isSelected && (
          <div className="flex items-center gap-1 shrink-0">
            {metricValues.map((v, i) => (
              <span
                key={assignedMetrics[i].id}
                className={`font-mono ${compact ? "text-[9px]" : "text-[10px]"} font-semibold ${
                  v !== null
                    ? assignedMetrics[i].id === selectedMetricId
                      ? "text-[var(--color-success-foreground)]"
                      : "text-[var(--muted-foreground)]"
                    : "text-[var(--muted-foreground)] opacity-30"
                }`}
              >
                {v !== null ? v : "—"}
              </span>
            ))}
          </div>
        )}
        {/* Single metric value display */}
        {!isMultiMetric && isDone && !isSelected ? (
          <>
            <span className={`font-mono ${compact ? "text-xs" : "text-sm"} font-semibold text-[var(--color-success-foreground)] shrink-0`}>
              {assignedMetric?.timeInput ? formatTimeDisplay(parseFloat(results[athlete.id])) : fmtVal(parseFloat(results[athlete.id]))}
            </span>
            {!compact && canRecord ? (
              <Pencil size={14} className="text-[var(--color-success-foreground)] opacity-60 shrink-0" />
            ) : !compact ? (
              <Check size={16} className="text-[var(--color-success-foreground)]" />
            ) : null}
          </>
        ) : isSelected ? (
          <Pencil size={compact ? 12 : 16} className="text-[var(--primary-foreground)] shrink-0" />
        ) : !isMultiMetric ? (
          <span className={`font-mono ${compact ? "text-xs" : "text-sm"} text-[var(--muted-foreground)] shrink-0`}>
            —
          </span>
        ) : null}
        {/* Multi-metric: show pencil/check for selected metric */}
        {isMultiMetric && isDone && !isSelected && (
          canRecord ? (
            <Pencil size={compact ? 10 : 14} className="text-[var(--color-success-foreground)] opacity-60 shrink-0" />
          ) : (
            <Check size={compact ? 12 : 16} className="text-[var(--color-success-foreground)] shrink-0" />
          )
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--background)] overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
        <button onClick={handleBack} className="cursor-pointer">
          <ArrowLeft size={24} className="text-[var(--foreground)]" />
        </button>
        <h1 className="font-headline text-lg font-bold text-[var(--foreground)]">
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

      {/* No metrics warning */}
      {assignedMetrics.length === 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-[var(--color-error)] border-b border-[var(--border)]">
          <AlertTriangle size={16} className="text-[var(--destructive)] shrink-0" />
          <p className="font-secondary text-sm font-medium text-[var(--destructive)]">
            No metrics assigned to this station. Add metrics in Settings.
          </p>
        </div>
      )}

      {/* Multi-metric header bar */}
      {isMultiMetric && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--card)] border-b border-[var(--border)]">
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
            {assignedMetrics.map((m) => (
              <span key={m.id} className="px-2 py-0.5 rounded-full bg-[var(--secondary)] font-mono text-[10px] font-bold text-[var(--muted-foreground)] shrink-0">
                {m.acronym}
              </span>
            ))}
          </div>
          <span className="font-mono text-xs text-[var(--muted-foreground)] shrink-0">
            {completed}/{total}
          </span>
        </div>
      )}

      {/* Entry Section */}
      {canRecord && selectedAthlete && (
        <div className="flex flex-col items-center gap-4 px-5 py-5 bg-[var(--card)] border-b border-[var(--border)]">
          {/* Compact athlete info */}
          <div className="flex items-center justify-between w-full">
            <span className="font-secondary text-sm text-[var(--foreground)]">
              {selectedAthlete.firstName} {selectedAthlete.lastName}
              <span className="text-[var(--muted-foreground)]"> · Gr {selectedAthlete.grade}</span>
            </span>
            <button onClick={handleUndo} className="cursor-pointer">
              <Undo2 size={18} className="text-[var(--muted-foreground)]" />
            </button>
          </div>

          {isMultiMetric ? (
            /* Multi-metric: one input row per metric */
            <div className="w-full flex flex-col gap-3">
              {assignedMetrics.map((m, mIdx) => {
                const mIsFormula = !!(m.inputs && m.inputs.length > 1);
                if (mIsFormula) {
                  const mSubs = multiSubValues[m.id] || {};
                  // Compute result for this formula metric
                  let formulaResult: number | null = null;
                  const numVals: Record<string, number> = {};
                  let allFilled = true;
                  m.inputs!.forEach((_, i) => {
                    const k = indexToVar(i);
                    const raw = mSubs[k];
                    if (!raw || raw === "") { allFilled = false; return; }
                    const n = parseFloat(raw);
                    if (isNaN(n)) { allFilled = false; return; }
                    numVals[k] = n;
                  });
                  if (allFilled) {
                    try {
                      const f = m.formula || m.inputs!.map((_, i) => indexToVar(i)).join(" + ");
                      const r = evaluateFormula(f, numVals);
                      if (isFinite(r)) formulaResult = r;
                    } catch { /* skip */ }
                  }
                  return (
                    <div key={m.id} className="flex flex-col gap-1.5">
                      <span className="font-mono text-xs font-bold text-[var(--primary)]">{m.acronym}</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {m.inputs!.map((inp, i) => {
                          const key = indexToVar(i);
                          return (
                            <div key={key} className="flex items-center gap-1">
                              <span className="font-mono text-[10px] text-[var(--muted-foreground)]">{inp.label || key}</span>
                              <input
                                ref={mIdx === 0 && i === 0 ? inputRef : undefined}
                                type="text"
                                inputMode="decimal"
                                value={mSubs[key] || ""}
                                onChange={(e) => setMultiSubValues(prev => ({
                                  ...prev,
                                  [m.id]: { ...(prev[m.id] || {}), [key]: e.target.value },
                                }))}
                                placeholder="0"
                                className="w-16 h-10 rounded-[var(--radius-m)] bg-[var(--background)] border border-[var(--input)] px-2 font-mono text-sm font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none text-center"
                              />
                            </div>
                          );
                        })}
                        <span className="font-mono text-sm font-bold text-[var(--foreground)] ml-1">
                          = {formulaResult !== null ? (Number.isInteger(formulaResult) ? formulaResult : formulaResult.toFixed(2)) : "—"}
                        </span>
                      </div>
                    </div>
                  );
                }
                // Simple metric input (or time input with min/sec fields)
                if (m.timeInput) {
                  const tf = timeFields[m.id] || { min: "", sec: "" };
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-[var(--primary)] w-12 shrink-0">{m.acronym}</span>
                      <input
                        ref={mIdx === 0 ? inputRef : undefined}
                        type="text"
                        inputMode="numeric"
                        value={tf.min}
                        onChange={(e) => setTimeFields(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || { min: "", sec: "" }), min: e.target.value } }))}
                        placeholder="0"
                        className="w-16 h-12 rounded-[var(--radius-m)] bg-[var(--background)] border border-[var(--input)] px-2 font-mono text-lg font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none text-center"
                      />
                      <span className="font-mono text-lg font-bold text-[var(--muted-foreground)]">:</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={tf.sec}
                        onChange={(e) => setTimeFields(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || { min: "", sec: "" }), sec: e.target.value } }))}
                        placeholder="00.00"
                        className="w-20 h-12 rounded-[var(--radius-m)] bg-[var(--background)] border border-[var(--input)] px-2 font-mono text-lg font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none text-center"
                      />
                    </div>
                  );
                }
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-[var(--primary)] w-12 shrink-0">{m.acronym}</span>
                    <input
                      ref={mIdx === 0 ? inputRef : undefined}
                      type="text"
                      inputMode="decimal"
                      value={multiValues[m.id] || ""}
                      onChange={(e) => setMultiValues(prev => ({ ...prev, [m.id]: e.target.value }))}
                      placeholder="0.00"
                      className="flex-1 min-w-0 h-12 rounded-[var(--radius-m)] bg-[var(--background)] border border-[var(--input)] px-4 font-mono text-lg font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none text-center"
                    />
                  </div>
                );
              })}
            </div>
          ) : isMultiInput ? (
            <>
              <div className="w-full max-w-[320px] flex flex-col gap-2">
                {assignedMetric!.inputs!.map((inp, i) => {
                  const key = indexToVar(i);
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[var(--primary)] w-14 shrink-0 truncate">
                        {inp.label || key}
                      </span>
                      <input
                        ref={i === 0 ? inputRef : undefined}
                        type="text"
                        inputMode="decimal"
                        value={subValues[key] || ""}
                        onChange={(e) => setSubValues(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder="0.00"
                        className="flex-1 min-w-0 h-12 rounded-[var(--radius-m)] bg-[var(--background)] border border-[var(--input)] px-4 font-mono text-lg font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none text-center"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-secondary text-sm text-[var(--muted-foreground)]">
                  {assignedMetric?.formula ? `(${assignedMetric.formula})` : "="}
                </span>
                <span className="font-mono text-3xl font-bold text-[var(--foreground)]">
                  {computedResult !== null ? (Number.isInteger(computedResult) ? computedResult : computedResult.toFixed(2)) : "—"}
                </span>
              </div>
            </>
          ) : assignedMetric?.timeInput ? (
            <div className="flex flex-col items-center py-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    value={timeFields[assignedMetric.id]?.min ?? ""}
                    onChange={(e) => setTimeFields(prev => ({ ...prev, [assignedMetric!.id]: { ...(prev[assignedMetric!.id] || { min: "", sec: "" }), min: e.target.value } }))}
                    placeholder="0"
                    className="w-20 bg-transparent font-mono text-5xl font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none text-center border-b-2 border-[var(--primary)] pb-2"
                  />
                  <span className="font-secondary text-[10px] text-[var(--muted-foreground)] mt-1">min</span>
                </div>
                <span className="font-mono text-4xl font-bold text-[var(--muted-foreground)] pb-2">:</span>
                <div className="flex flex-col items-center">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={timeFields[assignedMetric.id]?.sec ?? ""}
                    onChange={(e) => setTimeFields(prev => ({ ...prev, [assignedMetric!.id]: { ...(prev[assignedMetric!.id] || { min: "", sec: "" }), sec: e.target.value } }))}
                    placeholder="00.00"
                    className="w-28 bg-transparent font-mono text-5xl font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none text-center border-b-2 border-[var(--primary)] pb-2"
                  />
                  <span className="font-secondary text-[10px] text-[var(--muted-foreground)] mt-1">sec</span>
                </div>
              </div>
              <span className="font-secondary text-sm text-[var(--muted-foreground)] mt-2">
                {assignedMetric.acronym}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center py-2">
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.00"
                className="w-full max-w-[240px] bg-transparent font-mono text-5xl font-bold text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none text-center border-b-2 border-[var(--primary)] pb-2"
              />
              <span className="font-secondary text-sm text-[var(--muted-foreground)] mt-2">
                {assignedMetric?.acronym || stationId.toUpperCase()}
              </span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || (
              isMultiMetric
                ? !Object.values(multiValues).some(v => v !== "") && !Object.values(multiSubValues).some(sv => Object.values(sv).some(v => v !== "")) && !Object.values(timeFields).some(tf => tf.min !== "" || tf.sec !== "")
                : isMultiInput ? computedResult === null : assignedMetric?.timeInput ? !Object.values(timeFields).some(tf => tf.min !== "" || tf.sec !== "") : !value
            )}
            className="w-full max-w-[280px] h-12 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-base font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : (
              isMultiMetric
                ? (assignedMetrics.some(m => !!allResults[m.id]?.[selectedId!]) ? "Update Results" : "Save Results")
                : (selectedId && resultIds[selectedId] ? "Update Result" : "Save Result")
            )}
          </button>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`flex items-start gap-2.5 px-4 py-3 border-b border-[var(--border)] ${toast.type === "error" ? "bg-[var(--color-error)]" : "bg-[var(--color-success)]"}`}>
          {toast.type === "error" && <AlertTriangle size={16} className="text-[var(--destructive)] shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className={`font-secondary text-sm font-medium ${toast.type === "error" ? "text-[var(--destructive)]" : "text-[var(--color-success-foreground)]"}`}>
              {toast.message}
              {toast.code && <span className="font-mono text-xs opacity-70 ml-1.5">({toast.code})</span>}
            </p>
            {isSuperAdmin && toast.detail && (
              <p className="font-mono text-xs text-[var(--destructive)] opacity-80 mt-0.5">{toast.detail}</p>
            )}
            {toast.type === "error" && (
              <a
                href={`mailto:douglas.burnett@k12.canby.or.us?subject=Bug Report ${toast.code || ""}&body=${encodeURIComponent(`Error: ${toast.code || "unknown"}\n${toast.detail || toast.message}\n\nSteps to reproduce:\n`)}`}
                className="font-secondary text-xs text-[var(--destructive)] underline mt-1 inline-block"
              >
                Report bug
              </a>
            )}
          </div>
          <button onClick={() => setToast(null)} className="cursor-pointer shrink-0 mt-0.5">
            <X size={14} className={toast.type === "error" ? "text-[var(--destructive)]" : "text-[var(--color-success-foreground)]"} />
          </button>
        </div>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 overflow-auto">
        {/* Session Stats */}
        {showStats && (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                {statsMode === "today" ? "Session" : "All Time"}{activeStats ? ` · ${activeStats.recorded.length} recorded` : ""}
              </h2>
              <div className="flex bg-[var(--secondary)] rounded-full p-0.5">
                <button
                  onClick={() => { setStatsMode("today"); localStorage.setItem("stationStatsMode", "today"); }}
                  className={`px-2 py-0.5 rounded-full font-secondary text-[10px] font-semibold transition-colors cursor-pointer ${
                    statsMode === "today" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)]"
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => { setStatsMode("allTime"); localStorage.setItem("stationStatsMode", "allTime"); }}
                  className={`px-2 py-0.5 rounded-full font-secondary text-[10px] font-semibold transition-colors cursor-pointer ${
                    statsMode === "allTime" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)]"
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>

            {activeStats ? (
            <>
            {/* Top Marks Table */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)] mb-2">
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
                const male = activeStats.topByGroup[maleKey];
                const female = activeStats.topByGroup[femaleKey];
                if (!male && !female) return null;
                return (
                  <div key={grade} className="flex items-center px-3 py-1 border-b border-[var(--border)] last:border-b-0">
                    <span className="w-10 font-mono text-xs font-semibold text-[var(--foreground)]">
                      {GRADE_LABELS[grade]}
                    </span>
                    <div className="flex-1">
                      {male ? (
                        <>
                          <span className="font-mono text-sm font-bold text-[var(--foreground)]">{fmtVal(male.value)}</span>
                          <span className="font-secondary text-[10px] text-[var(--muted-foreground)] ml-1">{male.name}</span>
                        </>
                      ) : (
                        <span className="font-mono text-xs text-[var(--muted-foreground)]">—</span>
                      )}
                    </div>
                    <div className="flex-1">
                      {female ? (
                        <>
                          <span className="font-mono text-sm font-bold text-[var(--foreground)]">{fmtVal(female.value)}</span>
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
                  {activeStats.topMale ? (
                    <>
                      <span className="font-mono text-sm font-bold text-[var(--foreground)]">{fmtVal(activeStats.topMale.value)}</span>
                      <span className="font-secondary text-[10px] text-[var(--muted-foreground)] ml-1">
                        {activeStats.topMale.athlete!.firstName} {activeStats.topMale.athlete!.lastName[0]}.
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">—</span>
                  )}
                </div>
                <div className="flex-1">
                  {activeStats.topFemale ? (
                    <>
                      <span className="font-mono text-sm font-bold text-[var(--foreground)]">{fmtVal(activeStats.topFemale.value)}</span>
                      <span className="font-secondary text-[10px] text-[var(--muted-foreground)] ml-1">
                        {activeStats.topFemale.athlete!.firstName} {activeStats.topFemale.athlete!.lastName[0]}.
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* % Change Leaders (today only) */}
            {statsMode === "today" && (activeStats.topHighPct || activeStats.topLowPct) && (
              <div className="flex gap-2">
                {activeStats.topHighPct && (
                  <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                    <TrendingUp size={12} className="text-[var(--color-success-foreground)] shrink-0" />
                    <span className="font-mono text-xs font-bold text-[var(--color-success-foreground)]">
                      +{activeStats.topHighPct.pctChange!.toFixed(1)}%
                    </span>
                    <span className="font-secondary text-[9px] text-[var(--muted-foreground)] truncate">
                      {activeStats.topHighPct.athlete!.firstName} {activeStats.topHighPct.athlete!.lastName[0]}.
                    </span>
                  </div>
                )}
                {activeStats.topLowPct && (
                  <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                    <TrendingDown size={12} className="text-[var(--color-error-foreground)] shrink-0" />
                    <span className="font-mono text-xs font-bold text-[var(--color-error-foreground)]">
                      {activeStats.topLowPct.pctChange!.toFixed(1)}%
                    </span>
                    <span className="font-secondary text-[9px] text-[var(--muted-foreground)] truncate">
                      {activeStats.topLowPct.athlete!.firstName} {activeStats.topLowPct.athlete!.lastName[0]}.
                    </span>
                  </div>
                )}
              </div>
            )}
            </>
            ) : (
              <p className="font-secondary text-xs text-[var(--muted-foreground)] text-center py-3">
                No {statsMode === "today" ? "results today" : "results"} yet
              </p>
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
            <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
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
              <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                {maleFiltered.map((a) => renderAthleteRow(a, true))}
              </div>
            </div>
            <div>
              <h3 className="font-secondary text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1.5">
                Women ({femaleFiltered.length})
              </h3>
              <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-s)]">
                {femaleFiltered.map((a) => renderAthleteRow(a, true))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StationSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="w-6 h-6 rounded-full" />
      </div>
      <div className="flex-1 overflow-auto px-4 pt-3">
        <Skeleton className="h-3 w-20 mb-3" />
        <div className="flex flex-col gap-0">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <Skeleton className="h-3.5 w-28 flex-1" />
              <Skeleton className="h-3.5 w-6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StationPage() {
  return (
    <Suspense fallback={<StationSkeleton />}>
      <StationContent />
    </Suspense>
  );
}
