import { useCallback, useEffect, useState } from "react";
import {
  getMarketizersClientDetail,
  type ClientDetailBundle,
} from "@/services/marketizers/clientDetailService";

export function useMarketizersClientDetail(clientId: string | undefined) {
  const [data, setData] = useState<ClientDetailBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await getMarketizersClientDetail(clientId));
    } catch (e: any) {
      setError(e?.message ?? "Could not load client.");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { void refetch(); }, [refetch]);

  return { data, loading, error, refetch };
}
