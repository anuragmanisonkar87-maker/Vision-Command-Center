// @ts-nocheck
import { useCallback, useEffect, useState } from "react";
import * as svc from "@/services/accessControl/accessControlService";

export function useTeamMembers() {
  const [data, setData] = useState<svc.TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await svc.getTeamMembers()); }
    catch (e: any) { setError(e?.message ?? "Failed to load team members."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refetch(); }, [refetch]);
  return { data, loading, error, refetch };
}

export function usePositions() {
  const [data, setData] = useState<svc.Position[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try { setData(await svc.getPositions()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export function useModules() {
  const [data, setData] = useState<svc.ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try { setData(await svc.getModules()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export function useMasterOptions(optionType: string) {
  const [data, setData] = useState<svc.MasterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try { setData(await svc.getMasterOptions(optionType)); }
    finally { setLoading(false); }
  }, [optionType]);
  useEffect(() => { void refetch(); }, [refetch]);
  return { data, loading, refetch };
}
