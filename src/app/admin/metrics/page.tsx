"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, X, Check, LayoutGrid, Users, UserRound, Copy, ChevronRight, Ruler } from "lucide-react";
import { useStore, AVAILABLE_ICONS, type Metric, type MetricInput, type Station, type Athlete } from "@/lib/store";
import { indexToVar } from "@/lib/formula";
import { useAuth, type UserRole } from "@/lib/auth-context";
import { DynamicIcon } from "@/components/DynamicIcon";
import { createClient } from "@/lib/supabase";
import { Skeleton } from "@/components/Skeleton";

type View = "list" | "metrics" | "editMetric" | "categories" | "units" | "stations" | "editStation" | "team" | "athletes" | "editAthlete";

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

interface Invite {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export default function AdminMetricsPage() {
  const router = useRouter();
  const { role, user, loading: authLoading } = useAuth();
  const isSuperAdmin = role === "super_admin";
  const {
    stations, metrics, athletes, categories, units, loading,
    saveStation, deleteStation: removeStation,
    saveMetric, deleteMetric: removeMetric,
    saveAthlete, deleteAthlete: removeAthlete,
    addCategory, renameCategory, deleteCategory,
    addUnit, renameUnit, deleteUnit,
  } = useStore();

  useEffect(() => {
    if (!authLoading && role !== "super_admin" && role !== "admin") {
      router.push("/");
    }
  }, [authLoading, role, router]);

  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Metric form
  const [form, setForm] = useState<Metric>({ id: "", name: "", acronym: "", category: "", instructions: "", measurementRules: "", gear: "", drills: "", lowerIsBetter: false, minValue: null, maxValue: null, unit: "", inputs: null, formula: "" });
  const updateForm = (field: keyof Metric, value: string | boolean | number | null | MetricInput[]) => setForm((prev) => ({ ...prev, [field]: value }));

  // Station form
  const [stationForm, setStationForm] = useState<Station>({ id: "", name: "", icon: "zap", description: "", location: "", metricIds: [] });
  const updateStation = (field: keyof Station, value: string | string[]) => setStationForm((prev) => ({ ...prev, [field]: value }));

  // Category editing
  const [newCategory, setNewCategory] = useState("");
  const [renamingIdx, setRenamingIdx] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Unit editing
  const [newUnit, setNewUnit] = useState("");
  const [renamingUnitIdx, setRenamingUnitIdx] = useState<number | null>(null);
  const [renameUnitValue, setRenameUnitValue] = useState("");

