// Dynamic brand registry — reads from gwv_brands.
import { supabase } from "@/integrations/supabase/client";

export type Brand = {
  id: string;
  name: string;
  slug: string;
  legacy_slug: string | null;
  route_path: string | null;
  color: string;
  category: string | null;
  description: string | null;
  status: "active" | "paused" | "archived";
  include_in_sidebar: boolean;
  include_in_expense_allocation: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const T = "gwv_brands";

export async function getBrands(): Promise<Brand[]> {
  const { data, error } = await supabase
    .from(T as any)
    .select("*")
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Brand[];
}

export async function getActiveBrands(): Promise<Brand[]> {
  return (await getBrands()).filter((b) => b.status === "active");
}

export async function getAllocationBrands(): Promise<Brand[]> {
  return (await getActiveBrands()).filter((b) => b.include_in_expense_allocation);
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const { data, error } = await supabase
    .from(T as any)
    .select("*")
    .eq("is_deleted", false)
    .or(`slug.eq.${slug},legacy_slug.eq.${slug}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as Brand) ?? null;
}

export async function createBrand(p: Partial<Brand>): Promise<Brand> {
  const { data, error } = await supabase.from(T as any).insert(p).select().single();
  if (error) throw new Error(error.message);
  return data as unknown as Brand;
}

export async function updateBrand(id: string, p: Partial<Brand>): Promise<void> {
  const { error } = await supabase.from(T as any).update(p).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function archiveBrand(id: string): Promise<void> {
  await updateBrand(id, { status: "archived" });
}

export async function softDeleteBrand(id: string): Promise<void> {
  const { error } = await supabase
    .from(T as any)
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
