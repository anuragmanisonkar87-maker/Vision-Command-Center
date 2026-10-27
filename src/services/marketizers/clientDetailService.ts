// Marketizers — client detail composition. Pulls only what one client page needs.

import { supabase } from "@/integrations/supabase/client";
import { getMarketizersClientById } from "./clientsService";
import { getCollectionFollowupsByClient } from "./collectionFollowupsService";
import type { Client, CollectionFollowup, MonthlyEntry } from "@/types/marketizers";

export type ClientDetailBundle = {
  client: Client | null;
  entries: MonthlyEntry[];
  followups: CollectionFollowup[];
};

export async function getMarketizersClientDetail(
  clientId: string,
): Promise<ClientDetailBundle> {
  const [client, { data: entries, error }, followups] = await Promise.all([
    getMarketizersClientById(clientId),
    supabase
      .from("marketizers_monthly_entries" as any)
      .select("*")
      .eq("client_id", clientId)
      .eq("is_deleted", false)
      .order("month", { ascending: false }),
    getCollectionFollowupsByClient(clientId),
  ]);
  if (error) throw new Error(error.message);
  return {
    client,
    entries: (entries ?? []) as unknown as MonthlyEntry[],
    followups,
  };
}
