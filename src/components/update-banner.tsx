"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/client";

type S = { local: boolean; allowed?: boolean; behind?: number; mode?: string; current?: string; error?: string; updating?: boolean; dirty?: boolean };

/** Yalnız iMac'teki (yerel) kopyada görünür: yeni sürüm varsa tek tıkla günceller */
export function UpdateBanner() {
  const t = useT();
  const [s, setS] = useState<S | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/sistem/guncelleme", { cache: "no-store" }).then((r) => r.json()).then((x) => alive && setS(x)).catch(() => {});
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  if (!s?.local || !s.allowed || (!s.behind && !msg)) return null;
  const go = async () => {
    setBusy(true); setMsg(t("Güncelleniyor… lütfen bekleyin."));
    try {
      const r = await (await fetch("/api/sistem/guncelleme", { method: "POST" })).json();
      setMsg(r.message);
      if (r.ok) setTimeout(() => location.reload(), r.restarting ? 15000 : 4000);
      else setBusy(false);
    } catch { setMsg(t("Program yeniden başlıyor…")); setTimeout(() => location.reload(), 15000); }
  };
  return (
    <div role="status" className="print:hidden mb-3 flex items-center gap-3 flex-wrap rounded-xl border border-gold bg-gold-soft px-4 py-2 text-sm">
      <span>⬆ {msg || t("Yeni sürüm hazır ({n} güncelleme).", { n: s.behind ?? 0 })}{s.mode === "prod" && !msg ? ` ${t("Program kısa süre kapanıp açılır.")}` : ""}</span>
      {!msg && <button className="btn sm ml-auto" disabled={busy} onClick={go}>{t("Şimdi güncelle")}</button>}
    </div>
  );
}
