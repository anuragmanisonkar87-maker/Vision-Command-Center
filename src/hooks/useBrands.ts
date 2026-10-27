import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrands, type Brand } from "@/services/brands/brandService";

export function useBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBrands(await getBrands());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load brands.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  const activeBrands = useMemo(() => brands.filter((b) => b.status === "active"), [brands]);
  const allocationBrands = useMemo(
    () => activeBrands.filter((b) => b.include_in_expense_allocation),
    [activeBrands]
  );

  return { brands, activeBrands, allocationBrands, loading, error, refetch };
}
