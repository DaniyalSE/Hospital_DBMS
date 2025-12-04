import { Router } from "express";
import lockManager from "../concurrency/LockManager";

const DEFAULT_RESOURCE = "Appointments";

const router = Router();

router.get("/status", (_req, res) => {
  const locks = lockManager.getActiveLocks();
  const summary = {
    total: locks.length,
    readers: locks.filter((lock) => lock.type === "read").length,
    writers: locks.filter((lock) => lock.type === "write").length,
    resources: new Set(locks.map((lock) => lock.resourceId)).size,
    lastUpdated: new Date().toISOString(),
  };
  res.json({
    locks,
    logs: lockManager.getRecentLogs(),
    summary,
  });
});

router.get("/queue", (_req, res) => {
  const queue = lockManager.getLockQueue();
  const summary = {
    total: queue.length,
    readers: queue.filter((entry) => entry.type === "read").length,
    writers: queue.filter((entry) => entry.type === "write").length,
    resources: new Set(queue.map((entry) => entry.resourceId)).size,
    lastUpdated: new Date().toISOString(),
  };
  res.json({ queue, summary });
});

router.post("/simulate/read", async (req, res, next) => {
  try {
    const { resourceId = DEFAULT_RESOURCE, holdMs } = req.body ?? {};
    const sessionId = await lockManager.simulateReadLock(String(resourceId || DEFAULT_RESOURCE), holdMs);
    res.json({ ok: true, sessionId });
  } catch (error) {
    next(error);
  }
});

router.post("/simulate/write", async (req, res, next) => {
  try {
    const { resourceId = DEFAULT_RESOURCE, holdMs } = req.body ?? {};
    const sessionId = await lockManager.simulateWriteLock(String(resourceId || DEFAULT_RESOURCE), holdMs);
    res.json({ ok: true, sessionId });
  } catch (error) {
    next(error);
  }
});

router.post("/force-unlock", async (req, res, next) => {
  try {
    const { resourceId } = req.body ?? {};
    if (!resourceId || typeof resourceId !== "string") {
      return res.status(400).json({ message: "resourceId is required" });
    }
    await lockManager.forceUnlock(resourceId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post("/clear", async (_req, res, next) => {
  try {
    await lockManager.clearAll();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
