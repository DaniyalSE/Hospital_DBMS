import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const LOCK_TIMEOUT_MS = Number(process.env.LOCK_TIMEOUT_MS ?? 5000);
const SIMULATED_HOLD_MS = Number(process.env.LOCK_SIM_HOLD_MS ?? 15000);
const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "locks.log");
const MAX_LOG_ENTRIES = 200;

export type LockType = "read" | "write";

interface LockRequest {
  type: LockType;
  sessionId: string;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  requestedAt: number;
}

interface LockRecord {
  readers: Map<string, number>;
  writer: { sessionId: string; acquiredAt: number } | null;
  queue: LockRequest[];
}

export interface ActiveLockSnapshot {
  resourceId: string;
  type: LockType;
  sessionId: string;
  heldSince: string;
}

export interface QueueSnapshot {
  resourceId: string;
  type: LockType;
  sessionId: string;
  waitingSince: string;
}

class LockManager {
  private locks = new Map<string, LockRecord>();
  private recentLogs: string[] = [];
  private ensureLogDirPromise: Promise<void> | null = null;

  private async ensureLogDir() {
    if (!this.ensureLogDirPromise) {
      this.ensureLogDirPromise = fs.mkdir(LOG_DIR, { recursive: true }).then(() => undefined);
    }
    return this.ensureLogDirPromise;
  }

  private async log(message: string) {
    const line = `[${new Date().toISOString()}] ${message}`;
    await this.ensureLogDir();
    await fs.appendFile(LOG_FILE, `${line}\n`).catch(() => {
      // ignore logging issues at runtime to avoid blocking.
    });
    this.recentLogs.push(line);
    if (this.recentLogs.length > MAX_LOG_ENTRIES) {
      this.recentLogs.shift();
    }
  }

  private getRecord(resourceId: string): LockRecord {
    let record = this.locks.get(resourceId);
    if (!record) {
      record = {
        readers: new Map<string, number>(),
        writer: null,
        queue: [],
      };
      this.locks.set(resourceId, record);
    }
    return record;
  }

  private enqueue(resourceId: string, sessionId: string, type: LockType, timeout = LOCK_TIMEOUT_MS) {
    const record = this.getRecord(resourceId);
    return new Promise<void>((resolve, reject) => {
      const requestedAt = Date.now();
      const timer = setTimeout(() => {
        record.queue = record.queue.filter((req) => req !== request);
        reject(new Error(`Lock acquisition timeout for ${type} lock on ${resourceId}`));
        this.log(`TIMEOUT type=${type} resource=${resourceId} session=${sessionId}`);
        this.cleanup(resourceId);
        this.processQueue(resourceId);
      }, timeout);

      const request: LockRequest = {
        type,
        sessionId,
        requestedAt,
        resolve: () => {
          clearTimeout(timer);
          this.log(`ACQUIRED type=${type} resource=${resourceId} session=${sessionId}`);
          resolve();
        },
        reject: (error: Error) => {
          clearTimeout(timer);
          reject(error);
        },
        timer,
      };

      record.queue.push(request);
      this.log(`QUEUED type=${type} resource=${resourceId} session=${sessionId}`);
      this.processQueue(resourceId);
    });
  }

  private cleanup(resourceId: string) {
    const record = this.locks.get(resourceId);
    if (!record) return;
    if (record.readers.size === 0 && !record.writer && record.queue.length === 0) {
      this.locks.delete(resourceId);
    }
  }

  private processQueue(resourceId: string) {
    const record = this.locks.get(resourceId);
    if (!record) return;

    if (record.queue.length === 0) {
      this.cleanup(resourceId);
      return;
    }

    if (record.writer) {
      return;
    }

    const next = record.queue[0];

    if (next.type === "write") {
      if (record.readers.size === 0) {
        record.queue.shift();
        record.writer = { sessionId: next.sessionId, acquiredAt: Date.now() };
        next.resolve();
      }
      return;
    }

    while (record.queue.length > 0 && record.queue[0].type === "read" && !record.writer) {
      const readerReq = record.queue.shift()!;
      record.readers.set(readerReq.sessionId, Date.now());
      readerReq.resolve();
    }
  }

