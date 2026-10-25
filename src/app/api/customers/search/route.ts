import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json([]);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const digits = q.replace(/\D/g, "");
  const like = `%${q}%`;
  let query = supabase
    .from("customers")
    .select("id, first_name, last_name, phone")
    .limit(12);
  query = digits.length >= 3
    ? query.or(`phone.ilike.%${digits}%,first_name.ilike.${like},last_name.ilike.${like}`)
    : query.or(`first_name.ilike.${like},last_name.ilike.${like}`);
  const { data, error } = await query.order("last_name");
  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data ?? []);
}
