"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info, Search, Check, Pencil, Undo2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";

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

  const completed = Object.keys(results).length;
  const total = athletes.length;

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

  const handleSave = () => {
    if (selectedId && value) {
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
