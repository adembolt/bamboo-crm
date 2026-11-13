"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/client";
import { fmtDate, todayIso } from "@/lib/format";
import type { StaffPayScheme } from "@/lib/database.types";
import { StaffPayDialog, schemeSummary } from "@/app/panel/personel/staff-pay";

export function SchemesList({ staff, schemes }: { staff: { id: string; full_name: string; title: string }[]; schemes: StaffPayScheme[] }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState<{ id: string; full_name: string } | null>(null);
  const today = todayIso();
  return (
    <section className="panel grid gap-1">
      {staff.map((s) => {
        const mine = schemes.filter((x) => x.staff_id === s.id);
        const cur = mine.find((x) => x.valid_from <= today);
        const next = mine.filter((x) => x.valid_from > today).at(-1);
        return (
          <div key={s.id} className="grid sm:grid-cols-[200px_minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-center border-b border-dashed border-line py-2">
            <div className="grid"><b className="text-sm">{s.full_name}</b><span className="text-xs text-muted">{s.title}</span></div>
            <div className="text-sm min-w-0">
              {cur ? <><span className="pill text-[10px] mr-1">{fmtDate(cur.valid_from)} →</span>{schemeSummary(cur, t)}</> : <span className="text-warn">{t("Şema yok — eski yüzde kullanılır")}</span>}
              {next && <div className="text-xs text-muted">{t("{date} tarihinden itibaren", { date: fmtDate(next.valid_from) })}: {schemeSummary(next, t)}</div>}
              {mine.length > 1 && <div className="text-[11px] text-muted">{t("{n} şema kaydı", { n: mine.length })}</div>}
            </div>
            <button className="btn ghost sm" onClick={() => setOpen(s)}>{cur ? t("Düzenle") : t("Şema ekle")}</button>
          </div>
        );
      })}
      {open && <StaffPayDialog staffId={open.id} staffName={open.full_name} schemes={schemes.filter((x) => x.staff_id === open.id)} onClose={() => { setOpen(null); router.refresh(); }} />}
    </section>
  );
}
