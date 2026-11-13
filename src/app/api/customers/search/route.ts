import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyCustomerSearch } from "@/lib/customer-search";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json([]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const query = applyCustomerSearch(supabase.from("customers").select("id, first_name, last_name, phone").limit(12), q);
  const { data, error } = await query.order("last_name");
  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data ?? []);
}
