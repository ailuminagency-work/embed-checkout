import { supabase } from "@/integrations/supabase/client";

export async function fetchCatalog(activeOnly = true) {
  let query = supabase
    .from("catalog_items")
    .select("*")
    .order("sort_order", { ascending: true });
  if (activeOnly) query = query.eq("active", true);
  return query;
}

export async function updateCatalogItem(
  id: string,
  data: { price?: number; active?: boolean; name?: string; category?: string }
) {
  return supabase.from("catalog_items").update(data).eq("id", id);
}

export async function deleteCatalogItem(id: string) {
  return supabase.from("catalog_items").delete().eq("id", id);
}
