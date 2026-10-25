import { requireSession } from "@/lib/auth";
import { BambooLogo } from "@/components/logo";
import { Nav } from "@/components/nav";
import { logout } from "@/app/login/actions";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const { user, profile } = await requireSession();
  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0">
      <aside className="md:w-56 md:flex-none md:border-r border-line bg-surface md:min-h-screen flex md:flex-col items-center md:items-stretch gap-3 px-3 py-2 md:py-4 border-b md:border-b-0">
        <div className="flex items-center gap-2 md:px-2 md:mb-2">
          <BambooLogo size={36} />
          <div className="leading-tight hidden sm:block">
            <div className="font-display font-bold">Bamboo</div>
            <div className="text-[11px] text-muted">Beauty &amp; Wellness</div>
          </div>
        </div>
        <Nav />
        <form action={logout} className="md:mt-auto md:px-2 ml-auto md:ml-0">
          <div className="hidden md:block text-xs text-muted mb-1 truncate" title={user.email ?? ""}>
            {profile?.full_name || user.email}
          </div>
          <button className="btn ghost sm w-full" type="submit">Çıkış</button>
        </form>
      </aside>
      <main className="flex-1 min-w-0 px-4 py-4 md:px-6 md:py-6">{children}</main>
    </div>
  );
}
