"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Info, Search, Check, Pencil, Undo2, X } from "lucide-react";

const athletes = [
  { id: 1, name: "Alex Smith", initials: "AS", age: 17, events: "Sprints" },
  { id: 2, name: "Maria Rodriguez", initials: "MR", age: 16, events: "Jumps" },
  { id: 3, name: "Jordan Davis", initials: "JD", age: 16, events: "Sprints" },
  { id: 4, name: "Tyler Washington", initials: "TW", age: 15, events: "Distance" },
  { id: 5, name: "Sarah Johnson", initials: "SJ", age: 17, events: "Sprints" },
  { id: 6, name: "Kevin Lee", initials: "KL", age: 16, events: "Throws" },
  { id: 7, name: "Emma Parker", initials: "EP", age: 15, events: "Jumps" },
  { id: 8, name: "Derek Martinez", initials: "DM", age: 17, events: "Sprints" },
];

const stationNames: Record<string, string> = {
  rsi: "RSI Station",
  sprint: "Sprint Splits",
  vertical: "Vertical Jump",
  balance: "Balance",
  explosiveness: "Explosiveness",
  strength: "Strength",
};

const stationInfo: Record<string, string> = {
  rsi: "Best of 3 attempts · Contact Mat",
  sprint: "Electronic timing · 10m splits",
  vertical: "Vertec or jump mat · Best of 3",
  balance: "Single leg · Eyes open · 60s max",
  explosiveness: "Standing broad jump · Best of 3",
  strength: "1RM or max reps · Spotter required",
};

function StationContent() {
  const router = useRouter();
  const params = useSearchParams();
  const stationId = params.get("id") || "rsi";
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [results, setResults] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  const completed = Object.keys(results).length;
  const total = athletes.length;

  useEffect(() => {
    if (selectedId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedId]);

  const handleSelect = (id: number) => {
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

  const filteredAthletes = athletes.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedAthlete = athletes.find((a) => a.id === selectedId);

  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
        <button onClick={() => router.push("/")} className="cursor-pointer">
          <ArrowLeft size={24} className="text-[var(--foreground)]" />
        </button>
        <h1 className="font-primary text-lg font-semibold text-[var(--foreground)]">
          {stationNames[stationId] || "Station"}
        </h1>
        <button onClick={() => setShowInfo(!showInfo)} className="cursor-pointer">
          <Info size={24} className="text-[var(--muted-foreground)]" />
        </button>
      </div>

      {/* Info Bar */}
      {showInfo && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--secondary)]">
          <span className="font-secondary text-xs text-[var(--muted-foreground)]">
            {stationInfo[stationId] || "Follow standard protocol"}
          </span>
          <button onClick={() => setShowInfo(false)} className="ml-auto cursor-pointer">
            <X size={14} className="text-[var(--muted-foreground)]" />
          </button>
        </div>
      )}

      {/* Entry Section */}
      {selectedAthlete && (
        <div className="flex flex-col gap-4 p-5 bg-[var(--card)] border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[var(--secondary)] flex items-center justify-center">
              <span className="font-primary text-base font-semibold text-[var(--secondary-foreground)]">
                {selectedAthlete.initials}
              </span>
            </div>
            <div className="flex-1">
              <div className="font-primary text-base font-semibold text-[var(--foreground)]">
                {selectedAthlete.name}
              </div>
              <div className="font-secondary text-xs text-[var(--muted-foreground)]">
                Age {selectedAthlete.age} · {selectedAthlete.events}
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
              {stationId.toUpperCase()}
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
                onClick={() => handleSelect(athlete.id)}
                disabled={isDone}
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
                    {athlete.initials}
                  </span>
                </div>
                <span
                  className={`flex-1 font-secondary text-sm font-medium ${
                    isSelected
                      ? "text-[var(--primary-foreground)] font-semibold"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {athlete.name}
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
