"use client";

import { WifiOff, CloudUpload } from "lucide-react";
import { useSync } from "@/lib/sync-manager";

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing } = useSync();

  // Hidden when online with nothing pending
  if (isOnline && pendingCount === 0 && !isSyncing) return null;

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 shrink-0">
        <WifiOff size={12} className="text-red-600" />
        <span className="font-mono text-[10px] font-semibold text-red-700">
          Offline{pendingCount > 0 ? ` (${pendingCount} queued)` : ""}
        </span>
      </div>
    );
  }

  // Online but syncing or has pending
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 shrink-0">
      <CloudUpload size={12} className="text-amber-600" />
      <span className="font-mono text-[10px] font-semibold text-amber-700">
        Syncing {pendingCount}...
      </span>
    </div>
  );
}
