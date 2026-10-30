"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import { fmtDate, fmtTime, todayIso } from "@/lib/format";
import { addCustomerNote, deleteCustomerNote, addCustomerPhoto, deleteCustomerPhoto } from "./extras-actions";

type Note = { id: string; body: string; created_at: string; author: string | null };
export function NotesPanel({ customerId, notes, legacy, canWrite }: { customerId: string; notes: Note[]; legacy: string; canWrite: boolean }) {
  const t = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="panel grid gap-2">
      <h2 className="font-bold">{t("Notlar")}</h2>
      {canWrite && (
        <div className="grid gap-2">
          <textarea className="inp p-2 min-h-[64px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("Yeni not (ör. cilt hassas, sıcak yatak tercih ediyor)")} />
          <button className="btn sm justify-self-start" disabled={pending || !body.trim()} onClick={() => start(async () => { const r = await addCustomerNote(customerId, body); if (r.ok) { setBody(""); router.refresh(); } })}>{t("Not ekle")}</button>
        </div>
      )}
      {notes.map((n) => (
        <div key={n.id} className="border-l-4 border-green/40 pl-3 py-1 grid gap-0.5">
          <p className="text-sm whitespace-pre-line">{n.body}</p>
          <div className="text-[11px] text-muted flex gap-2">{fmtDate(n.created_at)} {fmtTime(n.created_at)}{n.author ? ` · ${n.author}` : ""}{canWrite && <button className="text-bad hover:underline ml-auto" onClick={() => { if (confirm(t("Not silinsin mi?"))) start(async () => { await deleteCustomerNote(n.id, customerId); router.refresh(); }); }}>{t("sil")}</button>}</div>
        </div>
      ))}
      {legacy && <div className="border-l-4 border-line pl-3 py-1"><p className="text-sm whitespace-pre-line text-muted">{legacy}</p><div className="text-[11px] text-muted">{t("Eski not (DIKIDI / kart)")}</div></div>}
      {!notes.length && !legacy && <p className="text-sm text-muted">{t("Henüz not yok.")}</p>}
    </section>
  );
}

type Photo = { id: string; url: string; kind: "before" | "after" | "other"; caption: string; taken_at: string; source: "photo" | "visit" };
const KIND: Record<string, string> = { before: "Öncesi", after: "Sonrası", other: "Fotoğraf" };

/** Öncesi / sonrası galerisi: müşteri fotoğrafları + randevuya yüklenen resimler */
export function PhotoPanel({ customerId, photos, canWrite }: { customerId: string; photos: Photo[]; canWrite: boolean }) {
  const t = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<"before" | "after" | "other">("before");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [big, setBig] = useState<Photo | null>(null);
  const [, start] = useTransition();
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr("");
    const sb = createClient();
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      if (f.size > 15 * 1024 * 1024) { setErr(t("Dosya 15 MB'den büyük olamaz.")); continue; }
      const path = `${customerId}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error } = await sb.storage.from("customer-photos").upload(path, f, { contentType: f.type });
      if (error) { setErr(error.message); continue; }
      const r = await addCustomerPhoto({ customerId, path, kind, caption, takenAt: todayIso() });
      if (!r.ok) setErr(r.error);
    }
    setBusy(false); setCaption(""); if (input.current) input.current.value = ""; router.refresh();
  };
  return (
    <section className="panel grid gap-2">
      <h2 className="font-bold">{t("Fotoğraflar (öncesi / sonrası)")}</h2>
      {canWrite && (
        <div className="flex flex-wrap gap-2 items-end">
          <span className="flex gap-1 bg-sunk p-1 rounded-lg">{(["before", "after", "other"] as const).map((k) => <button key={k} type="button" className={`px-2 py-1 rounded-md text-xs font-semibold ${kind === k ? "bg-surface shadow-card" : "text-muted"}`} onClick={() => setKind(k)}>{t(KIND[k])}</button>)}</span>
          <span className="inp flex-1 min-w-[140px]"><input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t("Açıklama (ör. 3. seans, sol yanak)")} /></span>
          <input ref={input} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => upload(e.target.files)} />
          <button className="btn sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? t("Yükleniyor…") : `📷 ${t("Fotoğraf ekle")}`}</button>
        </div>
      )}
      {err && <p className="pill bad">{err}</p>}
      {!photos.length ? <p className="text-sm text-muted">{t("Henüz fotoğraf yok.")}</p> : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <button key={p.id} type="button" className="relative aspect-square rounded-lg overflow-hidden bg-sunk" onClick={() => setBig(p)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption || t(KIND[p.kind])} className="w-full h-full object-cover" loading="lazy" />
              <span className={`absolute left-1 top-1 pill text-[10px] ${p.kind === "after" ? "good" : p.kind === "before" ? "warn" : ""}`}>{t(KIND[p.kind])}</span>
              <span className="absolute left-0 right-0 bottom-0 text-[10px] text-white bg-black/50 px-1 truncate">{fmtDate(p.taken_at)}{p.caption ? ` · ${p.caption}` : ""}</span>
            </button>
          ))}
        </div>
      )}
      {big && (
        <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" onClick={() => setBig(null)}>
          <div className="grid gap-2 max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={big.url} alt="" className="max-h-[80vh] w-auto mx-auto rounded-lg" />
            <div className="flex items-center gap-2 text-white text-sm">
              <span>{t(KIND[big.kind])} · {fmtDate(big.taken_at)}{big.caption ? ` · ${big.caption}` : ""}</span>
              {canWrite && big.source === "photo" && <button className="btn ghost sm ml-auto" onClick={() => { if (confirm(t("Fotoğraf silinsin mi?"))) { const id = big.id; setBig(null); start(async () => { await deleteCustomerPhoto(id, customerId); router.refresh(); }); } }}>{t("Sil")}</button>}
              <button className="btn ghost sm" onClick={() => setBig(null)}>{t("Kapat")}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
