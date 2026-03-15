"use client";

import { useRouter } from "next/navigation";
import { Search, Settings, User, LayoutGrid, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase";
import { DynamicIcon } from "@/components/DynamicIcon";
import { Skeleton } from "@/components/Skeleton";

export default function Dashboard() {
  const router = useRouter();
  const { stations, metrics, athletes, loading } = useStore();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "athletes">("overview");
  const [search, setSearch] = useState("");
  const [genderTab, setGenderTab] = useState<"M" | "F">("M");
  const [athletesWithData, setAthletesWithData] = useState<Set<string>>(new Set());
  const [athleteGenderFilter, setAthleteGenderFilter] = useState<"all" | "M" | "F">("all");
  const [athleteGradeFilter, setAthleteGradeFilter] = useState<number | "all">("all");

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
        ) : (
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
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
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
                        : "bg-[var(--secondary)] text-[var(--muted-foreground)] hover:bg-[var(--border)]"
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
        )}
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
