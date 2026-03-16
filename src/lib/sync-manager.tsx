"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { createClient } from "./supabase";
import {
  getPendingSyncItems,
  updateSyncItem,
  clearCompletedSyncItems,
  getSyncQueueCount,
  putItem,
  type SyncQueueEntry,
} from "./offline-db";

interface SyncContextType {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  forceSyncNow: () => void;
  refreshPendingCount: () => void;
}

const SyncContext = createContext<SyncContextType | null>(null);

const MAX_ATTEMPTS = 5;
const SYNC_INTERVAL = 5000; // 5s
const HEALTH_PING_INTERVAL = 30000; // 30s

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true); // Start true to match SSR; useEffect updates
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const syncingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const healthRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh pending count from IDB
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getSyncQueueCount();
      setPendingCount(count);
    } catch {
      // IDB not available
    }
  }, []);

  // Online/offline detection via browser events
  useEffect(() => {
    setIsOnline(navigator.onLine); // sync actual state after hydration
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Periodic Supabase health ping to catch captive portals / dead Wi-Fi
  useEffect(() => {
    const ping = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }
      try {
        const supabase = createClient();
        const { error } = await supabase.from("categories").select("id").limit(1);
        setIsOnline(!error);
      } catch {
        setIsOnline(false);
      }
    };
    healthRef.current = setInterval(ping, HEALTH_PING_INTERVAL);
    return () => { if (healthRef.current) clearInterval(healthRef.current); };
  }, []);

  // Process sync queue
  const processQueue = useCallback(async () => {
    if (syncingRef.current || !isOnline) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const items = await getPendingSyncItems();
      if (items.length === 0) {
        setIsSyncing(false);
        syncingRef.current = false;
        return;
      }

      const supabase = createClient();

      for (const item of items) {
        try {
          await updateSyncItem(item.id!, { status: "in_flight" });
          await processSyncItem(supabase, item);
          await updateSyncItem(item.id!, { status: "done" });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const newAttempts = item.attempts + 1;
          if (newAttempts >= MAX_ATTEMPTS) {
            await updateSyncItem(item.id!, { status: "failed", attempts: newAttempts, last_error: msg });
          } else {
            await updateSyncItem(item.id!, { status: "pending", attempts: newAttempts, last_error: msg });
          }
        }
      }

      await clearCompletedSyncItems();
      setLastSyncedAt(new Date().toISOString());
    } catch {
      // Queue processing failed entirely
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [isOnline, refreshPendingCount]);

  // Process a single sync queue item
  async function processSyncItem(supabase: ReturnType<typeof createClient>, item: SyncQueueEntry) {
    const { table, operation, payload, temp_id } = item;

    if (table === "results") {
      if (operation === "INSERT") {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _localId, ...insertPayload } = payload as Record<string, unknown>;
        const { data, error } = await supabase.from("results").insert(insertPayload).select("id").maybeSingle();
        if (error) {
          // Unique violation → convert to update (last-write-wins)
          if (error.code === "23505") {
            await supabase.from("results").update(insertPayload).eq("athlete_id", payload.athlete_id as string).eq("metric_id", payload.metric_id as string);
            return;
          }
          throw error;
        }
        // Replace temp UUID in IDB results store with real server UUID
        if (data?.id && temp_id) {
          const idbResult = { ...payload, id: data.id };
          await putItem("results", idbResult);
        }
      } else if (operation === "UPDATE") {
        const { id, ...updatePayload } = payload as Record<string, unknown>;
        const { error } = await supabase.from("results").update(updatePayload).eq("id", id as string);
        if (error) throw error;
      }
    } else if (table === "attendance") {
      if (operation === "UPSERT") {
        const { error } = await supabase.from("attendance").upsert(payload, { onConflict: "athlete_id,date" });
        if (error) throw error;
      } else if (operation === "DELETE") {
        const { error } = await supabase.from("attendance").delete().eq("athlete_id", payload.athlete_id as string).eq("date", payload.date as string);
        if (error) throw error;
      }
    }
  }

  // Sync loop: every 5s when online
  useEffect(() => {
    if (isOnline) {
      processQueue(); // immediate on reconnect
      intervalRef.current = setInterval(processQueue, SYNC_INTERVAL);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isOnline, processQueue]);

  // iOS: sync on foreground return
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isOnline) {
        processQueue();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isOnline, processQueue]);

  // Initial pending count
  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount]);

  const forceSyncNow = useCallback(() => { processQueue(); }, [processQueue]);

  return (
    <SyncContext.Provider value={{ isOnline, pendingCount, isSyncing, lastSyncedAt, forceSyncNow, refreshPendingCount }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}
