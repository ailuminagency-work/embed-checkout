import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data, error } = await supabase
      .from("catalog_items")
      .select("id, name, category, price, image_url")
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    // Map to CatalogItem shape expected by frontend
    const catalog = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      price: Number(row.price),
      imageUrl: row.image_url ?? undefined,
    }));

    return new Response(JSON.stringify(catalog), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
