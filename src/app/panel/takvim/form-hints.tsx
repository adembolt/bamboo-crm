"use client";
import { useT } from "@/lib/i18n/client";
import { FORMS, formForService, type FormKey } from "@/lib/forms/schemas";
import { addDays, todayIso } from "@/lib/format";

type F = { id: string; key: string; date: string; status: string; visitId: string | null };

/** Randevu penceresinde: sağlık uyarıları + bu hizmetler için eksik kabul / onam formu */
export function FormHints({ customerId, visitId, flags, forms, services }: { customerId: string; visitId: string; flags: string[]; forms: F[]; services: string[] }) {
  const t = useT();
  const yearAgo = addDays(todayIso(), -365);
  const signed = (k: string) => forms.some((f) => f.key === k && f.status !== "pending" && f.date >= yearAgo);
  const need = new Set<FormKey>();
  if (!forms.some((f) => f.key === "intake" && f.status !== "pending")) need.add("intake");
  for (const s of services) { const k = formForService(s); if (k && !signed(k)) need.add(k); }
  const pending = forms.filter((f) => f.status === "pending");
  const thisVisit = forms.filter((f) => f.visitId === visitId && f.status !== "pending");
  if (!flags.length && !need.size && !pending.length && !thisVisit.length) return null;
  return (
    <div className="grid gap-1.5 text-xs">
      {flags.length > 0 && <div className="flex flex-wrap gap-1">{flags.map((f) => <span key={f} className="pill warn">⚠ {f}</span>)}</div>}
      <div className="flex flex-wrap gap-1.5 items-center">
        {[...need].map((k) => (
          <a key={k} target="_blank" rel="noreferrer" href={`/panel/musteriler/${customerId}/formlar/yeni?tur=${k}&ziyaret=${visitId}`} className="rounded-lg border border-warn bg-warn-bg px-2 py-1 font-semibold hover:underline">
            {t("{f} eksik — doldur", { f: t(FORMS[k].short) })}
          </a>
        ))}
        {pending.map((f) => <span key={f.id} className="pill">{t("{f}: danışan bekleniyor", { f: t(FORMS[f.key as FormKey]?.short ?? f.key) })}</span>)}
        {thisVisit.map((f) => <a key={f.id} target="_blank" rel="noreferrer" href={`/panel/musteriler/${customerId}/formlar/${f.id}`} className="pill good hover:underline">✓ {t(FORMS[f.key as FormKey]?.short ?? f.key)}</a>)}
      </div>
    </div>
  );
}
