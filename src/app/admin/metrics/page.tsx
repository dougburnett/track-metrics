"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, X, Check, LayoutGrid } from "lucide-react";
import { useStore, AVAILABLE_ICONS, type Metric, type MetricInput, type Station } from "@/lib/store";
import { indexToVar } from "@/lib/formula";
import { useAuth } from "@/lib/auth-context";
import { DynamicIcon } from "@/components/DynamicIcon";

type View = "list" | "editMetric" | "categories" | "units" | "stations" | "editStation";

export default function AdminMetricsPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const {
    stations, metrics, categories, units, loading,
    saveStation, deleteStation: removeStation,
    saveMetric, deleteMetric: removeMetric,
    addCategory, renameCategory, deleteCategory,
    addUnit, renameUnit, deleteUnit,
  } = useStore();

  useEffect(() => {
    if (!authLoading && role !== "super_admin") {
      router.push("/");
    }
  }, [authLoading, role, router]);

  const [view, setView] = useState<View>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Metric form
  const [form, setForm] = useState<Metric>({ id: "", name: "", acronym: "", category: "", instructions: "", measurementRules: "", gear: "", drills: "", lowerIsBetter: false, minValue: null, maxValue: null, unit: "", inputs: null, formula: "" });
  const updateForm = (field: keyof Metric, value: string | boolean | number | null | MetricInput[]) => setForm((prev) => ({ ...prev, [field]: value }));

  // Station form (now has location + metricId)
  const [stationForm, setStationForm] = useState<Station>({ id: "", name: "", icon: "zap", description: "", location: "", metricId: "" });
  const updateStation = (field: keyof Station, value: string) => setStationForm((prev) => ({ ...prev, [field]: value }));

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
    setView("list");
  };
  const handleDeleteMetric = async (id: string) => {
    await removeMetric(id);
  };

  // --- Station handlers ---
  const handleEditStation = (station: Station) => { setStationForm({ ...station }); setView("editStation"); };
  const handleNewStation = () => { setStationForm({ id: `station-${Date.now()}`, name: "", icon: "zap", description: "", location: "", metricId: "" }); setView("editStation"); };
  const handleSaveStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationForm.name || saving) return;
    setSaving(true);
    await saveStation(stationForm);
    setSaving(false);
    setView("stations");
  };
  const handleDeleteStation = async (id: string) => {
    await removeStation(id);
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

  const inputCls = "h-10 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--input)] px-4 font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)]";
  const textareaCls = "rounded-[var(--radius-m)] bg-[var(--background)] border border-[var(--input)] p-4 font-secondary text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--primary)] resize-none";

  if (loading || authLoading || role !== "super_admin") {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--background)]">
        <span className="font-secondary text-sm text-[var(--muted-foreground)]">Loading...</span>
      </div>
    );
  }

  // ===================== EDIT STATION VIEW =====================
  if (view === "editStation") {
    const assignedMetric = metrics.find(m => m.id === stationForm.metricId);
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
          <button onClick={() => setView("stations")} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
          <h1 className="font-headline text-lg text-[var(--foreground)]">
            {stations.find((s) => s.id === stationForm.id) ? "Edit Station" : "New Station"}
          </h1>
        </div>
        <form onSubmit={handleSaveStation} className="flex-1 overflow-auto p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Station Name</label>
            <input value={stationForm.name} onChange={(e) => updateStation("name", e.target.value)} placeholder="e.g. Station 1" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Description</label>
            <input value={stationForm.description} onChange={(e) => updateStation("description", e.target.value)} placeholder="e.g. Reactive Strength Index" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Location</label>
            <input value={stationForm.location} onChange={(e) => updateStation("location", e.target.value)} placeholder="e.g. Near the long jump pit" className={inputCls} />
          </div>

          {/* Metric assignment */}
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Metric to Measure</label>
            <select value={stationForm.metricId} onChange={(e) => updateStation("metricId", e.target.value)} className={inputCls + " appearance-none cursor-pointer"}>
              <option value="">None</option>
              {metrics.map((m) => (<option key={m.id} value={m.id}>{m.name} ({m.acronym})</option>))}
            </select>
            {assignedMetric && (
              <div className="mt-1 p-3 bg-[var(--card)] border border-[var(--border)] rounded-[var(--radius-m)]">
                <div className="font-secondary text-xs text-[var(--muted-foreground)]">{assignedMetric.instructions}</div>
                {assignedMetric.gear && <div className="font-secondary text-xs text-[var(--muted-foreground)] mt-1">Gear: {assignedMetric.gear}</div>}
              </div>
            )}
          </div>

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
          <div className="flex gap-3 pt-2 pb-6">
            <button type="button" onClick={() => setView("stations")} className="flex-1 h-12 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--border)] font-secondary text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 h-12 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50">
              {saving ? "Saving..." : "Save Station"}
            </button>
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
            <h1 className="font-headline text-lg text-[var(--foreground)]">Edit Stations</h1>
          </div>
          <button onClick={handleNewStation} className="flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
            <Plus size={18} /> Add
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {stations.map((station) => {
            const assignedMetric = metrics.find(m => m.id === station.metricId);
            return (
              <div key={station.id} className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)] bg-[var(--card)]">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center shrink-0">
                  <DynamicIcon name={station.icon} size={18} className="text-[var(--primary-foreground)]" />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleEditStation(station)}>
                  <div className="font-headline text-sm text-[var(--foreground)]">{station.name}</div>
                  <div className="font-secondary text-xs text-[var(--muted-foreground)]">
                    {assignedMetric ? assignedMetric.name : "No metric assigned"}
                    {station.location ? ` · ${station.location}` : ""}
                  </div>
                </div>
                <button onClick={() => handleEditStation(station)} className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors">
                  <Pencil size={16} className="text-[var(--muted-foreground)]" />
                </button>
                <button onClick={() => handleDeleteStation(station.id)} className="p-2 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors">
                  <Trash2 size={16} className="text-[var(--destructive)]" />
                </button>
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
                  <button onClick={() => handleStartRename(idx)} className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors"><Pencil size={16} className="text-[var(--muted-foreground)]" /></button>
                  <button onClick={() => handleDeleteCategory(idx)} className="p-2 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors"><Trash2 size={16} className="text-[var(--destructive)]" /></button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 p-4 border-t border-[var(--border)]">
          <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddCategory()} placeholder="New category name..." className={"flex-1 " + inputCls} />
          <button onClick={handleAddCategory} className="flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"><Plus size={18} /> Add</button>
        </div>
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
                  <button onClick={() => handleStartRenameUnit(idx)} className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors"><Pencil size={16} className="text-[var(--muted-foreground)]" /></button>
                  <button onClick={() => handleDeleteUnit(idx)} className="p-2 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors"><Trash2 size={16} className="text-[var(--destructive)]" /></button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 p-4 border-t border-[var(--border)]">
          <input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddUnit()} placeholder="New unit name..." className={"flex-1 " + inputCls} />
          <button onClick={handleAddUnit} className="flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"><Plus size={18} /> Add</button>
        </div>
      </div>
    );
  }

  // ===================== EDIT METRIC VIEW =====================
  if (view === "editMetric") {
    return (
      <div className="flex flex-col h-full bg-[var(--background)]">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border)]">
          <button onClick={() => setView("list")} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
          <h1 className="font-headline text-lg text-[var(--foreground)]">
            {editingId ? "Edit Metric" : "New Metric"}
          </h1>
        </div>
        <form onSubmit={handleSaveMetric} className="flex-1 overflow-auto overflow-x-hidden p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Metric Name</label>
            <input value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="e.g. Reactive Strength Index" className={inputCls} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Acronym</label>
              <input value={form.acronym} onChange={(e) => updateForm("acronym", e.target.value)} placeholder="e.g. RSI" className={inputCls} />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Category</label>
                <button type="button" onClick={() => setView("categories")} className="font-secondary text-xs text-[var(--primary)] hover:underline cursor-pointer">Edit list</button>
              </div>
              <select value={form.category} onChange={(e) => updateForm("category", e.target.value)} className={inputCls + " appearance-none cursor-pointer"}>
                <option value="">Select...</option>
                {categories.map((cat) => (<option key={cat} value={cat.toLowerCase()}>{cat}</option>))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Instructions</label>
            <textarea value={form.instructions} onChange={(e) => updateForm("instructions", e.target.value)} placeholder="How to perform this measurement..." rows={3} className={textareaCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Measurement Rules</label>
            <textarea value={form.measurementRules} onChange={(e) => updateForm("measurementRules", e.target.value)} placeholder="Rules and standards..." rows={3} className={textareaCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Gear Required</label>
            <input value={form.gear} onChange={(e) => updateForm("gear", e.target.value)} placeholder="e.g. Contact mat, Vertec" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Drill Suggestions</label>
            <input value={form.drills} onChange={(e) => updateForm("drills", e.target.value)} placeholder="e.g. Depth jumps, Pogo hops" className={inputCls} />
          </div>

          {/* Multi-Input Configuration */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Value Inputs</label>
              <button
                type="button"
                onClick={() => {
                  const current = form.inputs || [];
                  updateForm("inputs", [...current, { label: "" }]);
                }}
                className="font-secondary text-xs text-[var(--primary)] hover:underline cursor-pointer"
              >+ Add input</button>
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
                      className={inputCls + " flex-1 min-w-0"}
                    />
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
                className={inputCls}
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
              onClick={() => updateForm("lowerIsBetter", !form.lowerIsBetter)}
              className={`w-12 h-7 rounded-full transition-colors cursor-pointer ${form.lowerIsBetter ? "bg-[var(--primary)]" : "bg-[var(--input)]"}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform mx-1 ${form.lowerIsBetter ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Min / Max values */}
          <div className="flex gap-3">
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Min Value</label>
              <input type="number" value={form.minValue ?? ""} onChange={(e) => updateForm("minValue", e.target.value === "" ? null : Number(e.target.value))} placeholder="Optional" className={inputCls + " w-full"} />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Max Value</label>
              <input type="number" value={form.maxValue ?? ""} onChange={(e) => updateForm("maxValue", e.target.value === "" ? null : Number(e.target.value))} placeholder="Optional" className={inputCls + " w-full"} />
            </div>
          </div>

          {/* Unit selector */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="font-secondary text-sm font-medium text-[var(--foreground)]">Unit</label>
              <button type="button" onClick={() => setView("units")} className="font-secondary text-xs text-[var(--primary)] hover:underline cursor-pointer">Edit list</button>
            </div>
            <select value={form.unit} onChange={(e) => updateForm("unit", e.target.value)} className={inputCls + " appearance-none cursor-pointer"}>
              <option value="">None</option>
              {units.map((u) => (<option key={u} value={u}>{u}</option>))}
            </select>
          </div>

          <div className="flex gap-3 pt-2 pb-6">
            <button type="button" onClick={() => setView("list")} className="flex-1 h-12 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--border)] font-secondary text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 h-12 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-bold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50">
              {saving ? "Saving..." : "Save Metric"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ===================== METRIC LIST VIEW =====================
  return (
    <div className="flex flex-col h-full bg-[var(--background)]">
      <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="cursor-pointer"><ArrowLeft size={24} className="text-[var(--foreground)]" /></button>
          <h1 className="font-headline text-lg text-[var(--foreground)]">Metrics</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView("stations")} className="flex items-center gap-1.5 h-10 px-3 rounded-[var(--radius-pill)] bg-[var(--background)] border border-[var(--border)] font-secondary text-sm font-medium text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors cursor-pointer" title="Edit Stations">
            <LayoutGrid size={16} /> Stations
          </button>
          <button onClick={handleNewMetric} className="flex items-center gap-1.5 h-10 px-4 rounded-[var(--radius-pill)] bg-[var(--primary)] font-secondary text-sm font-semibold text-[var(--primary-foreground)] hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer">
            <Plus size={18} /> Add
          </button>
        </div>
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
              <button onClick={() => handleEditMetric(metric)} className="p-2 cursor-pointer hover:bg-[var(--secondary)] rounded-[var(--radius-pill)] transition-colors">
                <Pencil size={16} className="text-[var(--muted-foreground)]" />
              </button>
              <button onClick={() => handleDeleteMetric(metric.id)} className="p-2 cursor-pointer hover:bg-[var(--color-error)] rounded-[var(--radius-pill)] transition-colors">
                <Trash2 size={16} className="text-[var(--destructive)]" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
