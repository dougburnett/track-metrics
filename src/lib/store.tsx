"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

// --- Types ---

export interface Station {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export interface Metric {
  id: string;
  name: string;
  acronym: string;
  category: string;
  station: string;
  instructions: string;
  measurementRules: string;
  gear: string;
  drills: string;
}

// --- Icon list ---

export const AVAILABLE_ICONS = [
  "zap", "timer", "arrow-up-right", "ruler", "dumbbell", "scale",
  "target", "flame", "gauge", "activity", "heart-pulse", "footprints",
  "move", "trending-up", "trophy", "clipboard", "eye", "wind",
  "mountain", "bike", "swords", "shield", "star", "circle-dot",
];

// --- Defaults ---

const defaultStations: Station[] = [
  { id: "rsi", name: "RSI", icon: "zap", description: "Reactive Strength Index" },
  { id: "sprint", name: "Sprint Splits", icon: "timer", description: "10m / 20m / 40m" },
  { id: "vertical", name: "Vertical Jump", icon: "arrow-up-right", description: "Standing / Approach" },
  { id: "balance", name: "Balance", icon: "scale", description: "Single Leg Hold" },
  { id: "explosiveness", name: "Explosiveness", icon: "dumbbell", description: "Broad Jump / Bounds" },
  { id: "strength", name: "Strength", icon: "ruler", description: "Max Rep Testing" },
];

const defaultMetrics: Metric[] = [
  { id: "rsi", name: "Reactive Strength Index", acronym: "RSI", category: "power", station: "rsi", instructions: "Athlete performs a depth jump from a 30cm box onto a contact mat. Measure flight time vs contact time.", measurementRules: "Best of 3 attempts. Rest 60s between attempts.", gear: "Contact mat, 30cm box", drills: "Depth jumps, Pogo hops" },
  { id: "sprint", name: "Sprint Splits", acronym: "Sprint", category: "speed", station: "sprint", instructions: "Athlete sprints 40m through electronic timing gates at 10m, 20m, and 40m.", measurementRules: "Best of 2 attempts. Full recovery between runs.", gear: "Electronic timing gates", drills: "Block starts, Acceleration runs" },
  { id: "vertical", name: "Vertical Jump", acronym: "VJ", category: "power", station: "vertical", instructions: "Athlete performs a countermovement jump reaching for Vertec vanes.", measurementRules: "Best of 3 attempts. Standing reach measured first.", gear: "Vertec or jump mat", drills: "Squat jumps, Tuck jumps" },
  { id: "balance", name: "Single Leg Balance", acronym: "Balance", category: "stability", station: "balance", instructions: "Athlete stands on one leg, eyes open, hands on hips. Time until loss of balance.", measurementRules: "Max 60 seconds. Both legs tested.", gear: "Stopwatch, flat surface", drills: "Single leg RDL, Bosu ball stands" },
  { id: "explosiveness", name: "Standing Broad Jump", acronym: "SBJ", category: "power", station: "explosiveness", instructions: "Athlete performs a standing broad jump from behind a line. Measure from takeoff line to nearest heel landing.", measurementRules: "Best of 3 attempts.", gear: "Tape measure, flat surface", drills: "Bounds, Box jumps" },
  { id: "strength", name: "Max Rep Test", acronym: "Strength", category: "strength", station: "strength", instructions: "Athlete performs max reps of a given exercise in proper form.", measurementRules: "Stop at form breakdown. Spotter required.", gear: "Barbell, plates, spotter", drills: "Progressive overload sets" },
];

const defaultCategories = ["Power", "Speed", "Stability", "Strength", "Endurance"];

// --- Context ---

interface StoreContextType {
  stations: Station[];
  setStations: React.Dispatch<React.SetStateAction<Station[]>>;
  metrics: Metric[];
  setMetrics: React.Dispatch<React.SetStateAction<Metric[]>>;
  categories: string[];
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [stations, setStations] = useState<Station[]>(() => loadFromStorage("tm_stations", defaultStations));
  const [metrics, setMetrics] = useState<Metric[]>(() => loadFromStorage("tm_metrics", defaultMetrics));
  const [categories, setCategories] = useState<string[]>(() => loadFromStorage("tm_categories", defaultCategories));

  useEffect(() => { localStorage.setItem("tm_stations", JSON.stringify(stations)); }, [stations]);
  useEffect(() => { localStorage.setItem("tm_metrics", JSON.stringify(metrics)); }, [metrics]);
  useEffect(() => { localStorage.setItem("tm_categories", JSON.stringify(categories)); }, [categories]);

  return (
    <StoreContext.Provider value={{ stations, setStations, metrics, setMetrics, categories, setCategories }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
