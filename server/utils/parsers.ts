import { ObjectId, Document } from "mongodb";

export function parseJSON<T>(value?: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error("Invalid JSON payload");
  }
}

export function toObjectId(id: string) {
  if (!id) return undefined;
  try {
    return new ObjectId(id);
  } catch (error) {
    return undefined;
  }
}

export function normalizeDocument(doc: Document) {
  if (!doc) return doc;
  return {
    ...doc,
    _id: doc._id?.toString?.() ?? doc._id,
  };
}
