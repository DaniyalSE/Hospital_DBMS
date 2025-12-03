import { Router } from "express";
import type { Document } from "mongodb";
import { getDb } from "../mongoClient";
import { HOSPITAL_COLLECTIONS } from "../constants";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const db = await getDb();

    const counts = await Promise.all(
      HOSPITAL_COLLECTIONS.map(async (name) => {
        try {
          const collection = db.collection(name);
          const count = await collection.countDocuments();
          return { name, count };
        } catch (error) {
          return { name, count: 0 };
        }
      }),
    );

    const totalRecords = counts.reduce((sum, entry) => sum + entry.count, 0);

    const getSafeAgg = async <T extends Document = Document>(name: string, pipeline: Record<string, unknown>[]) => {
      try {
        const collection = db.collection(name);
        return await collection.aggregate<T>(pipeline).toArray();
      } catch (error) {
        return [] as T[];
      }
    };

    const genderDistribution = await getSafeAgg<{ _id: string; count: number }>("Patients", [
      { $group: { _id: "$Gender", count: { $sum: 1 } } },
      { $project: { _id: 0, gender: "$_id", count: 1 } },
    ]);

    const departmentLoads = await getSafeAgg<{ department: string; count: number }>("Departments", [
      { $group: { _id: "$DeptName", count: { $sum: 1 } } },
      { $project: { department: "$_id", count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const billingTotals = await getSafeAgg<{ method: string; total: number }>("Bills", [
      { $group: { _id: "$PaymentMethod", total: { $sum: "$Amount" } } },
      { $project: { _id: 0, method: "$_id", total: 1 } },
    ]);

    const monthlyAppointments = await getSafeAgg<{ month: string; count: number }>("Appointments", [
      {
        $group: {
          _id: {
            year: { $year: "$Date" },
            month: { $month: "$Date" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $arrayElemAt: [["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], { $subtract: ["$_id.month", 1] }] },
              " ",
              { $toString: "$_id.year" },
            ],
          },
          count: 1,
        },
      },
    ]);

    const topDoctors = await getSafeAgg<{ doctorName: string; appointments: number }>("Appointments", [
      { $group: { _id: "$DoctorID", appointments: { $sum: 1 } } },
      { $sort: { appointments: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "Doctors",
          localField: "_id",
          foreignField: "DoctorID",
          as: "doctorInfo",
        },
      },
      { $unwind: { path: "$doctorInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          doctorName: { $ifNull: ["$doctorInfo.Name", "Unknown"] },
          appointments: 1,
        },
      },
    ]);

    const testResults = await getSafeAgg<{ result: string; count: number }>("LabTests", [
      { $group: { _id: "$Result", count: { $sum: 1 } } },
      { $project: { _id: 0, result: "$_id", count: 1 } },
    ]);

    const recentWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentInserts = await getSafeAgg<{ collection: string; count: number }>("Appointments", [
      {
        $match: {
          $or: [
            { createdAt: { $gte: recentWindow } },
            { Date: { $gte: recentWindow } },
          ],
        },
      },
      { $count: "count" },
    ]);

    const recentUpdates = await getSafeAgg<{ count: number }>("Patients", [
      {
        $match: {
          updatedAt: { $gte: recentWindow },
        },
      },
      { $count: "count" },
    ]);

    res.json({
      totalRecords,
      collectionsCount: counts.length,
      recentInserts: recentInserts[0]?.count || 0,
      recentUpdates: recentUpdates[0]?.count || 0,
      topDoctors,
      genderDistribution,
      departmentLoads,
      billingTotals,
      monthlyAppointments,
      testResults,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
