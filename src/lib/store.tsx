"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { createClient } from "./supabase";
import { useAuth } from "./auth-context";

// --- Types ---

export interface Station {
  id: string;
  slug?: string;
  name: string;
  icon: string;
  description: string;
  location: string;
  metricId: string; // uuid of assigned metric
}

export interface MetricInput {
  label: string;
}

export interface Metric {
  id: string;
  name: string;
  acronym: string;
  category: string;
  instructions: string;
  measurementRules: string;
  gear: string;
  drills: string;
  lowerIsBetter: boolean;
  minValue: number | null;
  maxValue: number | null;
  unit: string;
  inputs: MetricInput[] | null;
  formula: string;
}

export interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  grade: number;
  gender: string;
}

// --- Icon list ---

export const AVAILABLE_ICONS = [
  "zap", "timer", "arrow-up-right", "ruler", "dumbbell", "scale",
  "target", "flame", "gauge", "activity", "heart-pulse", "footprints",
  "move", "trending-up", "trophy", "clipboard", "eye", "wind",
  "mountain", "bike", "swords", "shield", "star", "circle-dot",
];

// --- Context ---

interface StoreContextType {
  stations: Station[];
  setStations: React.Dispatch<React.SetStateAction<Station[]>>;
  metrics: Metric[];
  setMetrics: React.Dispatch<React.SetStateAction<Metric[]>>;
  athletes: Athlete[];
  units: string[];
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  loading: boolean;
  saveStation: (station: Station) => Promise<void>;
  deleteStation: (id: string) => Promise<void>;
  saveMetric: (metric: Metric) => Promise<void>;
  deleteMetric: (id: string) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  renameCategory: (oldName: string, newName: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
  addUnit: (name: string) => Promise<void>;
  renameUnit: (oldName: string, newName: string) => Promise<void>;
  deleteUnit: (name: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedForUser = useRef<string | null>(null);

  // Load from Supabase once auth is ready and user exists
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      loadedForUser.current = null;
      setStations([]);
      setMetrics([]);
      setAthletes([]);
      setCategories([]);
      setUnits([]);
      setLoading(false);
      return;
    }
    if (loadedForUser.current === user.id) return;
    loadedForUser.current = user.id;

    async function load() {
      const [catRes, staRes, metRes, athRes, unitRes] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("stations").select("*").order("sort_order"),
        supabase.from("metrics").select("*"),
        supabase.from("athletes").select("*").order("first_name"),
        supabase.from("units").select("*").order("name"),
      ]);

      if (catRes.error) console.error("categories error:", catRes.error);
      if (staRes.error) console.error("stations error:", staRes.error);
      if (metRes.error) console.error("metrics error:", metRes.error);
      if (athRes.error) console.error("athletes error:", athRes.error);
      if (unitRes.error) console.error("units error:", unitRes.error);

      const cats = catRes.data || [];
      const stas = staRes.data || [];
      const mets = metRes.data || [];
      const aths = athRes.data || [];
      const uns = unitRes.data || [];

      const catMap: Record<string, string> = {};
      cats.forEach((c: { id: string; name: string }) => { catMap[c.id] = c.name; });

