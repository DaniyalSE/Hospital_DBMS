import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export interface MongoCollection {
  name: string;
  count: number;
  indexes: string[];
  lastUpdated: string;
}

export interface CollectionIndex {
  name: string;
  key: Record<string, number>;
  unique?: boolean;
  sparse?: boolean;
  size?: number;
}

export interface MongoDocument {
  _id: string;
  [key: string]: unknown;
}

export interface AggregationResult {
  results: unknown[];
}

export interface AggregationStatsResult {
  stats: Record<string, unknown>;
}

export interface DocumentQueryOptions {
  filter?: Record<string, unknown>;
  sort?: Record<string, number>;
  skip?: number;
  limit?: number;
  projection?: Record<string, number>;
  page?: number;
}

const COLLECTIONS_API = "/api/collections";
const DASHBOARD_API = "/api/dashboard";
const ADMIN_API = "/api/admin";

function buildQuery(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "object") {
      search.set(key, JSON.stringify(value));
    } else {
      search.set(key, String(value));
    }
  });
  return search.toString();
}

export function useMongoDb() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit) => {
      setIsLoading(true);
      setError(null);
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      };

      const config: RequestInit = {
        ...init,
        headers,
      };

      if (config.body && typeof config.body !== "string") {
        config.body = JSON.stringify(config.body);
      }

      try {
        const data = await apiRequest<T>(path, config);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        setError(message);
        toast({
          title: "MongoDB request failed",
          description: message,
          variant: "destructive",
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  const getCollections = useCallback(async (): Promise<MongoCollection[]> => {
    const data = await request<{ collections: MongoCollection[] }>(`${COLLECTIONS_API}`);
    return data.collections;
  }, [request]);

  const getDocuments = useCallback(
    async (
      collection: string,
      options: DocumentQueryOptions = {},
    ): Promise<{ documents: MongoDocument[]; totalCount: number; page: number; limit: number }> => {
      const query = buildQuery({
        page: options.page ?? (options.skip && options.limit ? Math.floor(options.skip / options.limit) + 1 : 1),
        limit: options.limit ?? 50,
        filter: options.filter,
        sort: options.sort,
        projection: options.projection,
      });
      return request<{ documents: MongoDocument[]; totalCount: number; page: number; limit: number }>(
        `${COLLECTIONS_API}/${encodeURIComponent(collection)}${query ? `?${query}` : ""}`,
      );
    },
    [request],
  );

  const getDocument = useCallback(
    async (collection: string, documentId: string) => {
      const data = await request<{ document: MongoDocument }>(
        `${COLLECTIONS_API}/${encodeURIComponent(collection)}/document/${documentId}`,
      );
      return data.document;
    },
    [request],
  );

  const createDocument = useCallback(
    async (collection: string, document: Record<string, unknown>) => {
      return request<{ insertedId: string }>(`${COLLECTIONS_API}/${encodeURIComponent(collection)}/document`, {
        method: "POST",
        body: JSON.stringify({ document }),
      });
    },
    [request],
  );

  const createDocuments = useCallback(
    async (collection: string, documents: Record<string, unknown>[]) => {
      return request<{ insertedCount: number; insertedIds: string[] }>(
        `${COLLECTIONS_API}/${encodeURIComponent(collection)}/documents`,
        {
          method: "POST",
          body: JSON.stringify({ documents }),
        },
      );
    },
    [request],
  );

  const updateDocument = useCallback(
    async (collection: string, documentId: string, update: Record<string, unknown>) => {
      return request<{ modifiedCount: number }>(`${COLLECTIONS_API}/${encodeURIComponent(collection)}/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify({ update }),
      });
    },
    [request],
  );

  const updateDocuments = useCallback(
    async (collection: string, filter: Record<string, unknown>, update: Record<string, unknown>) => {
      return request<{ modifiedCount: number }>(`${COLLECTIONS_API}/${encodeURIComponent(collection)}/update`, {
        method: "POST",
        body: JSON.stringify({ filter, update }),
      });
    },
    [request],
  );

  const deleteDocument = useCallback(
    async (collection: string, documentId: string) => {
      return request<{ deletedCount: number }>(`${COLLECTIONS_API}/${encodeURIComponent(collection)}/${documentId}`, {
        method: "DELETE",
      });
    },
    [request],
  );

  const deleteDocuments = useCallback(
    async (collection: string, filter: Record<string, unknown>) => {
      return request<{ deletedCount: number }>(`${COLLECTIONS_API}/${encodeURIComponent(collection)}/delete`, {
        method: "POST",
        body: JSON.stringify({ filter }),
      });
    },
    [request],
  );

  const runAggregation = useCallback(
    async (collection: string, pipeline: Record<string, unknown>[], options?: Record<string, unknown>) => {
      const payload = options && Object.keys(options).length > 0 ? { pipeline, options } : pipeline;
      return request<AggregationResult>(`${COLLECTIONS_API}/${encodeURIComponent(collection)}/aggregate`, {
        method: "POST",
        body: payload,
      });
    },
    [request],
  );

  const runAggregationWithStats = useCallback(
    async (collection: string, pipeline: Record<string, unknown>[], options?: Record<string, unknown>) => {
      const payload = options && Object.keys(options).length > 0 ? { pipeline, options } : pipeline;
      return request<AggregationStatsResult>(`${COLLECTIONS_API}/${encodeURIComponent(collection)}/aggregate/stats`, {
        method: "POST",
        body: payload,
      });
    },
    [request],
  );

  const getCollectionStats = useCallback(async (collection: string) => {
    return request<{ count: number; storageSize: number; avgObjSize: number; indexes: Array<{ name: string; key: Record<string, number>; size: number }> }>(
      `${COLLECTIONS_API}/${encodeURIComponent(collection)}/stats`,
    );
  }, [request]);

  const getIndexes = useCallback(async (collection: string): Promise<CollectionIndex[]> => {
    const data = await request<{ indexes: CollectionIndex[] }>(
      `${COLLECTIONS_API}/${encodeURIComponent(collection)}/indexes`,
    );
    return data.indexes;
  }, [request]);

  const createIndex = useCallback(
    async (collection: string, keys: Record<string, number>, options?: Record<string, unknown>) => {
      return request<{ indexName: string }>(`${COLLECTIONS_API}/${encodeURIComponent(collection)}/indexes`, {
        method: "POST",
        body: JSON.stringify({ keys, options }),
      });
    },
    [request],
  );

  const dropIndex = useCallback(
    async (collection: string, indexName: string) => {
      return request<{ dropped: boolean }>(`${COLLECTIONS_API}/${encodeURIComponent(collection)}/indexes/${indexName}`, {
        method: "DELETE",
      });
    },
    [request],
  );

  const getDashboardStats = useCallback(async () => {
    return request(`${DASHBOARD_API}`);
  }, [request]);

  const getAdminStats = useCallback(async () => {
    return request(`${ADMIN_API}`);
  }, [request]);

  return {
    isLoading,
    error,
    getCollections,
    getDocuments,
    getDocument,
    createDocument,
    createDocuments,
    updateDocument,
    updateDocuments,
    deleteDocument,
    deleteDocuments,
    runAggregation,
    runAggregationWithStats,
    getCollectionStats,
    getIndexes,
    createIndex,
    dropIndex,
    getDashboardStats,
    getAdminStats,
  };
}
