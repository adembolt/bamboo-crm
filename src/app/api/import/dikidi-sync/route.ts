import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { localToIso, normalizePhone } from "@/lib/format";
import type { PayMethod, VisitStatus } from "@/lib/database.types";

/* Günlük DIKIDI eşitlemesi. DIKIDI sekmesinde çalışan /dikidi-sync.js çağırır (settings.import_token).
   Her kayıt DIKIDI kimliğiyle tutulur; aynı aralık tekrar gönderilirse günceller, çoğaltmaz. */

export const maxDuration = 60;

const ORIGINS = ["https://dikidi.net", "https://beauty.dikidi.net"];
const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-import-token",
  Vary: "Origin",
});
export async function OPTIONS(req: NextRequest) { return new Response(null, { status: 204, headers: corsFor(req.headers.get("origin")) }); }

const norm = (s: string) => String(s ?? "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9а-яё]+/gi, " ").trim();
const digits = (s: string) => String(s ?? "").replace(/\D/g, "");
const sortedName = (s: string) => norm(s).split(" ").filter(Boolean).sort().join(" ");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const addDaysIso = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const hm = (s: string) => String(s ?? "").slice(0, 5);
const plusMin = (iso: string, m: number) => new Date(new Date(iso).getTime() + m * 60000).toISOString();

type Appt = {
  id: string; date: string; time: string; time_to: string; status_id: string; client_came_id: string | null; is_deleted: string;
  master_id: string; client_phone: string; client_first_name: string; client_last_name: string; comment: string; is_online: string;
  added_name: string; document_id: string; services: { id: string; title: string; cost: string; time: string }[];
};
type SaleRow = { id: string; date: string; time: string; name: string; phone: string; amount: number; lines: { master: string | null; name: string; disc: number; income: number; mat: number; salary: number }[] };
type CashRow = { id: string; doc: string; sum: "debt" | "cred"; acc: string; who: string; type: string; amt: string; note: string; dt: string };

export async function POST(req: NextRequest) {
  const cors = corsFor(req.headers.get("origin"));
  const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });
  const db = createAdminClient();
  const token = req.headers.get("x-import-token") ?? "";
  const { data: st } = await db.from("settings").select("import_token").eq("id", 1).single();
  if (!st?.import_token || token.length < 16 || token !== st.import_token) return json({ error: "unauthorized" }, 401);

  let body: { kind?: string; data?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const data = body.data ?? {};

  /* ---------- ortak sözlükler ---------- */
  const { data: staff } = await db.from("staff").select("id, full_name, dikidi_master_id");
  const staffByMaster = new Map((staff ?? []).filter((s) => s.dikidi_master_id).map((s) => [String(s.dikidi_master_id), s.id]));
  const staffByName = new Map((staff ?? []).map((s) => [sortedName(s.full_name), s.id]));
  const findStaff = (name: string | null | undefined) => {
    if (!name) return null;
    const k = sortedName(name);
    if (staffByName.has(k)) return staffByName.get(k)!;
    for (const [n, id] of staffByName) { const a = n.split(" "), b = k.split(" "); if (a.length && b.length && (a.every((x) => b.includes(x)) || b.every((x) => a.includes(x)))) return id; }
    return null;
  };
  // DIKIDI kullanıcı adı → personel (ör. "Tatiana Eskova" = Seler Tati)
  const USER_ALIASES: Record<string, string> = { "tatiana eskova": "seler tati", "татьяна еськова": "seler tati", "тати селер": "seler tati" };
  const findAuthor = (name: string) => findStaff(USER_ALIASES[norm(name)] ?? name);

  const loadCustomers = async () => {
    const all: { id: string; phone: string; first_name: string; last_name: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: c } = await db.from("customers").select("id, phone, first_name, last_name").range(from, from + 999);
      all.push(...(c ?? [])); if (!c || c.length < 1000) break;
    }
    const byPhone = new Map<string, string>(); const byName = new Map<string, string>();
    for (const c of all) { const d = digits(c.phone); if (d) byPhone.set(d, c.id); const k = sortedName(`${c.first_name} ${c.last_name}`); if (k && !byName.has(k)) byName.set(k, c.id); }
    return { byPhone, byName };
  };

  /* ================= senkron kaydı ================= */
  if (body.kind === "run") {
    if (data.action === "start") {
      const { data: r } = await db.from("sync_runs").insert({ source: "dikidi", range_from: (data.from as string) ?? null, range_to: (data.to as string) ?? null }).select("id").single();
      return json({ ok: true, id: r?.id });
    }
    if (data.action === "finish" && typeof data.id === "string") {
      await db.from("sync_runs").update({ finished_at: new Date().toISOString(), report: (data.report as Record<string, unknown>) ?? {}, ok: data.ok !== false }).eq("id", data.id);
      return json({ ok: true });
    }
    return json({ error: "bad_payload" }, 422);
  }

  /* ================= randevular ================= */
  if (body.kind === "appointments") {
    const from = String(data.from ?? ""), to = String(data.to ?? "");
    const rows = (Array.isArray(data.rows) ? data.rows : []) as Appt[];
    if (!ISO.test(from) || !ISO.test(to)) return json({ error: "bad_range" }, 422);
    const report = { appts: rows.length, created: 0, updated: 0, moved: 0, cancelled: 0, legacyLinked: 0, legacyCancelled: 0, newCustomers: 0, overlap: 0, unmatchedServices: [] as string[], errors: [] as string[] };

    const { data: services } = await db.from("services").select("id, code, name_tr, dikidi_id");
    const svcByName = new Map<string, string>(); const svcByCode = new Map<string, string>();
    for (const s of services ?? []) { if (s.dikidi_id) svcByName.set(norm(s.dikidi_id), s.id); svcByName.set(norm(s.name_tr), s.id); if (s.code) svcByCode.set(String(s.code), s.id); }
    const svcName = new Map((services ?? []).map((s) => [s.id, s.name_tr]));
    const findSvc = (title: string) => svcByName.get(norm(title)) ?? (/^\d{3,5}\b/.test(title.trim()) ? svcByCode.get(title.trim().match(/^\d{3,5}/)![0]) : undefined) ?? null;
    const cust = await loadCustomers();

    // aralıktaki mevcut kalemler
    type Ex = { id: string; visit_id: string; staff_id: string | null; starts_at: string; dikidi_id: string | null; status: VisitStatus; visit: { id: string; customer_id: string | null; visit_date: string; import_ref: string | null; sale: { id: string }[] | { id: string } | null } };
    const { data: exRaw } = await db.from("visit_items")
      .select("id, visit_id, staff_id, starts_at, dikidi_id, status, visit:visits!inner(id, customer_id, visit_date, import_ref, sale:sales(id))")
      .gte("visit.visit_date", from).lte("visit.visit_date", to);
    const existing = (exRaw ?? []) as unknown as Ex[];
    const byDikidi = new Map(existing.filter((e) => e.dikidi_id).map((e) => [e.dikidi_id!, e]));
    // aralık dışına/dışından taşınmış randevular: kimlikle ara
    const wanted = rows.flatMap((a) => (a.services?.length ? a.services : [{ id: "0" }]).map((s) => `${a.id}:${s.id}`)).filter((d) => !byDikidi.has(d));
    for (let i = 0; i < wanted.length; i += 200) {
      const { data: more } = await db.from("visit_items").select("id, visit_id, staff_id, starts_at, dikidi_id, status, visit:visits!inner(id, customer_id, visit_date, import_ref, sale:sales(id))").in("dikidi_id", wanted.slice(i, i + 200));
      for (const e of (more ?? []) as unknown as Ex[]) byDikidi.set(e.dikidi_id!, e);
    }
    const hasSale = (e: Ex) => Array.isArray(e.visit.sale) ? e.visit.sale.length > 0 : !!e.visit.sale;
    const legacy = existing.filter((e) => !e.dikidi_id && e.visit.import_ref);
    const legacyUsed = new Set<string>();
    const touchedVisits = new Set<string>();
    const visitCache = new Map<string, string>(); // customer|date → visit id

    const visitFor = async (customerId: string | null, date: string, source: "dikidi" | "online", anonKey: string) => {
      const key = customerId ? `${customerId}|${date}` : `anon|${anonKey}`;
      if (visitCache.has(key)) return visitCache.get(key)!;
      if (customerId) {
        const { data: v } = await db.from("visits").select("id").eq("customer_id", customerId).eq("visit_date", date).neq("status", "cancelled").limit(1).maybeSingle();
        if (v) { visitCache.set(key, v.id); return v.id; }
      }
      const { data: v, error } = await db.from("visits").insert({ customer_id: customerId, visit_date: date, status: "confirmed", source, import_ref: "dikidi-sync" }).select("id").single();
      if (error || !v) throw new Error(error?.message ?? "visit");
      visitCache.set(key, v.id); return v.id;
    };

    // 1) eski aktarım kalemlerini DIKIDI randevularıyla eşle (aynı müşteri, gün, başlangıç dakikası)
    const legacyMatch = new Map<string, Ex>();
    for (const a of rows) {
      if (!ISO.test(a.date) || !a.time || byDikidi.has(`${a.id}:${a.services?.[0]?.id ?? "0"}`)) continue;
      const customerId = cust.byPhone.get(digits(a.client_phone)) ?? null;
      if (!customerId) continue;
      const staffId = staffByMaster.get(String(a.master_id)) ?? null;
      let cur = localToIso(a.date, hm(a.time.slice(11)));
      for (const s of a.services?.length ? a.services : [{ id: "0", time: "0" } as Appt["services"][number]]) {
        const did = `${a.id}:${s.id}`;
        const ex = byDikidi.has(did) ? undefined : legacy.find((e) => !legacyUsed.has(e.id) && e.visit.customer_id === customerId && e.visit.visit_date === a.date && Math.abs(new Date(e.starts_at).getTime() - new Date(cur).getTime()) < 60000 && (!e.staff_id || !staffId || e.staff_id === staffId));
        if (ex) { legacyUsed.add(ex.id); legacyMatch.set(did, ex); report.legacyLinked++; }
        cur = plusMin(cur, Math.max(5, Number(s.time) || 30));
      }
    }
    // 2) karşılığı olmayan eski kalemleri ve DIKIDI'den tamamen kalkmış kalemleri önce iptal et (yeni kayıtlarla çakışmasın)
    const incoming = new Set(rows.flatMap((a) => (a.services?.length ? a.services : [{ id: "0" }]).map((s) => `${a.id}:${s.id}`)));
    for (const e of existing) {
      if (e.status === "cancelled" || hasSale(e)) continue;
      if (e.dikidi_id && !incoming.has(e.dikidi_id)) { await db.from("visit_items").update({ status: "cancelled" }).eq("id", e.id); touchedVisits.add(e.visit_id); report.cancelled++; }
      else if (!e.dikidi_id && e.visit.import_ref && e.visit.customer_id && !legacyUsed.has(e.id) && data.cancelLegacy !== false) { await db.from("visit_items").update({ status: "cancelled" }).eq("id", e.id); touchedVisits.add(e.visit_id); report.legacyCancelled++; }
    }
    // 3) kaydet
    for (const a of rows) {
      try {
        if (!ISO.test(a.date) || !a.time) continue;
        const status: VisitStatus = a.status_id === "2" || a.is_deleted === "1" ? "cancelled"
          : a.document_id && a.document_id !== "0" ? "completed"
          : a.client_came_id === "1" ? "arrived"
          : a.client_came_id && a.client_came_id !== "0" ? "no_show"
          : "confirmed";
        const staffId = staffByMaster.get(String(a.master_id)) ?? null;
        const author = a.added_name ? findAuthor(a.added_name) : null;
        const phoneD = digits(a.client_phone);
        let customerId = phoneD ? cust.byPhone.get(phoneD) ?? null : null;
        if (!customerId && phoneD && status !== "cancelled") {
          const { data: c, error } = await db.from("customers").insert({ first_name: a.client_first_name || a.client_last_name || "Müşteri", last_name: a.client_first_name ? a.client_last_name ?? "" : "", phone: normalizePhone(phoneD), source: "dikidi" }).select("id").single();
          if (error || !c) throw new Error(`müşteri: ${error?.message}`);
          customerId = c.id; cust.byPhone.set(phoneD, c.id); report.newCustomers++;
        }
        const svcs = a.services?.length ? a.services : [{ id: "0", title: "DIKIDI randevu", cost: "0", time: "" }];
        let cur = localToIso(a.date, hm(a.time.slice(11)));
        const apptEnd = localToIso(a.date, hm(a.time_to.slice(11)));
        for (let k = 0; k < svcs.length; k++) {
          const s = svcs[k];
          const did = `${a.id}:${s.id}`;
          const dur = Number(s.time) > 0 ? Number(s.time) : Math.max(5, Math.round((new Date(apptEnd).getTime() - new Date(cur).getTime()) / 60000 / (svcs.length - k)));
          const starts = cur, ends = k === svcs.length - 1 && new Date(apptEnd) > new Date(cur) ? apptEnd : plusMin(cur, Math.max(5, dur));
          cur = ends;
          const serviceId = findSvc(s.title);
          if (!serviceId && s.title !== "DIKIDI randevu" && !report.unmatchedServices.includes(s.title)) report.unmatchedServices.push(s.title.slice(0, 80));
          const fields = {
            service_id: serviceId, service_name: (serviceId ? svcName.get(serviceId) : null) ?? s.title.slice(0, 160),
            staff_id: staffId, starts_at: starts, ends_at: ends, status, dikidi_id: did, booked_by_staff_id: author,
            notes: a.comment ? String(a.comment).slice(0, 500) : "",
          };
          const ex = byDikidi.get(did) ?? legacyMatch.get(did);
          const save = async (id: string | null, payload: typeof fields & { visit_id?: string; price?: number }) => {
            let r = id ? await db.from("visit_items").update(payload).eq("id", id) : await db.from("visit_items").insert({ ...payload, visit_id: payload.visit_id!, price: payload.price ?? 0 });
            if (r.error && /overlap|exclusion|23P01/i.test(r.error.message + r.error.code)) {
              report.overlap++;
              const p2 = { ...payload, staff_id: null, notes: `${payload.notes ? payload.notes + " · " : ""}DIKIDI: aynı saatte çakışan randevu (personel atanmadı)` };
              r = id ? await db.from("visit_items").update(p2).eq("id", id) : await db.from("visit_items").insert({ ...p2, visit_id: payload.visit_id!, price: payload.price ?? 0 });
            }
            if (r.error) throw new Error(r.error.message);
          };
          if (ex) {
            const payload: typeof fields & { visit_id?: string; price?: number } = { ...fields };
            if (!hasSale(ex)) payload.price = Number(s.cost) || 0;
            if (ex.visit.visit_date !== a.date || (customerId && ex.visit.customer_id !== customerId)) {
              payload.visit_id = await visitFor(customerId, a.date, a.is_online === "1" ? "online" : "dikidi", a.id);
              touchedVisits.add(ex.visit_id); report.moved++;
            }
            await save(ex.id, payload);
            touchedVisits.add(payload.visit_id ?? ex.visit_id); report.updated++;
          } else {
            if (status === "cancelled") continue; // DIKIDI'de silinmiş ve bizde hiç olmamış
            const visitId = await visitFor(customerId, a.date, a.is_online === "1" ? "online" : "dikidi", a.id);
            await save(null, { ...fields, visit_id: visitId, price: Number(s.cost) || 0 });
            touchedVisits.add(visitId); report.created++;
          }
        }
      } catch (e) {
        report.errors.push(`${a.date} ${a.time?.slice(11, 16)} ${a.client_last_name ?? ""}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    // ziyaret durumunu kalemlerden türet
    const ids = [...touchedVisits];
    for (let i = 0; i < ids.length; i += 100) {
      const { data: vs } = await db.from("visits").select("id, status, items:visit_items(status), sale:sales(id)").in("id", ids.slice(i, i + 100));
      for (const v of vs ?? []) {
        const st = (v.items ?? []).map((x: { status: VisitStatus }) => x.status);
        const sale = Array.isArray(v.sale) ? v.sale.length : v.sale;
        let next: VisitStatus;
        if (!st.length) { await db.from("visits").delete().eq("id", v.id).is("customer_id", null); continue; }
        if (sale || st.includes("completed")) next = "completed";
        else if (st.every((x) => x === "cancelled")) next = "cancelled";
        else if (st.includes("arrived")) next = "arrived";
        else if (st.filter((x) => x !== "cancelled").every((x) => x === "no_show")) next = "no_show";
        else next = "confirmed";
        if (next !== v.status) await db.from("visits").update({ status: next }).eq("id", v.id);
      }
    }
    return json({ ok: true, report: { ...report, errors: report.errors.slice(0, 30), errorCount: report.errors.length, unmatchedServices: report.unmatchedServices.slice(0, 30) } });
  }

  /* ================= satışlar (+ kasa hareketlerinden ödeme yöntemi) ================= */
  if (body.kind === "sales") {
    const rows = (Array.isArray(data.rows) ? data.rows : []) as SaleRow[];
    const cash = (Array.isArray(data.cash) ? data.cash : []) as CashRow[];
    const report = { sales: rows.length, created: 0, replaced: 0, skipped: 0, zero: 0, payMatched: 0, payBalance: 0, errors: [] as string[] };
    const cust = await loadCustomers();
    const { data: products } = await db.from("products").select("id, name");
    const prodByName = new Map((products ?? []).map((p) => [norm(p.name), p.id]));
    const ids = rows.map((r) => String(r.id));
    const { data: exSales } = ids.length ? await db.from("sales").select("id, dikidi_id, total").in("dikidi_id", ids) : { data: [] };
    const exById = new Map((exSales ?? []).map((s) => [s.dikidi_id!, s]));
    // ödeme satırları: (isim, gün) → kasa hareketleri; satışa önce aynı dakika, sonra en yakın saat eşlenir, her satır bir kez kullanılır
    type Pay = { id: string; method: PayMethod; amount: number; min: number };
    const pays = new Map<string, Pay[]>();
    const byDate = new Map<string, Pay[]>();
    for (const c of cash) {
      if (c.sum !== "debt" || !/sales|продаж/i.test(c.type)) continue;
      const m = c.dt.match(/(\d{2})\.(\d{2})\.(\d{4}) в (\d{2}):(\d{2})/); if (!m) continue;
      const k = `${sortedName(c.who)}|${m[3]}-${m[2]}-${m[1]}`;
      const amount = Number(String(c.amt).replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
      if (amount > 0) {
        const p = { id: c.id, method: (/касса|cash/i.test(c.acc) ? "cash" : "card") as PayMethod, amount, min: Number(m[4]) * 60 + Number(m[5]) };
        pays.set(k, [...(pays.get(k) ?? []), p]);
        const dk = `${m[3]}-${m[2]}-${m[1]}`; byDate.set(dk, [...(byDate.get(dk) ?? []), p]);
      }
    }
    const usedPay = new Set<string>();
    const takePays = (name: string, date: string, time: string, total: number) => {
      const list = (pays.get(`${sortedName(name)}|${date}`) ?? []).filter((p) => !usedPay.has(p.id));
      const tm = /^\d{2}:\d{2}/.test(time) ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) : 720;
      list.sort((a, b) => Math.abs(a.min - tm) - Math.abs(b.min - tm));
      const out: { method: PayMethod; amount: number }[] = []; let sum = 0;
      for (const p of list) { if (sum >= total - 0.5) break; if (Math.abs(p.min - tm) > 240 && out.length) break; usedPay.add(p.id); out.push({ method: p.method, amount: p.amount }); sum += p.amount; }
      // isim tutmadıysa: aynı gün, kalan tutarla birebir aynı ve saati yakın (±60 dk) kullanılmamış hareket
      const rest = total - sum;
      if (rest > 0.5) {
        const alt = (byDate.get(date) ?? []).filter((p) => !usedPay.has(p.id) && Math.abs(p.amount - rest) < 1 && Math.abs(p.min - tm) <= 60).sort((a, b) => Math.abs(a.min - tm) - Math.abs(b.min - tm))[0];
        if (alt) { usedPay.add(alt.id); out.push({ method: alt.method, amount: alt.amount }); }
      }
      return out;
    };

    for (const r of rows) {
      try {
        const total = Math.round(Number(r.amount) * 100) / 100;
        if (!(total > 0) || !r.lines?.length) { report.zero++; continue; }
        const ex = exById.get(String(r.id));
        if (ex && !data.force && Math.abs(Number(ex.total) - total) < 0.01) { report.skipped++; continue; }
        if (ex) { await db.from("sales").delete().eq("id", ex.id); report.replaced++; }
        const phoneD = digits(r.phone);
        const customerId = (phoneD && cust.byPhone.get(phoneD)) || cust.byName.get(sortedName(r.name)) || null;
        // aynı gün ziyareti (satışı yoksa) bağla
        let visitId: string | null = null;
        let visitItems: { id: string; staff_id: string | null; service_name: string; dikidi_id: string | null }[] = [];
        if (customerId) {
          const { data: v } = await db.from("visits").select("id, sale:sales(id), items:visit_items(id, staff_id, service_name, dikidi_id)").eq("customer_id", customerId).eq("visit_date", r.date).neq("status", "cancelled").limit(1).maybeSingle();
          if (v) { visitItems = (v.items ?? []) as typeof visitItems; const has = Array.isArray(v.sale) ? v.sale.length : v.sale; if (!has) visitId = v.id; }
        }
        const lines = r.lines.map((l) => {
          const staffId = findStaff(l.master);
          const productId = prodByName.get(norm(l.name)) ?? null;
          const code = l.name.match(/^\d{4}/)?.[0];
          const vi = !productId ? visitItems.find((i) => (!staffId || i.staff_id === staffId) && (code ? i.service_name.startsWith(code) || norm(i.service_name).includes(norm(l.name).slice(5, 25)) : norm(i.service_name) === norm(l.name))) : undefined;
          return {
            kind: (productId ? "product" : "service") as "product" | "service", product_id: productId, visit_item_id: vi?.id ?? null, name: l.name.slice(0, 200),
            staff_id: staffId, staff_name: l.master ?? "", qty: 1, unit_price: Math.round((l.income + l.disc) * 100) / 100, discount: Math.round(l.disc * 100) / 100,
            total: Math.round(l.income * 100) / 100, material_cost: Math.round((l.mat || 0) * 100) / 100, dikidi_pay: Math.round((l.salary || 0) * 100) / 100,
          };
        });
        const discount = lines.reduce((s, l) => s + l.discount, 0);
        const { data: sale, error } = await db.from("sales").insert({
          visit_id: visitId, customer_id: customerId, sale_date: r.date, subtotal: Math.round((total + discount) * 100) / 100, discount: Math.round(discount * 100) / 100, total,
          notes: "DIKIDI", dikidi_id: String(r.id), created_at: localToIso(r.date, hm(r.time) || "12:00"),
        }).select("id").single();
        if (error || !sale) throw new Error(error?.message ?? "sale");
        await db.from("sale_items").insert(lines.map((l) => ({ ...l, sale_id: sale.id })));
        let p = takePays(r.name, r.date, hm(r.time), total);
        let paid = p.reduce((s, x) => s + x.amount, 0);
        if (paid > total + 0.5) { p = [{ method: p[0].method, amount: total }]; paid = total; }
        if (p.length) report.payMatched++;
        const rest = Math.round((total - paid) * 100) / 100;
        if (rest > 0.009) { p = [...p, { method: "balance", amount: rest }]; report.payBalance++; }
        await db.from("sale_payments").insert(p.map((x) => ({ sale_id: sale.id, method: x.method, amount: x.amount, ref: rest > 0.009 && x.method === "balance" ? "DIKIDI bakiye/puan" : "" })));
        if (visitId) await db.from("visits").update({ status: "completed" }).eq("id", visitId);
        report.created++;
      } catch (e) {
        report.errors.push(`${r.date} ${r.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return json({ ok: true, report: { ...report, errors: report.errors.slice(0, 30), errorCount: report.errors.length } });
  }

  /* ================= kasa hareketleri: bakiye yükleme, maaş ödemesi, gider ================= */
  if (body.kind === "cashflow") {
    const rows = (Array.isArray(data.rows) ? data.rows : []) as CashRow[];
    const report = { rows: rows.length, balanceTopups: 0, payouts: 0, expenses: 0, skipped: 0, errors: [] as string[] };
    const cust = await loadCustomers();
    const cfIds = rows.map((r) => `cf:${r.id}`);
    const [{ data: s1 }, { data: s2 }, { data: s3 }] = await Promise.all([
      db.from("sales").select("dikidi_id").in("dikidi_id", cfIds),
      db.from("staff_payouts").select("dikidi_id").in("dikidi_id", cfIds),
      db.from("expenses").select("dikidi_id").in("dikidi_id", cfIds),
    ]);
    const done = new Set([...(s1 ?? []), ...(s2 ?? []), ...(s3 ?? [])].map((x) => x.dikidi_id));
    for (const r of rows) {
      try {
        const did = `cf:${r.id}`;
        if (done.has(did)) { report.skipped++; continue; }
        const m = r.dt.match(/(\d{2})\.(\d{2})\.(\d{4}) в (\d{2}:\d{2})/); if (!m) continue;
        const date = `${m[3]}-${m[2]}-${m[1]}`;
        const amount = Number(String(r.amt).replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
        if (!(amount > 0)) continue;
        const method: PayMethod = /касса|cash/i.test(r.acc) ? "cash" : "card";
        const note = [r.who, r.note].filter(Boolean).join(" · ").slice(0, 300);
        if (r.sum === "debt") {
          if (/sales|продаж/i.test(r.type) && !/баланс|balance/i.test(r.type)) { report.skipped++; continue; } // satışlarla geldi
          if (/sales|продаж/i.test(r.type)) { report.skipped++; continue; } // karışık satır: satışın ödemesi
          // müşteri bakiyesi yükleme / ön ödeme → satış (kalem türü bakiye)
          const customerId = cust.byName.get(sortedName(r.who)) ?? null;
          const { data: sale, error } = await db.from("sales").insert({ customer_id: customerId, sale_date: date, subtotal: amount, total: amount, notes: `DIKIDI: ${r.type}${customerId ? "" : ` · ${r.who}`}`, dikidi_id: did, created_at: localToIso(date, m[4]) }).select("id").single();
          if (error || !sale) throw new Error(error?.message ?? "sale");
          await db.from("sale_items").insert({ sale_id: sale.id, kind: "balance", name: /prepay/i.test(r.type) ? "Ön ödeme" : "Bakiye yükleme", qty: 1, unit_price: amount, total: amount });
          await db.from("sale_payments").insert({ sale_id: sale.id, method, amount });
          report.balanceTopups++;
        } else if (/salary|зарплат/i.test(r.type)) {
          const staffId = findStaff(r.who);
          if (!staffId) { report.errors.push(`maaş ödemesi: personel bulunamadı (${r.who})`); continue; }
          const ms = `${date.slice(0, 7)}-01`; const me = addDaysIso(`${date.slice(0, 7)}-28`, 4).slice(0, 7) + "-01";
          await db.from("staff_payouts").insert({ staff_id: staffId, period_start: ms, period_end: addDaysIso(me, -1), amount, method, notes: `DIKIDI${r.note ? ` · ${r.note}` : ""}`, paid_at: date, dikidi_id: did });
          report.payouts++;
        } else {
          const category = /закупк|purchase/i.test(r.type) ? "malzeme" : /refund|возврат/i.test(r.type) ? "iade" : "diğer";
          await db.from("expenses").insert({ expense_date: date, category, description: `${r.type} · ${note}`.slice(0, 300), amount, method, dikidi_id: did, created_at: localToIso(date, m[4]) });
          report.expenses++;
        }
      } catch (e) {
        report.errors.push(`${r.dt} ${r.who}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return json({ ok: true, report: { ...report, errors: report.errors.slice(0, 30) } });
  }

  /* ================= çalışma takvimi (ay JSON'u) ================= */
  if (body.kind === "schedule") {
    const ym = String(data.ym ?? "");
    const sched = (data.data ?? {}) as Record<string, Record<string, { begin?: string; end?: string; work_from?: string; work_to?: string; break_from?: string; break_to?: string }>>;
    if (!/^\d{4}-\d{2}$/.test(ym)) return json({ error: "bad_month" }, 422);
    const [y, mo] = ym.split("-").map(Number);
    const first = `${ym}-01`, last = `${ym}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`;
    const rows: { staff_id: string; day: string; start_time: string; end_time: string; source: string }[] = [];
    const touched = new Set<string>(); const unmatched: string[] = [];
    for (const [mid, days] of Object.entries(sched)) {
      const sid = staffByMaster.get(String(mid));
      if (!sid) { unmatched.push(mid); continue; }
      touched.add(sid);
      for (const [day, v] of Object.entries(days ?? {})) {
        if (!ISO.test(day) || day < first || day > last) continue;
        const a = hm(v.work_from || v.begin || ""), b = hm(v.work_to || v.end || "");
        if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b) || b <= a) continue;
        const bf = hm(v.break_from ?? ""), bt = hm(v.break_to ?? "");
        if (bf && bt && bf !== "00:00" && bt > bf && bf > a && bt < b) {
          rows.push({ staff_id: sid, day, start_time: a, end_time: bf, source: "dikidi" }, { staff_id: sid, day, start_time: bt, end_time: b, source: "dikidi" });
        } else rows.push({ staff_id: sid, day, start_time: a, end_time: b, source: "dikidi" });
      }
    }
    // DIKIDI'deki tüm personel için ayı yeniden yaz (hiç günü olmayan personelin eski satırları da silinir)
    const all = [...new Set([...touched, ...staffByMaster.values()])];
    if (all.length) {
      const { error } = await db.from("staff_day_hours").delete().in("staff_id", all).gte("day", first).lte("day", last);
      if (error) return json({ error: error.message }, 500);
    }
    if (rows.length) { const { error } = await db.from("staff_day_hours").insert(rows); if (error) return json({ error: error.message }, 500); }
    if (all.length) await db.from("staff").update({ schedule_mode: "daily" }).in("id", all);
    return json({ ok: true, report: { month: ym, rows: rows.length, staff: touched.size, unmatched } });
  }

  /* ================= maaş şemaları ================= */
  if (body.kind === "salary") {
    const rows = (Array.isArray(data.rows) ? data.rows : []) as { id: string; masterId: string; name: string; vals: Record<string, string> }[];
    const report = { rows: rows.length, saved: 0, unmatched: [] as string[] };
    const num = (v?: string) => Number(String(v ?? "").replace(",", ".")) || 0;
    const on = (v?: string) => v === "1";
    for (const r of rows) {
      const sid = staffByMaster.get(String(r.masterId)) ?? findStaff(r.name);
      if (!sid) { report.unmatched.push(r.name); continue; }
      const v = r.vals;
      const d = String(v.date ?? "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      const own = on(v.use_master_sales), comp = on(v.use_company_sales), book = on(v.use_appointment_author), fixed = on(v.use_fixed), guar = on(v.use_guaranteed);
      const row = {
        staff_id: sid, valid_from: d ? `${d[3]}-${d[2]}-${d[1]}` : "2026-01-01",
        service_percent: own ? num(v.master_service_percent) : 0, product_percent: own ? num(v.master_product_percent) : 0,
        service_deduct_discount: on(v.master_service_use_discount), product_deduct_discount: on(v.master_product_use_discount), service_deduct_materials: on(v.master_service_use_product_cost),
        company_service_percent: comp ? num(v.company_service_percent) : 0, company_product_percent: comp ? num(v.company_product_percent) : 0,
        company_deduct_discount: on(v.company_service_use_discount), company_exclude_own: on(v.company_use_ignore_current_master), company_only_on_shift: on(v.company_use_master_schedule),
        booking_service_percent: book ? num(v.appointment_author_service_percent) : 0, booking_product_percent: book ? num(v.appointment_author_product_percent) : 0,
        booking_exclude_own: on(v.appointment_author_ignore_master),
        daily_wage: fixed && on(v.use_fixed_day) ? num(v.fixed_day_price) : 0, daily_guarantee: guar ? num(v.guaranteed_price) : 0,
        notes: "DIKIDI", dikidi_id: String(r.id),
      };
      const { error } = await db.from("staff_pay_schemes").upsert(row, { onConflict: "dikidi_id" });
      if (error) return json({ error: error.message }, 500);
      report.saved++;
    }
    return json({ ok: true, report });
  }

  return json({ error: "unknown_kind" }, 422);
}