  async acquireReadLock(resourceId: string, sessionId: string) {
    await this.enqueue(resourceId, sessionId, "read");
  }

  async acquireWriteLock(resourceId: string, sessionId: string) {
    await this.enqueue(resourceId, sessionId, "write");
  }

  async releaseLock(resourceId: string, sessionId: string) {
    const record = this.locks.get(resourceId);
    if (!record) {
      return;
    }

    let released = false;

    if (record.writer?.sessionId === sessionId) {
      record.writer = null;
      released = true;
    }

    if (record.readers.delete(sessionId)) {
      released = true;
    }

    record.queue = record.queue.filter((req) => {
      if (req.sessionId !== sessionId) {
        return true;
      }
      req.reject(new Error(`Lock request cancelled for session ${sessionId}`));
      return false;
    });

    if (released) {
      await this.log(`RELEASED resource=${resourceId} session=${sessionId}`);
    }

    this.processQueue(resourceId);
    this.cleanup(resourceId);
  }

  getActiveLocks(): ActiveLockSnapshot[] {
    const now = new Date();
    const snapshots: ActiveLockSnapshot[] = [];
    for (const [resourceId, record] of this.locks.entries()) {
      if (record.writer) {
        snapshots.push({
          resourceId,
          type: "write",
          sessionId: record.writer.sessionId,
          heldSince: new Date(record.writer.acquiredAt).toISOString(),
        });
      }
      for (const [sessionId, acquiredAt] of record.readers.entries()) {
        snapshots.push({
          resourceId,
          type: "read",
          sessionId,
          heldSince: new Date(acquiredAt).toISOString(),
        });
      }
    }
    return snapshots.sort((a, b) => a.heldSince.localeCompare(b.heldSince) || a.resourceId.localeCompare(b.resourceId));
  }

  getLockQueue(): QueueSnapshot[] {
    const snapshots: QueueSnapshot[] = [];
    for (const [resourceId, record] of this.locks.entries()) {
      for (const req of record.queue) {
        snapshots.push({
          resourceId,
          type: req.type,
          sessionId: req.sessionId,
          waitingSince: new Date(req.requestedAt).toISOString(),
        });
      }
    }
    return snapshots.sort((a, b) => a.waitingSince.localeCompare(b.waitingSince));
  }

  getRecentLogs() {
    return [...this.recentLogs].reverse();
  }

  async forceUnlock(resourceId: string) {
    const record = this.locks.get(resourceId);
    if (!record) return;
    const readerSessions = Array.from(record.readers.keys());
    const affectedSessions = [record.writer?.sessionId, ...readerSessions].filter(Boolean) as string[];
    record.writer = null;
    record.readers.clear();
    for (const req of record.queue) {
      req.reject(new Error(`Force unlock flushed session ${req.sessionId}`));
    }
    record.queue = [];
    await this.log(`FORCE_UNLOCK resource=${resourceId} sessions=${affectedSessions.join(",")}`);
    this.cleanup(resourceId);
  }

  async simulateReadLock(resourceId: string, holdMs = SIMULATED_HOLD_MS) {
    const sessionId = `sim-read-${randomUUID()}`;
    await this.acquireReadLock(resourceId, sessionId);
    setTimeout(() => {
      void this.releaseLock(resourceId, sessionId);
    }, holdMs);
    return sessionId;
  }

  async simulateWriteLock(resourceId: string, holdMs = SIMULATED_HOLD_MS) {
    const sessionId = `sim-write-${randomUUID()}`;
    await this.acquireWriteLock(resourceId, sessionId);
    setTimeout(() => {
      void this.releaseLock(resourceId, sessionId);
    }, holdMs);
    return sessionId;
  }

  async clearAll() {
    for (const resourceId of [...this.locks.keys()]) {
      await this.forceUnlock(resourceId);
    }
    await this.log("CLEAR_ALL invoked");
  }
}

const lockManager = new LockManager();
export default lockManager;
