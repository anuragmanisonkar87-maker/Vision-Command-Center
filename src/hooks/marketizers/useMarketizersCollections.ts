import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPendingCollections,
  type CollectionFilters,
} from "@/services/marketizers/collectionFollowupsService";
import type { CollectionFollowup } from "@/types/marketizers";

export function useMarketizersCollections(initial: CollectionFilters = {}) {
  const [filters, setFilters] = useState<CollectionFilters>(initial);
  const [rows, setRows] = useState<CollectionFollowup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getPendingCollections(filters));
    } catch (e: any) {
      setError(e?.message ?? "Could not load collections.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void refetch(); }, [refetch]);

  const updateFilter = useCallback(
    <K extends keyof CollectionFilters>(k: K, v: CollectionFilters[K]) =>
      setFilters((f) => ({ ...f, [k]: v })),
    [],
  );
  const clearFilters = useCallback(() => setFilters({}), []);

  return useMemo(
    () => ({ rows, loading, error, refetch, filters, updateFilter, clearFilters, setFilters }),
    [rows, loading, error, refetch, filters, updateFilter, clearFilters],
  );
}
