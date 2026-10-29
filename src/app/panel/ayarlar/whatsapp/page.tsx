import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getWaStatus } from "./actions";
import { WaPanel } from "./wa-panel";

export async function generateMetadata() {
  return { title: (await getT())("WhatsApp bağlantısı") };
}

export default async function WhatsAppPage() {
  await requireManager();
  const t = await getT();
  const r = await getWaStatus();
  return (
    <div className="grid gap-4 max-w-2xl">
      <header>
        <Link href="/panel/ayarlar" className="text-sm text-muted">← {t("Ayarlar")}</Link>
        <h1 className="text-xl font-bold">{t("WhatsApp bağlantısı")}</h1>
        <p className="text-sm text-muted">{t("Salon numarasını, salondaki açık kalan Mac üzerinden QR okutarak CRM'e bağlayın (WhatsApp Web gibi).")}</p>
      </header>
      {r.ok ? <WaPanel initial={r.data} /> : <p className="pill bad">{r.error}</p>}
    </div>
  );
}