  // --- Metric handlers ---
  const handleEditMetric = (metric: Metric) => { setEditingId(metric.id); setForm({ ...metric }); setView("editMetric"); };
  const handleNewMetric = () => { setForm({ id: `metric-${Date.now()}`, name: "", acronym: "", category: "", instructions: "", measurementRules: "", gear: "", drills: "", lowerIsBetter: false, minValue: null, maxValue: null, unit: "", inputs: null, formula: "" }); setEditingId(null); setView("editMetric"); };
  const handleSaveMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || saving) return;
    setSaving(true);
    await saveMetric(form);
    setSaving(false);
    setView("metrics");
  };
  const handleDeleteMetric = async (id: string) => {
    setDeletingId(id);
    await removeMetric(id);
    setDeletingId(null);
  };

  // --- Station handlers ---
  const handleEditStation = (station: Station) => { setStationForm({ ...station }); setView("editStation"); };
  const handleNewStation = () => { setStationForm({ id: `station-${Date.now()}`, name: "", icon: "zap", description: "", location: "", metricIds: [] }); setView("editStation"); };
  const handleSaveStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationForm.name || saving) return;
    setSaving(true);
    await saveStation(stationForm);
    setSaving(false);
    setView("stations");
  };
  const handleDeleteStation = async (id: string) => {
    setDeletingId(id);
    await removeStation(id);
    setDeletingId(null);
  };

  // --- Athlete form + handlers ---
  const [athleteForm, setAthleteForm] = useState<Athlete>({ id: "", firstName: "", lastName: "", grade: 9, gender: "M" });
  const updateAthleteForm = (field: keyof Athlete, value: string | number) => setAthleteForm((prev) => ({ ...prev, [field]: value }));

  const handleNewAthlete = () => { setAthleteForm({ id: `athlete-${Date.now()}`, firstName: "", lastName: "", grade: 9, gender: "M" }); setView("editAthlete"); };
  const handleEditAthlete = (athlete: Athlete) => { setAthleteForm({ ...athlete }); setView("editAthlete"); };
  const handleSaveAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!athleteForm.firstName || !athleteForm.lastName || saving) return;
    setSaving(true);
    await saveAthlete(athleteForm);
    setSaving(false);
    setView("athletes");
  };
  const handleDeleteAthlete = async (id: string) => {
    setDeletingId(id);
    await removeAthlete(id);
    setDeletingId(null);
  };

  // --- Category handlers ---
  const handleAddCategory = async () => {
    const t = newCategory.trim();
    if (t && !categories.some((c) => c.toLowerCase() === t.toLowerCase())) {
      await addCategory(t);
      setNewCategory("");
    }
  };
  const handleDeleteCategory = async (idx: number) => {
    await deleteCategory(categories[idx]);
  };
  const handleStartRename = (idx: number) => { setRenamingIdx(idx); setRenameValue(categories[idx]); };
  const handleConfirmRename = async () => {
    if (renamingIdx === null) return;
    const t = renameValue.trim();
    if (t) {
      await renameCategory(categories[renamingIdx], t);
    }
    setRenamingIdx(null); setRenameValue("");
  };

  // --- Unit handlers ---
  const handleAddUnit = async () => {
    const t = newUnit.trim();
    if (t && !units.some((u) => u.toLowerCase() === t.toLowerCase())) {
      await addUnit(t);
      setNewUnit("");
    }
  };
  const handleDeleteUnit = async (idx: number) => {
    await deleteUnit(units[idx]);
  };
  const handleStartRenameUnit = (idx: number) => { setRenamingUnitIdx(idx); setRenameUnitValue(units[idx]); };
  const handleConfirmRenameUnit = async () => {
    if (renamingUnitIdx === null) return;
    const t = renameUnitValue.trim();
    if (t) {
      await renameUnit(units[renamingUnitIdx], t);
    }
    setRenamingUnitIdx(null); setRenameUnitValue("");
  };

  // --- Team state ---
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("athlete");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const loadTeamData = async () => {
    setTeamLoading(true);
    const supabase = createClient();
    const [invitesRes, membersRes] = await Promise.all([
      supabase.from("invites").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").order("full_name"),
    ]);
    setPendingInvites(invitesRes.data ?? []);
    setMembers(membersRes.data ?? []);
    setTeamLoading(false);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || inviteSending) return;
    setInviteSending(true);
    setInviteMsg("");
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });
    const data = await res.json();
    if (data.error) {
      setInviteMsg(data.error);
      setInviteLink("");
    } else {
      const loginUrl = window.location.origin + "/login";
      setInviteLink(loginUrl);
      setInviteMsg("Invite created! Link copied to clipboard.");
      setInviteEmail("");
      try { await navigator.clipboard.writeText(loginUrl); } catch {}
      await loadTeamData();
    }
    setInviteSending(false);
  };

  const handleDeleteInvite = async (id: string) => {
    const supabase = createClient();
    await supabase.from("invites").delete().eq("id", id);
    setPendingInvites((prev) => prev.filter((i) => i.id !== id));
  };

  const handleChangeRole = async (profileId: string, newRole: UserRole) => {
    const supabase = createClient();
    await supabase.from("profiles").update({ role: newRole }).eq("id", profileId);
    setMembers((prev) => prev.map((m) => m.id === profileId ? { ...m, role: newRole } : m));
  };

  const handleRemoveMember = async (profileId: string) => {
    if (profileId === user?.id) return;
    if (!confirm("Remove this member? Their profile will be deleted and they will lose access.")) return;
    setRemovingMemberId(profileId);
    const supabase = createClient();
    await supabase.from("profiles").delete().eq("id", profileId);
    setMembers((prev) => prev.filter((m) => m.id !== profileId));
    setRemovingMemberId(null);
  };

  const inputCls = "h-10 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--input)] px-4 font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)]";
  const textareaCls = "rounded-[var(--radius-m)] bg-[var(--background)] border border-[var(--input)] p-4 font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)] resize-none";

  if (authLoading || (role !== "super_admin" && role !== "admin")) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--background)]">
        <span className="font-secondary text-sm text-[var(--muted-foreground)]">Loading...</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex-1 overflow-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)] bg-[var(--card)]">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="w-5 h-5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ===================== EDIT ATHLETE VIEW =====================
  if (view === "editAthlete") {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
          <button onClick={() => setView("athletes")} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
          <h1 className="font-headline text-lg text-[var(--foreground)]">
            {athletes.find((a) => a.id === athleteForm.id) ? "Edit Athlete" : "New Athlete"}
          </h1>
        </div>
        <form onSubmit={handleSaveAthlete} className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">First Name</label>
            <input value={athleteForm.firstName} onChange={(e) => updateAthleteForm("firstName", e.target.value)} placeholder="e.g. John" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Last Name</label>
            <input value={athleteForm.lastName} onChange={(e) => updateAthleteForm("lastName", e.target.value)} placeholder="e.g. Smith" className={inputCls} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Grade</label>
              <select value={athleteForm.grade} onChange={(e) => updateAthleteForm("grade", Number(e.target.value))} className={inputCls + " appearance-none cursor-pointer"}>
                <option value={9}>9</option>
                <option value={10}>10</option>
                <option value={11}>11</option>
                <option value={12}>12</option>
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Gender</label>
              <select value={athleteForm.gender} onChange={(e) => updateAthleteForm("gender", e.target.value)} className={inputCls + " appearance-none cursor-pointer"}>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2 pb-6">
            <button type="button" onClick={() => setView("athletes")} className="flex-1 h-12 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--border)] font-secondary text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 h-12 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50">
              {saving ? "Saving..." : "Save Athlete"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ===================== ATHLETES LIST VIEW =====================
  if (view === "athletes") {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
            <h1 className="font-headline text-lg text-[var(--foreground)]">Athletes</h1>
          </div>
          <button onClick={handleNewAthlete} className="flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
            <Plus size={18} /> Add
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {athletes.map((athlete) => (
            <div key={athlete.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)] bg-[var(--card)]">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleEditAthlete(athlete)}>
                <div className="font-headline text-sm text-[var(--foreground)]">{athlete.firstName} {athlete.lastName}</div>
                <div className="font-secondary text-xs text-[var(--muted-foreground)]">
                  Grade {athlete.grade} · {athlete.gender === "M" ? "Male" : "Female"}
                </div>
              </div>
              <button onClick={() => handleEditAthlete(athlete)} className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors">
                <Pencil size={16} className="text-[var(--muted-foreground)]" />
              </button>
              <button onClick={() => handleDeleteAthlete(athlete.id)} disabled={deletingId === athlete.id} className="p-2 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Trash2 size={16} className={deletingId === athlete.id ? "animate-pulse text-[var(--muted-foreground)]" : "text-[var(--destructive)]"} />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ===================== EDIT STATION VIEW =====================
  if (view === "editStation") {
    const assignedStationMetrics = stationForm.metricIds.map(id => metrics.find(m => m.id === id)).filter(Boolean) as typeof metrics;
    const availableMetrics = metrics.filter(m => !stationForm.metricIds.includes(m.id));
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
          <button onClick={() => setView("stations")} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
          <h1 className="font-headline text-lg text-[var(--foreground)]">
            {isSuperAdmin ? (stations.find((s) => s.id === stationForm.id) ? "Edit Station" : "New Station") : "Station Details"}
          </h1>
        </div>
        <form onSubmit={handleSaveStation} className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Station Name</label>
            <input value={stationForm.name} onChange={(e) => updateStation("name", e.target.value)} placeholder="e.g. Station 1" disabled={!isSuperAdmin} className={inputCls + (!isSuperAdmin ? " opacity-60" : "")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Description</label>
            <input value={stationForm.description} onChange={(e) => updateStation("description", e.target.value)} placeholder="e.g. Reactive Strength Index" disabled={!isSuperAdmin} className={inputCls + (!isSuperAdmin ? " opacity-60" : "")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Location</label>
            <input value={stationForm.location} onChange={(e) => updateStation("location", e.target.value)} placeholder="e.g. Near the long jump pit" disabled={!isSuperAdmin} className={inputCls + (!isSuperAdmin ? " opacity-60" : "")} />
          </div>

          {/* Metric assignment — multi-select */}
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">
              Metrics to Measure {assignedStationMetrics.length > 0 && <span className="text-[var(--muted-foreground)] font-normal">({assignedStationMetrics.length})</span>}
            </label>
            {/* Assigned metrics list */}
            {assignedStationMetrics.length > 0 && (
              <div className="flex flex-col gap-1">
                {assignedStationMetrics.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 p-2.5 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-m)]">
                    <div className="flex-1 min-w-0">
                      <span className="font-secondary text-sm font-medium text-[var(--foreground)]">{m.name}</span>
                      <span className="font-mono text-xs text-[var(--muted-foreground)] ml-1.5">{m.acronym}</span>
                    </div>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => updateStation("metricIds", stationForm.metricIds.filter(id => id !== m.id))}
                        className="p-1.5 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors shrink-0"
                      >
                        <X size={14} className="text-[var(--destructive)]" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Add metric dropdown */}
            {isSuperAdmin && availableMetrics.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    updateStation("metricIds", [...stationForm.metricIds, e.target.value]);
                  }
                }}
                className={inputCls + " appearance-none cursor-pointer"}
              >
                <option value="">+ Add a metric...</option>
                {availableMetrics.map((m) => (<option key={m.id} value={m.id}>{m.name} ({m.acronym})</option>))}
              </select>
            )}
          </div>

          {isSuperAdmin && (
            <div className="flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Icon</label>
              <div className="grid grid-cols-6 gap-2">
                {AVAILABLE_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => updateStation("icon", icon)}
                    className={`flex items-center justify-center w-full aspect-square rounded-full border transition-colors cursor-pointer ${
                      stationForm.icon === icon
                        ? "border-[var(--primary)] bg-[var(--primary)]"
                        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]"
                    }`}
                  >
                    <DynamicIcon
                      name={icon}
                      size={20}
                      className={stationForm.icon === icon ? "text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)]"}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2 pb-6">
            <button type="button" onClick={() => setView("stations")} className="flex-1 h-12 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--border)] font-secondary text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer">{isSuperAdmin ? "Cancel" : "Back"}</button>
            {isSuperAdmin && (
              <button type="submit" disabled={saving} className="flex-1 h-12 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50">
                {saving ? "Saving..." : "Save Station"}
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // ===================== STATIONS LIST VIEW =====================
  if (view === "stations") {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
            <h1 className="font-headline text-lg text-[var(--foreground)]">Stations</h1>
          </div>
          {isSuperAdmin && (
            <button onClick={handleNewStation} className="flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
              <Plus size={18} /> Add
            </button>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          {stations.map((station) => {
            const stationMetrics = station.metricIds.map(id => metrics.find(m => m.id === id)).filter(Boolean) as typeof metrics;
            const metricLabel = stationMetrics.length === 0
              ? "No metrics assigned"
              : stationMetrics.length === 1
              ? stationMetrics[0].name
              : `${stationMetrics[0].name} (+${stationMetrics.length - 1} more)`;
            return (
              <div key={station.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)] bg-[var(--card)]">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0">
                  <DynamicIcon name={station.icon} size={18} className="text-[var(--primary-foreground)]" />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleEditStation(station)}>
                  <div className="font-headline text-sm text-[var(--foreground)]">{station.name}</div>
                  <div className="font-secondary text-xs text-[var(--muted-foreground)]">
                    {metricLabel}
                    {station.location ? ` · ${station.location}` : ""}
                  </div>
                </div>
                {isSuperAdmin && (
                  <>
                    <button onClick={() => handleEditStation(station)} className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors">
                      <Pencil size={16} className="text-[var(--muted-foreground)]" />
                    </button>
                    <button onClick={() => handleDeleteStation(station.id)} disabled={deletingId === station.id} className="p-2 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      <Trash2 size={16} className={deletingId === station.id ? "animate-pulse text-[var(--muted-foreground)]" : "text-[var(--destructive)]"} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===================== CATEGORIES VIEW =====================
  if (view === "categories") {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
          <button onClick={() => { setView("editMetric"); setRenamingIdx(null); }} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
          <h1 className="font-headline text-lg text-[var(--foreground)]">Edit Categories</h1>
        </div>
        <div className="flex-1 overflow-auto">
          {categories.map((cat, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
              {renamingIdx === idx ? (
                <>
                  <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleConfirmRename()} autoFocus className={"flex-1 " + inputCls} />
                  <button onClick={handleConfirmRename} className="p-2 cursor-pointer hover:bg-[var(--color-success)] rounded-[var(--radius-pill)] transition-colors"><Check size={16} className="text-[var(--color-success-foreground)]" /></button>
                  <button onClick={() => { setRenamingIdx(null); setRenameValue(""); }} className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors"><X size={16} className="text-[var(--muted-foreground)]" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-secondary text-sm font-medium text-[var(--foreground)]">{cat}</span>
                  {isSuperAdmin && (
                    <>
                      <button onClick={() => handleStartRename(idx)} className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors"><Pencil size={16} className="text-[var(--muted-foreground)]" /></button>
                      <button onClick={() => handleDeleteCategory(idx)} className="p-2 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors"><Trash2 size={16} className="text-[var(--destructive)]" /></button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-3 p-4 border-t border-[var(--border)]">
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddCategory()} placeholder="New category name..." className={"flex-1 " + inputCls} />
            <button onClick={handleAddCategory} className="flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"><Plus size={18} /> Add</button>
          </div>
        )}
      </div>
    );
  }

  // ===================== UNITS VIEW =====================
  if (view === "units") {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
          <button onClick={() => { setView("editMetric"); setRenamingUnitIdx(null); }} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
          <h1 className="font-headline text-lg text-[var(--foreground)]">Edit Units</h1>
        </div>
        <div className="flex-1 overflow-auto">
          {units.map((u, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
              {renamingUnitIdx === idx ? (
                <>
                  <input value={renameUnitValue} onChange={(e) => setRenameUnitValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleConfirmRenameUnit()} autoFocus className={"flex-1 " + inputCls} />
                  <button onClick={handleConfirmRenameUnit} className="p-2 cursor-pointer hover:bg-[var(--color-success)] rounded-[var(--radius-pill)] transition-colors"><Check size={16} className="text-[var(--color-success-foreground)]" /></button>
                  <button onClick={() => { setRenamingUnitIdx(null); setRenameUnitValue(""); }} className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors"><X size={16} className="text-[var(--muted-foreground)]" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-secondary text-sm font-medium text-[var(--foreground)]">{u}</span>
                  {isSuperAdmin && (
                    <>
                      <button onClick={() => handleStartRenameUnit(idx)} className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors"><Pencil size={16} className="text-[var(--muted-foreground)]" /></button>
                      <button onClick={() => handleDeleteUnit(idx)} className="p-2 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors"><Trash2 size={16} className="text-[var(--destructive)]" /></button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-3 p-4 border-t border-[var(--border)]">
            <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddUnit()} placeholder="New unit name..." className={"flex-1 " + inputCls} />
            <button onClick={handleAddUnit} className="flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"><Plus size={18} /> Add</button>
          </div>
        )}
      </div>
    );
  }

  // ===================== EDIT METRIC VIEW =====================
  if (view === "editMetric") {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
          <button onClick={() => setView("metrics")} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
          <h1 className="font-headline text-lg text-[var(--foreground)]">
            {isSuperAdmin ? (editingId ? "Edit Metric" : "New Metric") : "Metric Details"}
          </h1>
        </div>
        <form onSubmit={handleSaveMetric} className="flex-1 overflow-auto overflow-x-hidden p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Metric Name</label>
            <input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="e.g. Reactive Strength Index" disabled={!isSuperAdmin} className={inputCls + (!isSuperAdmin ? " opacity-60" : "")} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Acronym</label>
              <input value={form.acronym} onChange={(e) => updateForm("acronym", e.target.value)} placeholder="e.g. RSI" disabled={!isSuperAdmin} className={inputCls + (!isSuperAdmin ? " opacity-60" : "")} />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Category</label>
                {isSuperAdmin && <button type="button" onClick={() => setView("categories")} className="font-secondary text-xs text-[var(--primary)] hover:underline cursor-pointer">Edit list</button>}
              </div>
              <select value={form.category} onChange={(e) => updateForm("category", e.target.value)} disabled={!isSuperAdmin} className={inputCls + " appearance-none cursor-pointer" + (!isSuperAdmin ? " opacity-60" : "")}>
                <option value="">Select...</option>
                {categories.map((cat) => (<option key={cat} value={cat.toLowerCase()}>{cat}</option>))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Instructions</label>
            <textarea value={form.instructions} onChange={(e) => updateForm("instructions", e.target.value)} placeholder="How to perform this measurement..." rows={3} disabled={!isSuperAdmin} className={textareaCls + (!isSuperAdmin ? " opacity-60" : "")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Measurement Rules</label>
            <textarea value={form.measurementRules} onChange={(e) => updateForm("measurementRules", e.target.value)} placeholder="Rules and standards..." rows={3} disabled={!isSuperAdmin} className={textareaCls + (!isSuperAdmin ? " opacity-60" : "")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Gear Required</label>
            <input value={form.gear} onChange={(e) => updateForm("gear", e.target.value)} placeholder="e.g. Contact mat, Vertec" disabled={!isSuperAdmin} className={inputCls + (!isSuperAdmin ? " opacity-60" : "")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Drill Suggestions</label>
            <input value={form.drills} onChange={(e) => updateForm("drills", e.target.value)} placeholder="e.g. Depth jumps, Pogo hops" disabled={!isSuperAdmin} className={inputCls + (!isSuperAdmin ? " opacity-60" : "")} />
          </div>

          {/* Multi-Input Configuration */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Value Inputs</label>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const current = form.inputs || [];
                    updateForm("inputs", [...current, { label: "" }]);
                  }}
                  className="font-secondary text-xs text-[var(--primary)] hover:underline cursor-pointer"
                >+ Add input</button>
              )}
            </div>
            {!form.inputs || form.inputs.length === 0 ? (
              <p className="font-secondary text-xs text-[var(--muted-foreground)]">Single value input (default). Add inputs for multi-value metrics.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {form.inputs.map((inp, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[var(--primary)] w-6 text-center shrink-0">{indexToVar(i)}</span>
                    <input
                      value={inp.label}
                      onChange={(e) => {
                        const next = [...form.inputs!];
                        next[i] = { ...next[i], label: e.target.value };
                        updateForm("inputs", next);
                      }}
                      placeholder={`Label for input ${indexToVar(i)}`}
                      disabled={!isSuperAdmin}
                      className={inputCls + " flex-1 min-w-0" + (!isSuperAdmin ? " opacity-60" : "")}
                    />
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = form.inputs!.filter((_, j) => j !== i);
                          updateForm("inputs", next.length === 0 ? null : next);
                        }}
                        className="p-2 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors shrink-0"
                      >
                        <Trash2 size={14} className="text-[var(--destructive)]" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formula (only when 2+ inputs) */}
          {form.inputs && form.inputs.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Formula</label>
              <input
                value={form.formula}
                onChange={(e) => updateForm("formula", e.target.value)}
                placeholder={`e.g. ${form.inputs.map((_, i) => indexToVar(i)).join(" + ")}`}
                disabled={!isSuperAdmin}
                className={inputCls + (!isSuperAdmin ? " opacity-60" : "")}
              />
              <p className="font-secondary text-xs text-[var(--muted-foreground)]">
                Variables: {form.inputs.map((inp, i) => `${indexToVar(i)} = ${inp.label || `Input ${i + 1}`}`).join(", ")}.
                Leave empty to use sum of all inputs.
              </p>
            </div>
          )}

          {/* Direction toggle */}
          <div className="flex items-center justify-between p-3 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-m)]">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Lower is better</label>
            <button
              type="button"
              onClick={() => isSuperAdmin && updateForm("lowerIsBetter", !form.lowerIsBetter)}
              disabled={!isSuperAdmin}
              className={`w-12 h-7 rounded-full transition-colors ${isSuperAdmin ? "cursor-pointer" : "opacity-60"} ${form.lowerIsBetter ? "bg-[var(--primary)]" : "bg-[var(--input)]"}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-1 ${form.lowerIsBetter ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Min / Max values */}
          <div className="flex gap-3">
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Min Value</label>
              <input type="number" value={form.minValue ?? ""} onChange={(e) => updateForm("minValue", e.target.value === "" ? null : Number(e.target.value))} placeholder="Optional" disabled={!isSuperAdmin} className={inputCls + " w-full" + (!isSuperAdmin ? " opacity-60" : "")} />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Max Value</label>
              <input type="number" value={form.maxValue ?? ""} onChange={(e) => updateForm("maxValue", e.target.value === "" ? null : Number(e.target.value))} placeholder="Optional" disabled={!isSuperAdmin} className={inputCls + " w-full" + (!isSuperAdmin ? " opacity-60" : "")} />
            </div>
          </div>

          {/* Unit selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Unit</label>
              {isSuperAdmin && <button type="button" onClick={() => setView("units")} className="font-secondary text-xs text-[var(--primary)] hover:underline cursor-pointer">Edit list</button>}
            </div>
            <select value={form.unit} onChange={(e) => updateForm("unit", e.target.value)} disabled={!isSuperAdmin} className={inputCls + " appearance-none cursor-pointer" + (!isSuperAdmin ? " opacity-60" : "")}>
              <option value="">None</option>
              {units.map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
          </div>

          <div className="flex gap-3 pt-2 pb-6">
            <button type="button" onClick={() => setView("metrics")} className="flex-1 h-12 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--border)] font-secondary text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer">{isSuperAdmin ? "Cancel" : "Back"}</button>
            {isSuperAdmin && (
              <button type="submit" disabled={saving} className="flex-1 h-12 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50">
                {saving ? "Saving..." : "Save Metric"}
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  // ===================== TEAM VIEW =====================
  if (view === "team") {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
            <h1 className="font-headline text-lg text-[var(--foreground)]">Team</h1>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 flex flex-col gap-6">
          {/* Invite form — super_admin only */}
          {isSuperAdmin && (
            <div className="flex flex-col gap-2">
              <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Invite New Member
              </h2>
              <div className="flex gap-2">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
                  placeholder="email@example.com"
                  type="email"
                  className={inputCls + " flex-1 min-w-0"}
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className={inputCls + " appearance-none cursor-pointer shrink-0 w-auto"}
                >
                  <option value="athlete">Athlete</option>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <button
                onClick={handleSendInvite}
                disabled={inviteSending}
                className="flex items-center justify-center gap-1.5 h-10 w-full rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                <Plus size={14} />
                {inviteSending ? "Creating..." : "Create Invite"}
              </button>
              {inviteMsg && (
                <p className="font-secondary text-xs text-[var(--muted-foreground)]">{inviteMsg}</p>
              )}
              {inviteLink && (
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={inviteLink}
                    className={inputCls + " flex-1 min-w-0 text-[var(--muted-foreground)]"}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteLink);
                        setInviteMsg("Copied!");
                      } catch {}
                    }}
                    className="shrink-0 w-10 h-10 flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--secondary)] hover:bg-[var(--border)] transition-colors cursor-pointer"
                    title="Copy link"
                  >
                    <Copy size={16} className="text-[var(--foreground)]" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pending invites — super_admin only */}
          {isSuperAdmin && pendingInvites.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                Pending Invites ({pendingInvites.length})
              </h2>
              <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-m)]">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-secondary text-sm text-[var(--foreground)] truncate">{invite.email}</div>
                      <div className="font-secondary text-xs text-[var(--muted-foreground)]">
                        {invite.role === "super_admin" ? "Super Admin" : invite.role === "admin" ? "Admin" : "Athlete"}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteInvite(invite.id)}
                      className="p-2 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors"
                    >
                      <Trash2 size={14} className="text-[var(--destructive)]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current members */}
          <div className="flex flex-col gap-2">
            <h2 className="font-primary text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
              Current Members ({members.length})
            </h2>
            {teamLoading ? (
              <p className="font-secondary text-sm text-[var(--muted-foreground)]">Loading...</p>
            ) : (
              <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-m)]">
                {members.map((member) => {
                  const isCurrentUser = member.id === user?.id;
                  return (
                    <div key={member.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <div className="font-secondary text-sm font-medium text-[var(--foreground)] truncate">
                          {member.full_name || member.email}{isCurrentUser ? " (you)" : ""}
                        </div>
                        <div className="font-secondary text-xs text-[var(--muted-foreground)] truncate">{member.email}</div>
                      </div>
                      {isSuperAdmin ? (
                          <select
                            value={member.role}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "__remove__") {
                                e.target.value = member.role;
                                handleRemoveMember(member.id);
                              } else {
                                handleChangeRole(member.id, val as UserRole);
                              }
                            }}
                            disabled={removingMemberId === member.id}
                            className={"h-8 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--input)] px-3 font-secondary text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)] appearance-none cursor-pointer" + (removingMemberId === member.id ? " opacity-40" : "")}
                          >
                            <option value="athlete">Athlete</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                            <option value="__remove__">Remove Member</option>
                          </select>
                      ) : (
                        <span className="font-secondary text-xs text-[var(--muted-foreground)]">
                          {member.role === "super_admin" ? "Super Admin" : member.role === "admin" ? "Admin" : "Athlete"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===================== METRICS LIST VIEW =====================
  if (view === "metrics") {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
            <h1 className="font-headline text-lg text-[var(--foreground)]">Metrics</h1>
          </div>
          {isSuperAdmin && (
            <button onClick={handleNewMetric} className="flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
              <Plus size={18} /> Add
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {metrics.map((metric) => {
            return (
              <div key={metric.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)] bg-[var(--card)]">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleEditMetric(metric)}>
                  <div className="flex items-center gap-2">
                    <span className="font-primary text-sm font-semibold text-[var(--foreground)]">{metric.name}</span>
                    <span className="font-mono text-xs text-[var(--muted-foreground)]">{metric.acronym}</span>
                  </div>
                  <div className="font-secondary text-xs text-[var(--muted-foreground)] mt-0.5">
                    {categories.find((c) => c.toLowerCase() === metric.category) || metric.category}
                    {metric.gear ? ` · ${metric.gear}` : ""}
                  </div>
                </div>
                {isSuperAdmin && (
                  <>
                    <button onClick={() => handleEditMetric(metric)} className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors">
                      <Pencil size={16} className="text-[var(--muted-foreground)]" />
                    </button>
                    <button onClick={() => handleDeleteMetric(metric.id)} disabled={deletingId === metric.id} className="p-2 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                      <Trash2 size={16} className={deletingId === metric.id ? "animate-pulse text-[var(--muted-foreground)]" : "text-[var(--destructive)]"} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===================== SETTINGS LANDING =====================
  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
        <button onClick={() => router.push("/")} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
        <h1 className="font-headline text-lg text-[var(--foreground)]">Settings</h1>
      </div>

      <div className="flex-1 overflow-auto">
        <button onClick={() => setView("stations")} className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)] bg-[var(--card)] w-full text-left cursor-pointer hover:bg-[var(--secondary)] transition-colors">
          <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0">
            <LayoutGrid size={18} className="text-[var(--primary-foreground)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-headline text-sm text-[var(--foreground)]">Stations</div>
            <div className="font-secondary text-xs text-[var(--muted-foreground)]">{stations.length} station{stations.length !== 1 ? "s" : ""}{!isSuperAdmin ? " · View only" : ""}</div>
          </div>
          <ChevronRight size={18} className="text-[var(--muted-foreground)]" />
        </button>

        <button onClick={() => setView("metrics")} className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)] bg-[var(--card)] w-full text-left cursor-pointer hover:bg-[var(--secondary)] transition-colors">
          <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0">
            <Ruler size={18} className="text-[var(--primary-foreground)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-headline text-sm text-[var(--foreground)]">Metrics</div>
            <div className="font-secondary text-xs text-[var(--muted-foreground)]">{metrics.length} metric{metrics.length !== 1 ? "s" : ""}{!isSuperAdmin ? " · View only" : ""}</div>
          </div>
          <ChevronRight size={18} className="text-[var(--muted-foreground)]" />
        </button>

        <button onClick={() => setView("athletes")} className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)] bg-[var(--card)] w-full text-left cursor-pointer hover:bg-[var(--secondary)] transition-colors">
          <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0">
            <UserRound size={18} className="text-[var(--primary-foreground)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-headline text-sm text-[var(--foreground)]">Athletes</div>
            <div className="font-secondary text-xs text-[var(--muted-foreground)]">{athletes.length} athlete{athletes.length !== 1 ? "s" : ""}</div>
          </div>
          <ChevronRight size={18} className="text-[var(--muted-foreground)]" />
        </button>

        <button onClick={() => { setView("team"); loadTeamData(); }} className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)] bg-[var(--card)] w-full text-left cursor-pointer hover:bg-[var(--secondary)] transition-colors">
          <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0">
            <Users size={18} className="text-[var(--primary-foreground)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-headline text-sm text-[var(--foreground)]">Team</div>
            <div className="font-secondary text-xs text-[var(--muted-foreground)]">{isSuperAdmin ? "Invite & manage members" : "View members · View only"}</div>
          </div>
          <ChevronRight size={18} className="text-[var(--muted-foreground)]" />
        </button>
      </div>
    </div>
  );
}
