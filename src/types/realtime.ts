export interface RealtimePayload<T = unknown> {
  collection: string;
  operationType: string;
  documentKey?: unknown;
  fullDocument?: T;
  updateDescription?: unknown;
  timestamp: string;
}

export type RealtimeStatus = "idle" | "connecting" | "open" | "closed" | "error";