      setCategories(cats.map((c: { name: string }) => c.name));
      setUnits(uns.map((u: { name: string }) => u.name));
      setStations(stas.map((s: { id: string; slug: string; name: string; icon: string; description: string; location: string; metric_id: string | null }) => ({
        id: s.slug,
        slug: s.slug,
        name: s.name,
        icon: s.icon,
        description: s.description,
        location: s.location || "",
        metricId: s.metric_id || "",
      })));
      setMetrics(mets.map((m: { id: string; name: string; acronym: string; category_id: string; instructions: string; measurement_rules: string; gear: string; drills: string; lower_is_better: boolean; min_value: number | null; max_value: number | null; unit: string; inputs: MetricInput[] | null; formula: string }) => ({
        id: m.id,
        name: m.name,
        acronym: m.acronym,
        category: (catMap[m.category_id] || "").toLowerCase(),
        instructions: m.instructions,
        measurementRules: m.measurement_rules,
        gear: m.gear,
        drills: m.drills,
        lowerIsBetter: m.lower_is_better,
        minValue: m.min_value,
        maxValue: m.max_value,
        unit: m.unit || "",
        inputs: m.inputs || null,
        formula: m.formula || "",
      })));
      setAthletes(aths.map((a: { id: string; first_name: string; last_name: string; grade: number; gender: string }) => ({
        id: a.id,
        firstName: a.first_name,
        lastName: a.last_name,
        grade: a.grade,
        gender: a.gender,
      })));
      setLoading(false);
    }

    load();
  }, [authLoading, user]);

  // --- Station CRUD ---
  const saveStation = useCallback(async (station: Station) => {
    const slug = station.id;

    // Resolve metric_id: if metricId is set, use it directly (it's already a UUID)
    const metricId = station.metricId || null;

    const { data: existing } = await supabase.from("stations").select("id").eq("slug", slug).maybeSingle();
    if (existing) {
      await supabase.from("stations").update({
        name: station.name,
        icon: station.icon,
        description: station.description,
        location: station.location,
        metric_id: metricId,
      }).eq("id", existing.id);
    } else {
      await supabase.from("stations").insert({
        slug,
        name: station.name,
        icon: station.icon,
        description: station.description,
        location: station.location,
        metric_id: metricId,
        sort_order: 99,
      });
    }
    setStations(prev => {
      const idx = prev.findIndex(s => s.id === station.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = station;
        return next;
      }
      return [...prev, station];
    });
  }, []);

  const deleteStation = useCallback(async (id: string) => {
    await supabase.from("stations").delete().eq("slug", id);
    setStations(prev => prev.filter(s => s.id !== id));
  }, []);

  // --- Metric CRUD ---
  const saveMetric = useCallback(async (metric: Metric) => {
    // Resolve category name -> uuid
    const { data: catRow } = await supabase
      .from("categories")
      .select("id")
      .ilike("name", metric.category)
      .maybeSingle();

    const row = {
      name: metric.name,
      acronym: metric.acronym,
      category_id: catRow?.id || null,
      instructions: metric.instructions,
      measurement_rules: metric.measurementRules,
      gear: metric.gear,
      drills: metric.drills,
      lower_is_better: metric.lowerIsBetter,
      min_value: metric.minValue,
      max_value: metric.maxValue,
      unit: metric.unit || "",
      inputs: metric.inputs,
      formula: metric.formula || "",
    };

    // Check if this is a UUID (existing DB record) or a local id
    const isUUID = metric.id.includes("-") && metric.id.length > 30;
    if (isUUID) {
      await supabase.from("metrics").update(row).eq("id", metric.id);
      setMetrics(prev => prev.map(m => m.id === metric.id ? metric : m));
    } else {
      const { data } = await supabase.from("metrics").insert(row).select("id").maybeSingle();
      const newMetric = { ...metric, id: data?.id || metric.id };
      setMetrics(prev => {
        const idx = prev.findIndex(m => m.id === metric.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = newMetric;
          return next;
        }
        return [...prev, newMetric];
      });
    }
  }, []);

  const deleteMetric = useCallback(async (id: string) => {
    await supabase.from("metrics").delete().eq("id", id);
    setMetrics(prev => prev.filter(m => m.id !== id));
  }, []);

  // --- Category CRUD ---
  const addCategory = useCallback(async (name: string) => {
    await supabase.from("categories").insert({ name });
    setCategories(prev => [...prev, name]);
  }, []);

  const renameCategory = useCallback(async (oldName: string, newName: string) => {
    await supabase.from("categories").update({ name: newName }).ilike("name", oldName);
    setCategories(prev => prev.map(c => c.toLowerCase() === oldName.toLowerCase() ? newName : c));
  }, []);

  const deleteCategory = useCallback(async (name: string) => {
    await supabase.from("categories").delete().ilike("name", name);
    setCategories(prev => prev.filter(c => c.toLowerCase() !== name.toLowerCase()));
  }, []);

  // --- Unit CRUD ---
  const addUnit = useCallback(async (name: string) => {
    await supabase.from("units").insert({ name });
    setUnits(prev => [...prev, name].sort());
  }, []);

  const renameUnit = useCallback(async (oldName: string, newName: string) => {
    await supabase.from("units").update({ name: newName }).eq("name", oldName);
    setUnits(prev => prev.map(u => u === oldName ? newName : u).sort());
  }, []);

  const deleteUnit = useCallback(async (name: string) => {
    await supabase.from("units").delete().eq("name", name);
    setUnits(prev => prev.filter(u => u !== name));
  }, []);

  return (
    <StoreContext.Provider value={{
      stations, setStations,
      metrics, setMetrics,
      athletes,
      units,
      categories, setCategories,
      loading,
      saveStation, deleteStation,
      saveMetric, deleteMetric,
      addCategory, renameCategory, deleteCategory,
      addUnit, renameUnit, deleteUnit,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
