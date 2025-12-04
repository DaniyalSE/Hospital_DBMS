import { useCallback } from "react";
import { apiGet, apiRequest } from "@/lib/api";

export interface LockSnapshot {
  resourceId: string;
  type: "read" | "write";
  sessionId: string;
  heldSince: string;
}

export interface QueueEntry {
  resourceId: string;
  type: "read" | "write";
  sessionId: string;
  waitingSince: string;
}

export interface LockStatusSummary {
  total: number;
  readers: number;
  writers: number;
  resources: number;
  lastUpdated: string;
}

export interface QueueSummary extends LockStatusSummary {}

const LOCKS_API = "/api/locks";

export function useLocking() {
  const getStatus = useCallback(async () => {
    return apiGet<{ locks: LockSnapshot[]; logs: string[]; summary: LockStatusSummary }>(`${LOCKS_API}/status`);
  }, []);

  const getQueue = useCallback(async () => {
    return apiGet<{ queue: QueueEntry[]; summary: QueueSummary }>(`${LOCKS_API}/queue`);
  }, []);

  const simulateReadLock = useCallback(async (resourceId?: string, holdMs?: number) => {
    return apiRequest<{ ok: boolean; sessionId: string }>(`${LOCKS_API}/simulate/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId, holdMs }),
    });
  }, []);

  const simulateWriteLock = useCallback(async (resourceId?: string, holdMs?: number) => {
    return apiRequest<{ ok: boolean; sessionId: string }>(`${LOCKS_API}/simulate/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId, holdMs }),
    });
  }, []);

  const forceUnlock = useCallback(async (resourceId: string) => {
    return apiRequest<{ ok: boolean }>(`${LOCKS_API}/force-unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceId }),
    });
  }, []);

  const clearLocks = useCallback(async () => {
    return apiRequest<{ ok: boolean }>(`${LOCKS_API}/clear`, {
      method: "POST",
    });
  }, []);

  return {
    getStatus,
    getQueue,
    simulateReadLock,
    simulateWriteLock,
    forceUnlock,
    clearLocks,
  };
}
