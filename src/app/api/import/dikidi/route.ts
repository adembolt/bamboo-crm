import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { localToIso, normalizePhone, todayIso } from "@/lib/format";

/* DIKIDI randevu defteri (journal export) aktarımı.
   Tarayıcıda DIKIDI sekmesinden çağrılır; settings.import_token ile korunur.
   Aynı import_ref ile tekrar çalıştırıldığında satışa bağlanmamış eski aktarım silinip yeniden yazılır. */

type Row = { date: string; staff: string; start: string; end: string; price: number | null; name: string; phone: string; services: string[] };

const ORIGIN = "https://beauty.dikidi.net";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-import-token",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });

export async function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }

const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim();
const digits = (s: string) => s.replace(/\D/g, "");

export async function POST(req: NextRequest) {
  const db = createAdminClient();
  const token = req.headers.get("x-import-token") ?? "";
  const { data: st } = await db.from("settings").select("import_token").eq("id", 1).single();
  if (!st?.import_token || token.length < 16 || token !== st.import_token) return json({ error: "unauthorized" }, 401);

  let body: { ref?: string; rows?: Row[]; dryRun?: boolean };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const ref = String(body.ref ?? "dikidi-journal").slice(0, 60);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return json({ error: "empty" }, 422);

  const [{ data: staff }, { data: services }, { data: customers }] = await Promise.all([
    db.from("staff").select("id, full_name"),
    db.from("services").select("id, code, name_tr, price, duration_min"),
    db.from("customers").select("id, phone, first_name, last_name"),
  ]);
  const staffByName = new Map((staff ?? []).map((s) => [norm(s.full_name), s.id]));
  const svcByCode = new Map((services ?? []).filter((s) => s.code).map((s) => [s.code as string, s]));
  const custByPhone = new Map<string, string>();
  for (const c of customers ?? []) { const d = digits(c.phone); if (d) custByPhone.set(d, c.id); }

  const today = todayIso();
  const report = { rows: rows.length, skipped: 0, visits: 0, items: 0, newCustomers: 0, unmatchedServices: new Map<string, number>(), unmatchedStaff: new Set<string>(), overlapDropped: 0, errors: [] as string[] };

  if (!body.dryRun) {
    // Önceki aktarımı temizle (satışa bağlanmamış olanlar)
    const { data: old } = await db.from("visits").select("id, sale:sales(id)").eq("import_ref", ref);
    const ids = (old ?? []).filter((v) => !(Array.isArray(v.sale) ? v.sale.length : v.sale)).map((v) => v.id);
    for (let i = 0; i < ids.length; i += 200) await db.from("visits").delete().in("id", ids.slice(i, i + 200));
  }

  // Müşteri+gün bazında grupla (tek ziyaret, birden çok kalem)
  type Parsed = { row: Row; isoDate: string; phoneD: string; customerId: string | null; staffId: string | null; items: { service_id: string | null; service_name: string; starts: string; ends: string; price: number }[]; notes: string[] };
  const groups = new Map<string, Parsed[]>();

  for (const r of rows) {
    const m = String(r.date).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m || !/^\d{2}:\d{2}$/.test(r.start) || !/^\d{2}:\d{2}$/.test(r.end)) { report.skipped++; continue; }
    const isoDate = `${m[3]}-${m[2]}-${m[1]}`;
    const phoneD = digits(r.phone ?? "");
    const svcLines = (r.services ?? []).map((s) => String(s).trim()).filter(Boolean);
    // Hizmet satırı: "5313 Waxing..., 5321 Waxing..." ; diğer satırlar not
    const svcParts: string[] = []; const notes: string[] = [];
    for (const line of svcLines) { if (/^\d{4}\s/.test(line)) svcParts.push(...line.split(/,\s*(?=\d{4}\s)/)); else notes.push(line); }
    if (!phoneD && r.price == null && !svcParts.length) { report.skipped++; continue; } // kişisel not / blok

    const staffId = staffByName.get(norm(r.staff ?? "")) ?? null;
    if (!staffId && r.staff) report.unmatchedStaff.add(r.staff);

    const startMin = +r.start.slice(0, 2) * 60 + +r.start.slice(3), endMin0 = +r.end.slice(0, 2) * 60 + +r.end.slice(3);
    const endMin = endMin0 > startMin ? endMin0 : startMin + 60;
    // Kodu hizmet listesinde olmayan parçalar (ör. "1490 borç") nota düşer
    const matched = svcParts.flatMap((p) => { const code = p.slice(0, 4); const s = svcByCode.get(code); if (!s) { report.unmatchedServices.set(p.slice(0, 60), (report.unmatchedServices.get(p.slice(0, 60)) ?? 0) + 1); notes.push(p); return []; } return [{ code, s, label: p }]; });
    const total = r.price ?? matched.reduce((a, x) => a + Number(x.s?.price ?? 0), 0);
    const items: Parsed["items"] = [];
    if (!matched.length) {
      items.push({ service_id: null, service_name: (phoneD ? "DIKIDI randevu" : r.name || "DIKIDI randevu").slice(0, 160), starts: localToIso(isoDate, r.start), ends: localToIso(isoDate, hhmmOf(endMin)), price: total });
    } else {
      const durs = matched.map((x) => Math.max(5, Number(x.s?.duration_min ?? 30)));
      const dsum = durs.reduce((a, b) => a + b, 0);
      const listSum = matched.reduce((a, x) => a + Number(x.s?.price ?? 0), 0);
      let cur = startMin; let acc = 0;
      matched.forEach((x, i) => {
        const span = i === matched.length - 1 ? endMin - cur : Math.max(5, Math.round(((endMin - startMin) * durs[i]) / dsum));
        const share = i === matched.length - 1 ? total - acc : listSum > 0 ? Math.round((total * Number(x.s?.price ?? 0)) / listSum) : Math.round(total / matched.length);
        acc += share;
        items.push({ service_id: x.s?.id ?? null, service_name: (x.s?.name_tr ?? x.label).slice(0, 160), starts: localToIso(isoDate, hhmmOf(cur)), ends: localToIso(isoDate, hhmmOf(cur + Math.max(5, span))), price: share });
        cur += Math.max(5, span);
      });
    }
    const key = phoneD ? `${phoneD}|${isoDate}` : `anon|${isoDate}|${r.start}|${r.staff}|${r.name}`;
    const p: Parsed = { row: r, isoDate, phoneD, customerId: phoneD ? custByPhone.get(phoneD) ?? null : null, staffId, items, notes };
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  if (body.dryRun) return json(summary(report, groups.size));

  for (const [, parts] of groups) {
    const first = parts[0];
    let customerId = first.customerId;
    if (!customerId && first.phoneD) {
      const [last, ...rest] = String(first.row.name ?? "").trim().split(/\s+/);
      const { data: c, error } = await db.from("customers").insert({ first_name: rest.join(" ") || last || "Müşteri", last_name: rest.length ? last : "", phone: normalizePhone(first.phoneD), source: "dikidi" }).select("id").single();
      if (error) { report.errors.push(`müşteri ${first.phoneD}: ${error.message}`); continue; }
      customerId = c.id; custByPhone.set(first.phoneD, c.id); report.newCustomers++;
    }
    const status = first.isoDate < today ? "completed" : "confirmed";
    const notes = [...new Set(parts.flatMap((p) => p.notes))].join(" · ").slice(0, 500);
    // Aynı müşteri+gün için mevcut (aktarım dışı) ziyaret varsa ona ekle
    let visitId: string | null = null;
    if (customerId) {
      const { data: ex } = await db.from("visits").select("id").eq("customer_id", customerId).eq("visit_date", first.isoDate).neq("status", "cancelled").maybeSingle();
      visitId = ex?.id ?? null;
    }
    if (!visitId) {
      const { data: v, error } = await db.from("visits").insert({ customer_id: customerId, visit_date: first.isoDate, status, source: "dikidi", notes, import_ref: ref }).select("id").single();
      if (error || !v) { report.errors.push(`ziyaret ${first.isoDate} ${first.row.name}: ${error?.message}`); continue; }
      visitId = v.id; report.visits++;
    }
    for (const p of parts) for (const it of p.items) {
      const base = { visit_id: visitId, service_id: it.service_id, service_name: it.service_name, starts_at: it.starts, ends_at: it.ends, price: it.price, status, notes: p.staffId ? "" : `DIKIDI personel: ${p.row.staff ?? ""}` } as const;
      let { error } = await db.from("visit_items").insert({ ...base, staff_id: p.staffId });
      if (error && /overlap|exclusion|23P01/i.test(error.message + error.code)) {
        report.overlapDropped++;
        ({ error } = await db.from("visit_items").insert({ ...base, staff_id: null, notes: `DIKIDI personel: ${p.row.staff ?? ""} (çakışma nedeniyle atanmadı)` }));
      }
      if (error) report.errors.push(`kalem ${first.isoDate} ${it.service_name}: ${error.message}`); else report.items++;
    }
  }
  return json(summary(report, groups.size));
}

function hhmmOf(min: number) { return `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`; }
function summary(r: { rows: number; skipped: number; visits: number; items: number; newCustomers: number; unmatchedServices: Map<string, number>; unmatchedStaff: Set<string>; overlapDropped: number; errors: string[] }, groups: number) {
  return { rows: r.rows, skipped: r.skipped, groups, visits: r.visits, items: r.items, newCustomers: r.newCustomers, overlapDropped: r.overlapDropped, unmatchedStaff: [...r.unmatchedStaff], unmatchedServices: [...r.unmatchedServices.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40), errors: r.errors.slice(0, 40), errorCount: r.errors.length };
}
