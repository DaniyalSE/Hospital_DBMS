import { Router } from "express";
import { getDb } from "../mongoClient";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const db = await getDb();

    const staffCollection = db.collection("Staff");
    const auditCollection = db.collection("AuditLogs");

    const [activeUsers, admins, auditLogs] = await Promise.all([
      staffCollection.countDocuments().catch(() => 0),
      staffCollection.countDocuments({ Role: /admin/i }).catch(() => 0),
      auditCollection.countDocuments().catch(() => 0),
    ]);

    const roleSamples = await staffCollection
      .find({}, { projection: { StaffEmail: 1, Role: 1 } })
      .limit(10)
      .toArray()
      .catch(() => []);

    res.json({
      activeUsers,
      admins,
      auditLogs,
      uptime: 99.9,
      roleSamples: roleSamples.map((doc) => ({
        email: doc.StaffEmail || doc.Email || "unknown",
        role: doc.Role || "Unknown",
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
