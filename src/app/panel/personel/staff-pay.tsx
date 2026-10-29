"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/modal";
import { useT } from "@/lib/i18n/client";
import { fmtDate, todayIso } from "@/lib/format";
import type { StaffPayScheme } from "@/lib/database.types";
import { savePayScheme, deletePayScheme, type SchemeInput } from "./actions";

const empty = (staffId: string): SchemeInput => ({
  staffId, validFrom: todayIso(), servicePercent: 0, productPercent: 0, serviceDeductDiscount: true, productDeductDiscount: true, serviceDeductMaterials: false,
  companyServicePercent: 0, companyProductPercent: 0, companyDeductDiscount: true, companyExcludeOwn: false, companyOnlyOnShift: false,
  bookingServicePercent: 0, bookingProductPercent: 0, bookingExcludeOwn: false, dailyWage: 0, dailyGuarantee: 0, notes: "",
});
const fromRow = (s: StaffPayScheme): SchemeInput => ({
  id: s.id, staffId: s.staff_id, validFrom: s.valid_from, servicePercent: Number(s.service_percent), productPercent: Number(s.product_percent),
  serviceDeductDiscount: s.service_deduct_discount, productDeductDiscount: s.product_deduct_discount, serviceDeductMaterials: s.service_deduct_materials,
  companyServicePercent: Number(s.company_service_percent), companyProductPercent: Number(s.company_product_percent), companyDeductDiscount: s.company_deduct_discount,
  companyExcludeOwn: s.company_exclude_own, companyOnlyOnShift: s.company_only_on_shift, bookingServicePercent: Number(s.booking_service_percent),
  bookingProductPercent: Number(s.booking_product_percent), bookingExcludeOwn: s.booking_exclude_own, dailyWage: Number(s.daily_wage), dailyGuarantee: Number(s.daily_guarantee), notes: s.notes,
});

/** Kısa özet: "%35 hizmet · %10 ürün · şirket %2 · randevu %2 · 500 ₺/gün" */
export function schemeSummary(s: StaffPayScheme, t: (k: string, v?: Record<string, string | number>) => string) {
  const p: string[] = [];
  if (Number(s.service_percent)) p.push(t("%{n} hizmet", { n: Number(s.service_percent) }));
  if (Number(s.product_percent)) p.push(t("%{n} ürün", { n: Number(s.product_percent) }));
  if (Number(s.company_service_percent) || Number(s.company_product_percent)) p.push(t("şirket %{n}", { n: Number(s.company_service_percent) }));
  if (Number(s.booking_service_percent) || Number(s.booking_product_percent)) p.push(t("randevu primi %{n}", { n: Number(s.booking_service_percent) }));
  if (Number(s.daily_wage)) p.push(t("{n} ₺/gün", { n: Number(s.daily_wage) }));
  if (Number(s.daily_guarantee)) p.push(t("garanti {n} ₺/gün", { n: Number(s.daily_guarantee) }));
  return p.join(" · ") || "—";
}

