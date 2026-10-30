"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormFiller } from "@/components/forms/form-filler";
import { useT } from "@/lib/i18n/client";
import { brandMessage } from "@/lib/brand-voice";
import type { FormKey, FormData, Signatures } from "@/lib/forms/schemas";
import { updateFormStaff, deleteClientForm, cancelFormLink } from "../actions";

export function waLink(phone: string, text: string) {
  const p = phone.replace(/\D/g, "").replace(/^0/, "90");
  return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

export function ViewForm({ formId, customerId, formKey, status, data, sig, staffName, date, staffNames, canDelete, canEditStaff, link, phone, name }: {
  formId: string; customerId: string; formKey: FormKey; status: string; data: FormData; sig: Signatures; staffName: string; date: string;
  staffNames: string[]; canDelete: boolean; canEditStaff: boolean; link: string | null; phone: string; name: string;
}) {
  const t = useT();
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  if (link) {
    const text = brandMessage("tr", { greet: `Merhaba ${name} 🌸`, body: [`Randevunuzdan önce sizin için kısa bir form hazırladık; birkaç dakikada doldurup telefonunuzdan imzalayabilirsiniz ✨\n${link}`, "Bilgileriniz yalnızca işleminizin güvenli ve size özel planlanması için kullanılır 💚"], ask: "Sorunuz olursa bu mesaja yazmanız yeterli." });
    return (
      <section className="panel grid gap-3">
        <p className="text-sm">{t("Bu form danışanın kendi telefonundan doldurulacak. Bağlantıyı WhatsApp ile gönderin; doldurduğunda burada imzalı olarak görünür.")}</p>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="inp flex-1 min-w-[240px]"><input readOnly value={link} onFocus={(e) => e.target.select()} /></span>
          <button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(link); setMsg(t("Kopyalandı")); }}>{t("Kopyala")}</button>
          {phone && <a className="btn sm" target="_blank" rel="noreferrer" href={waLink(phone, text)}>{t("WhatsApp'ta aç")}</a>}
          <button className="btn ghost sm text-bad" disabled={pending} onClick={() => { if (!confirm(t("Bağlantı iptal edilsin mi?"))) return; start(async () => { const r = await cancelFormLink(formId); if (r.ok) router.push(`/panel/musteriler/${customerId}`); else setMsg(r.error); }); }}>{t("İptal et")}</button>
        </div>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </section>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex gap-2 flex-wrap print:hidden">
        <button className="btn ghost sm" onClick={() => window.print()}>{t("Yazdır / PDF")}</button>
        {canEditStaff && !edit && <button className="btn ghost sm" onClick={() => setEdit(true)}>{t("Salon bölümünü doldur")}</button>}
        {canDelete && <button className="btn ghost sm text-bad ml-auto" disabled={pending} onClick={() => { if (!confirm(t("Bu form kalıcı olarak silinsin mi?"))) return; start(async () => { const r = await deleteClientForm(formId); if (r.ok) router.push(`/panel/musteriler/${customerId}`); else setMsg(r.error); }); }}>{t("Formu sil")}</button>}
      </div>
      {msg && <p className="pill bad">{msg}</p>}
      {status !== "pending" && !edit && <p className="text-xs text-muted print:hidden">{t("Danışan beyanı imzalandıktan sonra değiştirilemez. Değişiklik gerekiyorsa yeni form doldurun.")}</p>}
      <FormFiller key={edit ? "e" : "r"} formKey={formKey} initialData={data} initialSig={sig} initialStaff={staffName} initialDate={date} staffNames={staffNames}
        editable={edit ? "staff" : "none"} submitLabel={t("Salon bölümünü kaydet")}
        footer={edit ? <button type="button" className="btn ghost" onClick={() => setEdit(false)}>{t("Vazgeç")}</button> : undefined}
        onSubmit={edit ? async (p) => { const r = await updateFormStaff({ formId, data: p.data, sig: p.sig, staffName: p.staffName }); if (!r.ok) return r.error; setEdit(false); router.refresh(); return null; } : undefined} />
    </div>
  );
}
