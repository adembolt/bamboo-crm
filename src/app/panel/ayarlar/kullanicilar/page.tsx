import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { UsersUI, type UserRow } from "./users-ui";

export async function generateMetadata() { return { title: (await getT())("Kullanıcılar ve yetkiler") }; }

export default async function UsersPage() {
  const { profile, user } = await requireManager();
  const t = await getT();
  const admin = createAdminClient();
  const [{ data: profs }, { data: staff }, list] = await Promise.all([
    admin.from("profiles").select("id, full_name, role, staff_id, locale, created_at").order("created_at"),
    admin.from("staff").select("id, full_name").eq("is_active", true).order("sort_order"),
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);
  const authBy = new Map((list.data?.users ?? []).map((u) => [u.id, u]));
  const rows: UserRow[] = (profs ?? []).map((p) => {
    const u = authBy.get(p.id);
    return { id: p.id, name: p.full_name, role: p.role, staffId: p.staff_id, email: u?.email ?? "", lastSignIn: u?.last_sign_in_at ?? null, invited: !!u?.invited_at && !u?.last_sign_in_at, blocked: !!(u?.banned_until && new Date(u.banned_until) > new Date()), me: p.id === user.id };
  });
  return (
    <div className="grid gap-4 max-w-3xl">
      <header>
        <Link href="/panel/ayarlar" className="text-sm text-muted">← {t("Ayarlar")}</Link>
        <h1 className="text-xl font-bold">{t("Kullanıcılar ve yetkiler")}</h1>
        <p className="text-sm text-muted">{t("Her çalışan kendi e-postası ve şifresiyle girer. Davet edilen kişiye e-posta gider; bağlantıdan şifresini belirler.")}</p>
      </header>
      <UsersUI rows={rows} staff={staff ?? []} isOwner={profile?.role === "owner"} />
    </div>
  );
}
