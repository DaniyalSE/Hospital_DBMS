import { Router } from "express";
import type { Document, Filter, Sort } from "mongodb";
import { z } from "zod";
import { getDb, getStatsDb } from "../mongoClient";
import { normalizeDocument, parseJSON, toObjectId } from "../utils/parsers";

const router = Router();

type GenericDocument = Document & { _id?: string | ReturnType<typeof toObjectId> };

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  filter: z.string().optional(),
  sort: z.string().optional(),
  projection: z.string().optional(),
});

router.get("/", async (_req, res, next) => {
  try {
    const db = await getStatsDb();
    const collections = await db.listCollections().toArray();
    const payload = await Promise.all(
      collections.map(async (meta) => {
        const col = db.collection(meta.name);
        const [count, indexes] = await Promise.all([
          col.estimatedDocumentCount(),
          col.indexes(),
        ]);
        const latestDoc = await col
          .find()
          .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
          .limit(1)
          .toArray();

        const rawTimestamp =
          latestDoc[0]?.updatedAt || latestDoc[0]?.createdAt || latestDoc[0]?._id?.getTimestamp?.();
        const lastUpdated = rawTimestamp instanceof Date
          ? rawTimestamp.toISOString()
          : typeof rawTimestamp === "string"
            ? rawTimestamp
            : latestDoc[0]?._id?.toString?.() || null;

        return {
          name: meta.name,
          count,
          indexes: indexes.map((idx) => idx.name).filter(Boolean),
          lastUpdated,
        };
      }),
    );

    res.json({ collections: payload });
  } catch (error) {
    next(error);
  }
});

