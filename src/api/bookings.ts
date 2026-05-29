import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type BookingInsert = Database["public"]["Tables"]["bookings"]["Insert"];

export interface FetchBookingsOptions {
  page?: number;
  pageSize?: number;
  filter?: "all" | "junk_removal" | "donation_pickup";
  search?: string;
}

export async function fetchBookings(opts: FetchBookingsOptions = {}) {
  const { page = 0, pageSize = 50, filter = "all", search } = opts;

  let query = supabase
    .from("bookings")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (filter !== "all") query = query.eq("service_type", filter);

  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%,reference.ilike.%${search}%,customer_zip.ilike.%${search}%`
    );
  }

  return query;
}

export async function getBooking(id: string) {
  return supabase.from("bookings").select("*").eq("id", id).single();
}

export async function createBooking(data: BookingInsert, retries = 3): Promise<{ id: string; reference: string } | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const { data: row, error } = await supabase
      .from("bookings")
      .insert(data)
      .select("id, reference")
      .single();

    if (!error && row) return row;

    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, attempt * 500));
    } else {
      console.error("[API:bookings] createBooking failed after retries:", error?.message);
    }
  }
  return null;
}

export async function cancelBooking(id: string) {
  return supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id);
}

export async function replayWebhook(bookingId: string) {
  return supabase.functions.invoke("v1", {
    body: { _path: `/bookings/${bookingId}/webhook`, _method: "POST" },
  });
}
