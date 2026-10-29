"use client";
import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { useT } from "@/lib/i18n/client";
import type { TFn } from "@/lib/i18n/core";
import { getWaStatus, createSetupCode, sendWaCommand, type WaStatus } from "./actions";

const INSTALL_CMD = "curl -fsSL https://bamboo-crm-tau.vercel.app/wa/install.sh | bash";
const POLL_MS = 3000;

function ago(sec: number, t: TFn) {
  if (sec < 60) return t("{n} sn önce", { n: sec });
  if (sec < 3600) return t("{n} dk önce", { n: Math.floor(sec / 60) });
  if (sec < 86400) return t("{n} sa önce", { n: Math.floor(sec / 3600) });
  return t("{n} gün önce", { n: Math.floor(sec / 86400) });
}

const toSvg = (qr: string | null) =>
  qr ? QRCode.toString(qr, { type: "svg", margin: 1, errorCorrectionLevel: "L" }).catch(() => null) : Promise.resolve(null);

function CopyBtn({ text }: { text: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn ghost sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* yoksay */ }
    }}>{done ? t("Kopyalandı") : t("Kopyala")}</button>
  );
}

export function WaPanel({ initial }: { initial: WaStatus }) {
  const t = useT();
  const [s, setS] = useState<WaStatus>(initial);
  const [svg, setSvg] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // Sayfa açıkken her 3 sn durum sorgula. setState sadece async geri çağrılarda.
  useEffect(() => {
    let alive = true, busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await getWaStatus();
        if (!alive || !r.ok) return;
        const img = await toSvg(r.data.qr);
        if (!alive) return;
        setS(r.data);
        setSvg(img);
      } catch { /* ağ hatası: bir sonraki turda tekrar */ } finally { busy = false; }
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearTimeout(first); clearInterval(id); };
  }, []);

  const newCode = () => {
    if (s.hasToken && !confirm(t("Zaten bir kurulum kodu var. Yeni kod oluşturulursa eski kod çalışmaz ve Mac'teki program yeniden kurulana kadar bağlanamaz. Devam edilsin mi?"))) return;
    setMsg(null);
    start(async () => {
      const r = await createSetupCode();
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else { setCode(r.data.code); setS((x) => ({ ...x, hasToken: true })); }
    });
  };
  const command = (c: "logout" | "restart") => {
    if (c === "logout" && !confirm(t("WhatsApp bağlantısı kesilsin mi? Tekrar bağlamak için yeni QR okutmanız gerekir."))) return;
    setMsg(null);
    start(async () => {
      const r = await sendWaCommand(c);
      if (!r.ok) setMsg({ ok: false, text: r.error });
      else { setMsg({ ok: true, text: t("Komut gönderildi, program bir sonraki sinyalde uygulayacak.") }); setS((x) => ({ ...x, command: c })); }
    });
  };

  let pill: { cls: string; label: string; sub?: string };
  if (!s.online) pill = { cls: "bad", label: t("Bağlantı yok"), sub: s.ageSec === null ? t("Program henüz kurulmadı veya hiç sinyal göndermedi.") : t("Bilgisayar kapalı veya program çalışmıyor.") };
  else if (s.state === "connected") pill = { cls: "good", label: t("Bağlı"), sub: [s.phone, s.pushName].filter(Boolean).join(" · ") };
  else if (s.state === "qr") pill = { cls: "warn", label: t("QR bekleniyor") };
  else if (s.state === "logged_out") pill = { cls: "bad", label: t("Çıkış yapıldı"), sub: t("Yeni QR hazırlanıyor…") };
  else pill = { cls: "warn", label: t("Bağlanıyor…") };

  return (
    <div className="grid gap-4">
      <section className="panel grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`pill ${pill.cls}`}>{pill.label}</span>
          {pill.sub && <span className="text-sm font-semibold">{pill.sub}</span>}
          <span className="text-xs text-muted ml-auto">{t("Son sinyal")}: {s.ageSec === null ? "—" : ago(s.ageSec, t)}</span>
        </div>
        {s.online && s.state === "qr" && (
          <div className="grid sm:grid-cols-[220px_1fr] gap-4 items-center">
            <div className="bg-white rounded-xl p-2 w-[220px] h-[220px]" aria-label="QR">
              {svg ? <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="w-full h-full grid place-items-center text-xs text-muted">{t("QR yükleniyor…")}</div>}
            </div>
            <ol className="list-decimal pl-5 text-sm grid gap-1">
              <li>{t("Telefonda WhatsApp'ı açın.")}</li>
              <li>{t("Ayarlar → Bağlı cihazlar → Cihaz bağla")}</li>
              <li>{t("Telefonu bu ekrandaki QR koduna tutun.")}</li>
              <li className="text-muted">{t("QR birkaç saniyede bir yenilenir; bu sayfa otomatik güncellenir.")}</li>
            </ol>
          </div>
        )}
        {s.error && s.online && s.state !== "connected" && <p className="text-xs text-muted">{t("Son hata")}: {s.error}</p>}
        {(s.host || s.version) && <p className="text-xs text-muted">{[s.host, s.version].filter(Boolean).join(" · ")}</p>}
        {s.command && <p className="pill warn justify-self-start">{t("Komut gönderildi, program bir sonraki sinyalde uygulayacak.")}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn ghost sm" disabled={pending || !s.hasToken} onClick={() => command("logout")}>{t("Bağlantıyı kes (çıkış)")}</button>
          <button className="btn ghost sm" disabled={pending || !s.hasToken} onClick={() => command("restart")}>{t("Programı yeniden başlat")}</button>
        </div>
        {msg && <p className={`pill ${msg.ok ? "good" : "bad"} justify-self-start`}>{msg.text}</p>}
      </section>

      <section className="panel grid gap-3">
        <div>
          <h2 className="font-bold">{t("Salon bilgisayarına kurulum")}</h2>
          <p className="text-xs text-muted">{t("Program salondaki Mac'te arka planda çalışır, bilgisayar açılınca kendiliğinden başlar. Kurulum bir kez yapılır.")}</p>
        </div>
        {s.tokenCreatedAt && !code && <p className="text-xs text-muted">{t("Mevcut kod oluşturulma: {d}", { d: new Date(s.tokenCreatedAt).toLocaleString() })}</p>}
        <button className="btn sm justify-self-start" disabled={pending} onClick={newCode}>{t("Kurulum kodu oluştur")}</button>
        {code && (
          <div className="grid gap-3">
            <p className="pill warn justify-self-start">{t("Bu kod sadece bir kez gösterilir. Kurulum bitene kadar bu sayfayı kapatmayın.")}</p>
            <label className="f">{t("Kurulum kodu")}
              <span className="flex gap-2 items-center"><span className="inp flex-1"><input readOnly value={code} className="font-mono" onFocus={(e) => e.currentTarget.select()} /></span><CopyBtn text={code} /></span>
            </label>
            <label className="f">{t("Kurulum komutu")}
              <span className="flex gap-2 items-center"><span className="inp flex-1"><input readOnly value={INSTALL_CMD} className="font-mono" onFocus={(e) => e.currentTarget.select()} /></span><CopyBtn text={INSTALL_CMD} /></span>
            </label>
            <ol className="list-decimal pl-5 text-sm grid gap-1">
              <li>{t("Salondaki Mac'te Terminal'i açın (Spotlight: ⌘ + Boşluk → \"Terminal\").")}</li>
              <li>{t("Kurulum komutunu yapıştırıp Enter'a basın.")}</li>
              <li>{t("Kod sorulunca yukarıdaki kurulum kodunu yapıştırıp Enter'a basın.")}</li>
              <li>{t("Birkaç saniye sonra bu sayfada QR görünür; telefondan okutun.")}</li>
            </ol>
          </div>
        )}
      </section>

      <section className="panel grid gap-1 border-l-4" style={{ borderLeftColor: "var(--warn)" }}>
        <b className="text-sm">{t("Gönderim kapalı")}</b>
        <p className="text-sm text-muted">{t("Bu bağlantı şu an hiçbir mesaj göndermez. Otomatik bildirimler açılınca DIKIDI'deki bildirimler kapatılmalı.")}</p>
      </section>
    </div>
  );
}
