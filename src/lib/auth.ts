import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";

export const getSession = cache(async () => {
  const supabase = await createClient();
  // getClaims: imzalı JWT yerelde doğrulanır → her sayfada Auth sunucusuna ayrıca gidilmez
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  if (!c?.sub) return null;
  const user = { id: c.sub, email: (c.email as string | undefined) ?? null };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { user, profile: (profile as Profile | null) ?? null, supabase };
});

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireOps() {
  const s = await requireSession();
  const role = s.profile?.role;
  if (!role || !["owner", "manager", "reception"].includes(role)) {
    throw new Error("Bu işlem için yetkiniz yok.");
  }
  return s;
}

export async function requireManager() {
  const s = await requireSession();
  const role = s.profile?.role;
  if (!role || !["owner", "manager"].includes(role)) {
    throw new Error("Bu işlem için yönetici yetkisi gerekir.");
  }
  return s;
}
