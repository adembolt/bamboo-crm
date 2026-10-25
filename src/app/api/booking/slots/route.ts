import type { NextRequest } from "next/server";
import { getSlots } from "@/lib/booking/availability";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const serviceId = sp.get("service") ?? "";
  const staffId = sp.get("staff") || null;
  const date = sp.get("date") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ slots: [] }, { status: 400 });
  const r = await getSlots({ serviceId, staffId, date });
  return Response.json(r, { headers: { "Cache-Control": "no-store" } });
}