export function StaffPayDialog({ staffId, staffName, schemes, onClose }: { staffId: string; staffName: string; schemes: StaffPayScheme[]; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const [f, setF] = useState<SchemeInput | null>(schemes.length ? null : empty(staffId));
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const set = <K extends keyof SchemeInput>(k: K, v: SchemeInput[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const N = (k: keyof SchemeInput, label: string, suffix = "%") => (
    <label className="f">{label}<span className="inp"><input key={k} type="number" step="0.5" min="0" value={Number(f?.[k] ?? 0)} onChange={(e) => set(k, Number(e.target.value) as never)} /><span className="text-muted text-xs">{suffix}</span></span></label>
  );
  const C = (k: keyof SchemeInput, label: string) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f?.[k]} onChange={(e) => set(k, e.target.checked as never)} />{label}</label>
  );
  const save = () => { if (!f) return; setErr(""); start(async () => { const r = await savePayScheme(f); if (!r.ok) setErr(r.error); else { setF(null); router.refresh(); } }); };
  const del = (id: string) => { if (!confirm(t("Bu maaş şeması silinsin mi?"))) return; start(async () => { const r = await deletePayScheme(id); if (!r.ok) setErr(r.error); else router.refresh(); }); };

  return (
    <Modal title={`${t("Maaş şeması")} · ${staffName}`} onClose={onClose} wide>
      <div className="grid gap-3">
        <p className="text-xs text-muted">{t("Birden çok şema eklenebilir; her gün için o tarihte geçerli olan en son şema kullanılır. Hak ediş Kasa → Ay özeti'nde hesaplanır.")}</p>
        {schemes.map((s) => (
          <div key={s.id} className="flex items-center gap-2 flex-wrap border-b border-dashed border-line pb-2">
            <span className="pill">{fmtDate(s.valid_from)} →</span>
            <span className="text-sm">{schemeSummary(s, t)}</span>
            {s.dikidi_id && <span className="pill text-[10px]">DIKIDI</span>}
            <button className="btn ghost sm ml-auto" onClick={() => setF(fromRow(s))}>{t("Düzenle")}</button>
            <button className="btn ghost sm text-bad" disabled={pending} onClick={() => del(s.id)}>{t("Sil")}</button>
          </div>
        ))}
        {!f && <button className="btn ghost sm justify-self-start" onClick={() => setF(empty(staffId))}>+ {t("Yeni şema")}</button>}
        {f && (
          <div className="grid gap-3">
            <label className="f max-w-[220px]">{t("Geçerlilik başlangıcı")}<span className="inp"><input type="date" value={f.validFrom} onChange={(e) => set("validFrom", e.target.value)} /></span></label>
            <fieldset className="grid gap-2 border border-line rounded-xl p-3">
              <legend className="text-sm font-bold px-1">{t("Kendi satışları")}</legend>
              <div className="grid grid-cols-2 gap-2">{N("servicePercent", t("Hizmet"))}{N("productPercent", t("Ürün"))}</div>
              {C("serviceDeductDiscount", t("Hizmette indirim düşülmüş tutardan"))}
              {C("productDeductDiscount", t("Üründe indirim düşülmüş tutardan"))}
              {C("serviceDeductMaterials", t("Malzeme maliyeti düşülsün"))}
            </fieldset>
            <fieldset className="grid gap-2 border border-line rounded-xl p-3">
              <legend className="text-sm font-bold px-1">{t("Şirket satışları")}</legend>
              <div className="grid grid-cols-2 gap-2">{N("companyServicePercent", t("Hizmet"))}{N("companyProductPercent", t("Ürün"))}</div>
              {C("companyDeductDiscount", t("İndirim düşülmüş tutardan"))}
              {C("companyExcludeOwn", t("Kendi satışları hariç"))}
              {C("companyOnlyOnShift", t("Sadece çalıştığı günler"))}
            </fieldset>
            <fieldset className="grid gap-2 border border-line rounded-xl p-3">
              <legend className="text-sm font-bold px-1">{t("Randevu primi (oluşturduğu randevulardan)")}</legend>
              <div className="grid grid-cols-2 gap-2">{N("bookingServicePercent", t("Hizmet"))}{N("bookingProductPercent", t("Ürün"))}</div>
              {C("bookingExcludeOwn", t("Kendi yaptığı hizmetler hariç"))}
            </fieldset>
            <fieldset className="grid gap-2 border border-line rounded-xl p-3">
              <legend className="text-sm font-bold px-1">{t("Sabit")}</legend>
              <div className="grid grid-cols-2 gap-2">{N("dailyWage", t("Çalıştığı gün başına"), "₺")}{N("dailyGuarantee", t("Günlük garanti (asgari)"), "₺")}</div>
            </fieldset>
            <label className="f">{t("Not")}<span className="inp"><input value={f.notes} onChange={(e) => set("notes", e.target.value)} /></span></label>
            <div className="flex gap-2">
              <button className="btn" disabled={pending} onClick={save}>{t("Kaydet")}</button>
              <button className="btn ghost" disabled={pending} onClick={() => setF(null)}>{t("Vazgeç")}</button>
            </div>
          </div>
        )}
        {err && <p className="pill bad">{err}</p>}
      </div>
    </Modal>
  );
}
