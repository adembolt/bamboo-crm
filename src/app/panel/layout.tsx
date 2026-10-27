import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { BambooLogo } from "@/components/logo";
import { Nav } from "@/components/nav";
import { logout } from "@/app/login/actions";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const { user, profile } = await requireSession();
  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0">
      <aside className="md:w-44 md:flex-none md:border-r border-line bg-surface md:min-h-screen flex md:flex-col items-center md:items-stretch gap-3 px-3 py-2 md:py-4 border-b md:border-b-0">
        <Link href="/panel/takvim" className="flex items-center gap-2 md:px-2 md:mb-2 rounded-lg hover:bg-sunk" title="Takvime dön" aria-label="Bamboo Beauty & Wellness — takvime dön">
          <BambooLogo size={36} />
          <div className="leading-tight hidden sm:block">
            <div className="font-display font-bold">Bamboo</div>
            <div className="text-[11px] text-muted">Beauty &amp; Wellness</div>
          </div>
        </Link>
        <Nav />
        <form action={logout} className="md:mt-auto md:px-2 ml-auto md:ml-0">
          <div className="hidden md:block text-xs text-muted mb-1 truncate" title={user.email ?? ""}>
            {profile?.full_name || user.email}
          </div>
          <a href="/sifre-yenile" className="hidden md:block text-[11px] text-muted hover:underline mb-1">Şifre değiştir</a>
          <button className="btn ghost sm w-full" type="submit">Çıkış</button>
        </form>
      </aside>
      <main className="flex-1 min-w-0 px-3 py-3 md:px-4 md:py-4">{children}</main>
    </div>
  );
}
