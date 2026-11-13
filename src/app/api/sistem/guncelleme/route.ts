import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkUpdate, applyUpdate, isLocal } from "@/lib/self-update";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function manager() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return !!p && ["owner", "manager"].includes(p.role);
}

export async function GET() {
  if (!isLocal) return NextResponse.json({ local: false });
  if (!(await manager())) return NextResponse.json({ local: true, allowed: false });
  return NextResponse.json({ ...(await checkUpdate(true)), allowed: true });
}

export async function POST() {
  if (!isLocal) return NextResponse.json({ ok: false, message: "local only" }, { status: 400 });
  if (!(await manager())) return NextResponse.json({ ok: false, message: "Yetki yok" }, { status: 403 });
  return NextResponse.json(await applyUpdate("panelden"));
}
