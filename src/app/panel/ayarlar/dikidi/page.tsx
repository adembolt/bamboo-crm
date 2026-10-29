import Link from "next/link";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { fmtDate, fmtTime } from "@/lib/format";
import { Bookmarklet } from "./bookmarklet";

export async function generateMetadata() { return { title: (await getT())("DIKIDI eşitleme") }; }

type StepReport = { summary?: string; error?: string };

export default async function DikidiSyncPage() {
  const { supabase } = await requireManager();
  const t = await getT();
  const admin = createAdminClient();
  const [{ data: st }, { data: runs }] = await Promise.all([
    admin.from("settings").select("import_token").eq("id", 1).single(),
    supabase.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(15),
  ]);
  const token = st?.import_token ?? "";
  const last = runs?.[0];
  return (
    <div className="grid gap-4 max-w-3xl">
      <header>
        <Link href="/panel/ayarlar" className="text-sm text-muted">← {t("Ayarlar")}</Link>
        <h1 className="text-xl font-bold">{t("DIKIDI eşitleme")}</h1>
        <p className="text-sm text-muted">{t("DIKIDI'ye girilen randevular, satışlar, müşteriler, çalışma takvimi, yorumlar ve maaş şemaları tek tıkla buraya aktarılır. DIKIDI'de hiçbir şey değiştirilmez.")}</p>
      </header>

      <section className="panel grid gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <b>{t("Son eşitleme")}:</b>
          {last ? <span className={`pill ${last.ok ? "good" : "bad"}`}>{fmtDate(last.started_at)} {fmtTime(last.started_at)}{last.ok ? "" : ` · ${t("hata")}`}</span> : <span className="pill warn">{t("henüz yok")}</span>}
        </div>
        {token.length >= 16 ? <Bookmarklet token={token} /> : <p className="pill bad">{t("Eşitleme anahtarı tanımlı değil.")}</p>}
        <ol className="list-decimal pl-5 text-sm grid gap-1">
          <li>{t("Yukarıdaki yeşil düğmeyi fareyle tutup tarayıcının yer imleri çubuğuna sürükleyin (bir kez yapılır).")}</li>
          <li>{t("Her akşam DIKIDI panelini açın (herhangi bir sayfası) ve yer imleri çubuğundaki \"Bamboo'ya aktar\" düğmesine tıklayın.")}</li>
          <li>{t("Sağ altta ilerleme görünür; 1-2 dakikada biter. Bitince bu sayfada sonucu görürsünüz.")}</li>
        </ol>
        <p className="text-xs text-muted">{t("Günlük eşitleme: son 3 günden önümüzdeki 60 güne randevular, son 7 günün satışları ve ödemeleri, tüm müşteriler, 3 aylık çalışma takvimi. Aynı gün birden çok kez çalıştırmak güvenlidir; kayıtlar çoğalmaz.")}</p>
      </section>

      <section className="panel grid gap-2">
        <h2 className="font-bold">{t("Geçmiş")}</h2>
        {!runs?.length && <p className="text-sm text-muted">{t("Henüz eşitleme yapılmadı.")}</p>}
        {(runs ?? []).map((r) => {
          const rep = (r.report ?? {}) as Record<string, StepReport>;
          return (
            <details key={r.id} className="border-b border-dashed border-line py-1">
              <summary className="cursor-pointer text-sm flex gap-2 items-center flex-wrap">
                <span className={`pill ${r.ok ? "good" : r.finished_at ? "bad" : "warn"}`}>{r.ok ? t("tamam") : r.finished_at ? t("hata") : t("yarım kaldı")}</span>
                <span className="num">{fmtDate(r.started_at)} {fmtTime(r.started_at)}</span>
                <span className="text-muted text-xs">{r.range_from} → {r.range_to}</span>
              </summary>
              <ul className="text-xs grid gap-0.5 pl-4 py-1">
                {Object.entries(rep).map(([k, v]) => <li key={k}><b>{t(k)}</b>: {v?.error ? <span className="text-bad">{v.error}</span> : v?.summary ?? "✓"}</li>)}
              </ul>
            </details>
          );
        })}
      </section>
    </div>
  );
}