router.get("/:name", async (req, res, next) => {
  try {
    const { name } = req.params;
    const parsed = paginationSchema.parse(req.query);
    const filter = (parseJSON<Filter<GenericDocument>>(parsed.filter) || {}) as Filter<GenericDocument>;
    const sort = (parseJSON<Sort>(parsed.sort) || { _id: -1 }) as Sort;
    const projection = parseJSON<Record<string, number>>(parsed.projection);

    const skip = (parsed.page - 1) * parsed.limit;

    const db = await getDb();
    const collection = db.collection<GenericDocument>(name);

    const [documents, totalCount] = await Promise.all([
      collection
        .find(filter, projection ? { projection } : undefined)
        .sort(sort)
        .skip(skip)
        .limit(parsed.limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    res.json({
      documents: documents.map(normalizeDocument),
      totalCount,
      page: parsed.page,
      limit: parsed.limit,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:name/document/:id", async (req, res, next) => {
  try {
    const { name, id } = req.params;
    const db = await getDb();
    const collection = db.collection<GenericDocument>(name);
    const objectId = toObjectId(id);
    const filter: Filter<GenericDocument> = objectId ? { _id: objectId } : { _id: id };
    const document = await collection.findOne(filter);

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    res.json({ document: normalizeDocument(document) });
  } catch (error) {
    next(error);
  }
});

router.post("/:name/document", async (req, res, next) => {
  try {
    const { name } = req.params;
    const db = await getDb();
    const collection = db.collection<GenericDocument>(name);

    const { document } = req.body ?? {};
    if (!document || typeof document !== "object") {
      return res.status(400).json({ message: "document payload is required" });
    }

    const result = await collection.insertOne(document);
    res.status(201).json({ insertedId: result.insertedId.toString() });
  } catch (error) {
    next(error);
  }
});

router.post("/:name/documents", async (req, res, next) => {
  try {
    const { name } = req.params;
    const db = await getDb();
    const collection = db.collection<GenericDocument>(name);

    const { documents } = req.body ?? {};
    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ message: "documents array is required" });
    }

    const result = await collection.insertMany(documents);
    res.status(201).json({ insertedCount: result.insertedCount, insertedIds: Object.values(result.insertedIds).map(String) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:name/:id", async (req, res, next) => {
  try {
    const { name, id } = req.params;
    const db = await getDb();
    const collection = db.collection<GenericDocument>(name);

    const { update } = req.body ?? {};
    if (!update || typeof update !== "object") {
      return res.status(400).json({ message: "update payload is required" });
    }

    const objectId = toObjectId(id);
    const filter: Filter<GenericDocument> = objectId ? { _id: objectId } : { _id: id };

    const result = await collection.updateOne(filter, { $set: update });
    res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

router.post("/:name/update", async (req, res, next) => {
  try {
    const { name } = req.params;
    const { filter, update } = req.body ?? {};

    if (!filter || typeof filter !== "object" || !update || typeof update !== "object") {
      return res.status(400).json({ message: "filter and update objects are required" });
    }

    const db = await getDb();
    const collection = db.collection<GenericDocument>(name);
    const result = await collection.updateMany(filter as Filter<GenericDocument>, { $set: update });
    res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

router.delete("/:name/:id", async (req, res, next) => {
  try {
    const { name, id } = req.params;
    const db = await getDb();
    const collection = db.collection<GenericDocument>(name);

    const objectId = toObjectId(id);
    const filter: Filter<GenericDocument> = objectId ? { _id: objectId } : { _id: id };
    const result = await collection.deleteOne(filter);

    res.json({ deletedCount: result.deletedCount });
  } catch (error) {
    next(error);
  }
});

router.post("/:name/delete", async (req, res, next) => {
  try {
    const { name } = req.params;
    const db = await getDb();
    const collection = db.collection<GenericDocument>(name);

    const { filter } = req.body ?? {};
    if (!filter || typeof filter !== "object") {
      return res.status(400).json({ message: "filter object is required" });
    }

    const result = await collection.deleteMany(filter as Filter<GenericDocument>);
    res.json({ deletedCount: result.deletedCount });
  } catch (error) {
    next(error);
  }
});

router.post("/:name/aggregate", async (req, res, next) => {
  try {
    const { name } = req.params;
    const body = req.body ?? [];

    const pipeline = Array.isArray(body) ? body : body?.pipeline;
    const userOptions = Array.isArray(body) ? {} : body?.options;

    if (!Array.isArray(pipeline)) {
      return res.status(400).json({ message: "pipeline must be an array" });
    }

    const options: Record<string, unknown> = typeof userOptions === "object" && userOptions ? { ...userOptions } : {};
    options.allowDiskUse = true;

    const db = await getDb();
    const collection = db.collection(name);

    const cursor = collection.aggregate(pipeline as Document[], options);
    const results = await cursor.toArray();

    res.json({ ok: true, results });
  } catch (error) {
    next(error);
  }
});

router.post("/:name/aggregate/stats", async (req, res, next) => {
  try {
    const { name } = req.params;
    const body = req.body ?? [];

    const pipeline = Array.isArray(body) ? body : body?.pipeline;

    if (!Array.isArray(pipeline)) {
      return res.status(400).json({ message: "pipeline must be an array" });
    }

    const db = await getDb();
    const aggregateCommand: Document = {
      aggregate: name,
      pipeline: pipeline as Document[],
      cursor: {},
      allowDiskUse: true,
    };

    const stats = await db.command({ explain: aggregateCommand, verbosity: "executionStats" });

    res.json({ ok: true, stats });
  } catch (error) {
    next(error);
  }
});

router.get("/:name/stats", async (req, res, next) => {
  try {
    const { name } = req.params;
    const db = await getDb();
    const collection = db.collection<GenericDocument>(name);

    const stats = await db.command({ collStats: name });
    const indexesCursor = await collection.listIndexes().toArray();

    res.json({
      count: stats.count,
      storageSize: stats.storageSize,
      avgObjSize: stats.avgObjSize,
      indexes: indexesCursor.map((idx) => ({
        name: idx.name,
        key: idx.key,
        size: idx.size,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:name/indexes", async (req, res, next) => {
  try {
    const { name } = req.params;
    const db = await getDb();
    const collection = db.collection<GenericDocument>(name);

    const indexes = await collection.listIndexes().toArray();
    res.json({
      indexes: indexes.map((idx) => ({
        name: idx.name,
        key: idx.key,
        unique: Boolean(idx.unique),
        sparse: Boolean(idx.sparse),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:name/indexes", async (req, res, next) => {
  try {
    const { name } = req.params;
    const { keys, options } = req.body ?? {};

    if (!keys || typeof keys !== "object") {
      return res.status(400).json({ message: "keys object is required" });
    }

    const db = await getDb();
    const collection = db.collection(name);

    const indexName = await collection.createIndex(keys, options);
    res.json({ indexName });
  } catch (error) {
    next(error);
  }
});

router.delete("/:name/indexes/:indexName", async (req, res, next) => {
  try {
    const { name, indexName } = req.params;
    const db = await getDb();
    const collection = db.collection(name);

    await collection.dropIndex(indexName);
    res.json({ dropped: true });
  } catch (error) {
    next(error);
  }
});

export default router;
