import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/database.types";

/* DIKIDI katalog aktarımı (çalışma takvimi, personel ↔ hizmet, …).
   DIKIDI panel sekmesinden tarayıcı JS'i ile çağrılır; settings.import_token ile korunur.
   Her tür kendi kapsamını tamamen yeniden yazar (idempotent): aynı veriyle tekrar çalıştırmak güvenlidir. */

const ORIGINS = ["https://dikidi.net", "https://beauty.dikidi.net"];
const corsFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-import-token",
  Vary: "Origin",
});

export async function OPTIONS(req: NextRequest) { return new Response(null, { status: 204, headers: corsFor(req.headers.get("origin")) }); }

const norm = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9а-яё]+/gi, " ").trim();
const MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

type SchedulePayload = { months: { month: string; rows: { name: string; days: string[] }[] }[] };
type ServicesPayload = { masters: Record<string, string>; services: { dikidiId: string; name: string; masters: { id: string; time: number; cost: number; online: boolean }[] }[] };

export async function POST(req: NextRequest) {
  const cors = corsFor(req.headers.get("origin"));
  const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });
  const db = createAdminClient();
  const token = req.headers.get("x-import-token") ?? "";
  const { data: st } = await db.from("settings").select("import_token").eq("id", 1).single();
  if (!st?.import_token || token.length < 16 || token !== st.import_token) return json({ error: "unauthorized" }, 401);

  let body: { kind?: string; data?: unknown; dryRun?: boolean };
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const { data: staff } = await db.from("staff").select("id, full_name, dikidi_master_id");
  const staffByName = new Map((staff ?? []).map((s) => [norm(s.full_name), s.id]));
  const findStaff = (name: string) => {
    const n = norm(name);
    if (staffByName.has(n)) return staffByName.get(n)!;
    // "Ad Soyad" ↔ "Soyad Ad" ve kısmi eşleşme
    const parts = n.split(" ").sort().join(" ");
    for (const [k, id] of staffByName) if (k.split(" ").sort().join(" ") === parts) return id;
    for (const [k, id] of staffByName) if (k.startsWith(n) || n.startsWith(k)) return id;
    return null;
  };

  /* ---------------- çalışma takvimi (gün gün) ---------------- */
  if (body.kind === "schedule") {
    const p = body.data as SchedulePayload;
    if (!Array.isArray(p?.months)) return json({ error: "bad_payload" }, 422);
    const report = { months: [] as string[], staff: {} as Record<string, number>, unmatched: [] as string[], rows: 0 };
    const rows: { staff_id: string; day: string; start_time: string; end_time: string; source: string }[] = [];
    const ranges: { from: string; to: string }[] = [];
    const touched = new Set<string>();
    for (const m of p.months) {
      const [mn, yr] = m.month.trim().toLowerCase().split(/\s+/);
      const month = MONTHS[mn], year = Number(yr);
      if (!month || !year) continue;
      const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const from = `${year}-${String(month).padStart(2, "0")}-01`, to = `${year}-${String(month).padStart(2, "0")}-${days}`;
      ranges.push({ from, to }); report.months.push(m.month);
      for (const r of m.rows) {
        const sid = findStaff(r.name);
        if (!sid) { if (!report.unmatched.includes(r.name)) report.unmatched.push(r.name); continue; }
        touched.add(sid);
        r.days.slice(0, days).forEach((v, i) => {
          const [a, b] = String(v || "").split("-");
          if (!HM.test(a ?? "") || !HM.test(b ?? "") || b <= a) return;
          rows.push({ staff_id: sid, day: `${from.slice(0, 8)}${String(i + 1).padStart(2, "0")}`, start_time: a, end_time: b, source: "dikidi" });
          report.staff[r.name] = (report.staff[r.name] ?? 0) + 1;
        });
      }
    }
    report.rows = rows.length;
    if (body.dryRun) return json({ ok: true, dryRun: true, report });
    const ids = [...touched];
    for (const r of ranges) {
      const { error } = await db.from("staff_day_hours").delete().in("staff_id", ids).gte("day", r.from).lte("day", r.to);
      if (error) return json({ error: error.message }, 500);
    }
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("staff_day_hours").insert(rows.slice(i, i + 500));
      if (error) return json({ error: error.message }, 500);
    }
    if (ids.length) await db.from("staff").update({ schedule_mode: "daily" }).in("id", ids);
    return json({ ok: true, report });
  }

  /* ---------------- personel ↔ hizmet (uzman bazında süre/fiyat/online) ---------------- */
  if (body.kind === "staff_services") {
    const p = body.data as ServicesPayload;
    if (!Array.isArray(p?.services) || typeof p.masters !== "object") return json({ error: "bad_payload" }, 422);
    const { data: services } = await db.from("services").select("id, code, name_tr, name_en, price, duration_min, dikidi_id");
    // services.dikidi_id ilk aktarımda DIKIDI'deki tam hizmet adını tutuyor → önce onunla eşleştir
    const byDikidi = new Map((services ?? []).filter((s) => s.dikidi_id).map((s) => [norm(s.dikidi_id as string), s]));
    const byCode = new Map<string, NonNullable<typeof services>[number][]>();
    for (const s of services ?? []) if (s.code) byCode.set(s.code, [...(byCode.get(s.code) ?? []), s]);
    const byName = new Map<string, NonNullable<typeof services>[number]>();
    for (const s of services ?? []) { byName.set(norm(s.name_tr), s); if (s.name_en) byName.set(norm(s.name_en), s); }

    const masterToStaff = new Map<string, string>();
    const report = { services: p.services.length, matched: 0, unmatchedServices: [] as string[], unmatchedMasters: [] as string[], pairs: 0, overrides: 0, staff: {} as Record<string, number> };
    for (const [mid, name] of Object.entries(p.masters)) {
      const sid = findStaff(name);
      if (sid) masterToStaff.set(mid, sid); else report.unmatchedMasters.push(name);
    }
    const pairs: { staff_id: string; service_id: string; price_override: number | null; duration_override: number | null; online: boolean }[] = [];
    const seen = new Set<string>();
    for (const sv of p.services) {
      const name = sv.name.replace(/\s+/g, " ").trim();
      let s = byDikidi.get(norm(name)) ?? null;
      if (!s) {
        const code = name.match(/^(\d{3,5})\b/)?.[1];
        const cands = code ? byCode.get(code) ?? [] : [];
        const rest = norm(name.replace(/^\d{3,5}\s*[.\-]?\s*/, ""));
        s = cands.length === 1 ? cands[0] : cands.find((c) => rest.includes(norm(c.name_tr)) || rest.includes(norm(c.name_en ?? "")) || norm(c.name_tr).includes(rest.split(" / ")[0] ?? "")) ?? null;
        if (!s) {
          // ad ile: "EN / TR" biçimindeki adların her iki parçasını dene
          for (const part of name.replace(/^\d{3,5}\s*[.\-]?\s*/, "").split("/").map((x) => norm(x)).filter((x) => x.length > 3)) { s = byName.get(part) ?? null; if (s) break; }
        }
      }
      if (!s) { report.unmatchedServices.push(name.slice(0, 80)); continue; }
      report.matched++;
      for (const m of sv.masters) {
        const sid = masterToStaff.get(String(m.id));
        if (!sid) continue;
        const k = `${sid}:${s.id}`; if (seen.has(k)) continue; seen.add(k);
        const priceO = Number.isFinite(m.cost) && Number(m.cost) !== Number(s.price) ? Number(m.cost) : null;
        const durO = Number.isFinite(m.time) && m.time > 0 && Number(m.time) !== Number(s.duration_min) ? Math.round(m.time) : null;
        if (priceO !== null || durO !== null) report.overrides++;
        pairs.push({ staff_id: sid, service_id: s.id, price_override: priceO, duration_override: durO, online: !!m.online });
        const nm = (staff ?? []).find((x) => x.id === sid)?.full_name ?? sid;
        report.staff[nm] = (report.staff[nm] ?? 0) + 1;
      }
    }
    report.pairs = pairs.length;
    if (body.dryRun) return json({ ok: true, dryRun: true, report: { ...report, unmatchedServices: report.unmatchedServices.slice(0, 60) } });
    for (const [mid, sid] of masterToStaff) await db.from("staff").update({ dikidi_master_id: mid }).eq("id", sid);
    const staffIds = [...new Set(masterToStaff.values())];
    if (staffIds.length) {
      const { error } = await db.from("staff_services").delete().in("staff_id", staffIds);
      if (error) return json({ error: error.message }, 500);
    }
    for (let i = 0; i < pairs.length; i += 500) {
      const { error } = await db.from("staff_services").insert(pairs.slice(i, i + 500));
      if (error) return json({ error: error.message }, 500);
    }
    return json({ ok: true, report: { ...report, unmatchedServices: report.unmatchedServices.slice(0, 60) } });
  }

  /* ---------------- ürünler (liste tablosundan) ---------------- */
  if (body.kind === "products") {
    type P = { id: string; name: string; article?: string; category: string; sale: string; make: string; buyDate: string; buy: string; qty: string; mat: string };
    const list = (body.data as { products?: P[] })?.products;
    if (!Array.isArray(list)) return json({ error: "bad_payload" }, 422);
    const num = (v: string) => { const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
    const UNIT: Record<string, string> = { pcs: "adet", g: "g", ml: "ml", mg: "mg", cm: "cm", pkg: "paket" };
    const qtyOf = (v: string) => { const m = String(v ?? "").match(/^(-?[\d.,]+)\s*([a-zA-Zа-яА-Я.]*)/); return m ? { n: num(m[1]), u: UNIT[m[2].replace(".", "")] ?? m[2] } : null; };
    const { data: existing } = await db.from("products").select("id, dikidi_id, stock_qty");
    const byD = new Map((existing ?? []).filter((x) => x.dikidi_id).map((x) => [x.dikidi_id as string, x]));
    const report = { products: list.length, inserted: 0, updated: 0, retail: 0, materialOnly: 0 };
    if (body.dryRun) return json({ ok: true, dryRun: true, report });
    const moves: { product_id: string; kind: "adjust"; qty: number; unit_cost: number | null; note: string }[] = [];
    for (const p of list) {
      const q = qtyOf(p.qty), mq = qtyOf(p.mat);
      const retail = p.sale.trim() !== "-" && num(p.sale) > 0;
      if (retail) report.retail++; else report.materialOnly++;
      const [d, m, y] = (p.buyDate || "").split(".");
      const row = {
        name: p.name.slice(0, 200), category: p.category.slice(0, 120), brand: "", barcode: (p.article ?? "").slice(0, 60),
        unit: q?.u || mq?.u || "adet", sale_price: retail ? num(p.sale) : 0, cost_price: num(p.buy), use_price: p.make.trim() === "-" ? 0 : num(p.make),
        stock_qty: q?.n ?? 0, material_qty: mq?.n ?? 0, material_unit: mq?.u ?? "",
        last_purchase_at: y && m && d ? `${y}-${m}-${d}` : null, is_retail: retail, is_active: true, dikidi_id: p.id,
      };
      const ex = byD.get(p.id);
      if (ex) {
        const { error } = await db.from("products").update(row).eq("id", ex.id);
        if (error) return json({ error: error.message }, 500);
        const diff = (row.stock_qty ?? 0) - Number(ex.stock_qty);
        if (diff) moves.push({ product_id: ex.id, kind: "adjust", qty: diff, unit_cost: null, note: "DIKIDI eşitleme" });
        report.updated++;
      } else {
        const { data: ins, error } = await db.from("products").insert(row).select("id").single();
        if (error || !ins) return json({ error: error?.message ?? "insert" }, 500);
        if (row.stock_qty) moves.push({ product_id: ins.id, kind: "adjust", qty: row.stock_qty, unit_cost: row.cost_price || null, note: "DIKIDI açılış stoğu" });
        report.inserted++;
      }
    }
    for (let i = 0; i < moves.length; i += 500) await db.from("stock_moves").insert(moves.slice(i, i + 500));
    return json({ ok: true, report });
  }

  /* ---------------- tedarikçiler / depolar ---------------- */
  if (body.kind === "suppliers" || body.kind === "warehouses") {
    const rows = ((body.data as { rows?: string[][] })?.rows ?? []).filter((r) => Array.isArray(r) && r[0] && !/^(Counterparty|Name)\b/.test(r[0]));
    const seen = new Set<string>(); const out: { name: string; extra: string }[] = [];
    for (const r of rows) { const name = String(r[0]).trim().slice(0, 120); if (seen.has(name)) continue; seen.add(name); out.push({ name, extra: String(r[1] ?? "").trim() }); }
    if (body.dryRun) return json({ ok: true, dryRun: true, report: { rows: out.length } });
    for (const r of out) {
      if (body.kind === "suppliers") {
        const phone = r.extra.replace(/\D/g, "") ? "+" + r.extra.replace(/\D/g, "") : "";
        const { error } = await db.from("suppliers").upsert({ name: r.name, phone, dikidi_name: r.name }, { onConflict: "dikidi_name" });
        if (error) return json({ error: error.message }, 500);
      } else {
        const { error } = await db.from("warehouses").upsert({ name: r.name, responsible_staff_id: r.extra ? findStaff(r.extra) : null, dikidi_name: r.name }, { onConflict: "dikidi_name" });
        if (error) return json({ error: error.message }, 500);
      }
    }
    return json({ ok: true, report: { rows: out.length } });
  }

  /* ---------------- müşteriler (DIKIDI CSV dışa aktarımı + gruplar) ---------------- */
  if (body.kind === "clients") {
    const p = body.data as { csv?: string; groups?: Record<string, string[]> };
    const lines = String(p?.csv ?? "").split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return json({ error: "bad_payload" }, 422);
    const H = lines[0].split(";");
    const col = (name: string) => H.findIndex((h) => h.trim() === name);
    const C = { name: col("The name of the customer"), surname: col("Client surname"), phone: col("Phone number"), email: col("Email"), discount: col("Discount %"), card: col("Card number"), balance: col("Personal account"), bonus: col("Bonus account"), birthday: col("Birthday"), gender: col("Gender"), black: col("In the black list"), comment: col("Comment"), source: col("Source") };
    if (C.phone < 0 || C.name < 0) return json({ error: "bad_header" }, 422);
    // grup → etiket + iletişim dili
    const GROUP: Record<string, { tag: string; locale?: string }> = { "Русскоязычные": { tag: "RU", locale: "ru" }, "Англоязычные": { tag: "EN", locale: "en" }, "Турецкоговорящие": { tag: "TR", locale: "tr" }, "red list": { tag: "red list" } };
    const groupsByPhone = new Map<string, string[]>();
    for (const [g, phones] of Object.entries(p.groups ?? {})) for (const ph of phones ?? []) { const d = String(ph).replace(/\D/g, ""); if (d) groupsByPhone.set(d, [...(groupsByPhone.get(d) ?? []), g]); }
    const SOURCE: Record<string, string> = { "Search engine": "google", "Recommendation": "tavsiye", "Advertising": "reklam", "Maps": "harita" };

    const all: { id: string; phone: string; first_name: string; last_name: string; email: string; gender: string; birth_date: string | null; locale: string; source: string; tags: string[]; notes: string; is_blocked: boolean; discount_percent: number; balance: number; loyalty_points: number; card_no: string; dikidi_source: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await db.from("customers").select("id, phone, first_name, last_name, email, gender, birth_date, locale, source, tags, notes, is_blocked, discount_percent, balance, loyalty_points, card_no, dikidi_source").range(from, from + 999);
      all.push(...((data ?? []) as typeof all)); if (!data || data.length < 1000) break;
    }
    const byPhone = new Map<string, (typeof all)[number]>();
    for (const c of all) { const d = c.phone.replace(/\D/g, ""); if (d) byPhone.set(d, c); }

    const report = { rows: 0, matched: 0, created: 0, updated: 0, balanceAdj: 0, pointsAdj: 0, noPhone: 0, groups: 0 };
    const balMoves: { customer_id: string; amount: number; reason: string }[] = [];
    const ptMoves: { customer_id: string; points: number; reason: string }[] = [];
    const dmy = (s: string) => { const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
    for (const line of lines.slice(1)) {
      const f = line.split(";");
      const get = (i: number) => (i >= 0 ? String(f[i] ?? "").trim() : "");
      report.rows++;
      const digits = get(C.phone).replace(/\D/g, "");
      if (!digits) { report.noPhone++; continue; }
      const groups = groupsByPhone.get(digits) ?? [];
      if (groups.length) report.groups++;
      const g = get(C.gender).toLowerCase();
      const srcRaw = get(C.source);
      const want = {
        first_name: get(C.name) || "—", last_name: get(C.surname), email: get(C.email),
        gender: (g.startsWith("f") ? "f" : g.startsWith("m") ? "m" : "") as "" | "f" | "m",
        birth_date: dmy(get(C.birthday)),
        discount_percent: Math.max(0, Math.min(100, Number(get(C.discount).replace(",", ".")) || 0)),
        card_no: get(C.card), is_blocked: get(C.black).toLowerCase() === "yes",
        balance: Math.round((Number(get(C.balance)) || 0) * 100) / 100,
        loyalty_points: Math.round(Number(get(C.bonus)) || 0),
        comment: get(C.comment), dikidi_source: srcRaw,
        tags: groups.map((x) => GROUP[x]?.tag ?? x),
        locale: groups.map((x) => GROUP[x]?.locale).find(Boolean),
      };
      const ex = byPhone.get(digits);
      if (!ex) {
        report.created++;
        if (body.dryRun) continue;
        const { data: ins, error } = await db.from("customers").insert({
          first_name: want.first_name, last_name: want.last_name, phone: "+" + digits, email: want.email, gender: want.gender, birth_date: want.birth_date,
          locale: want.locale ?? "tr", source: SOURCE[srcRaw] ?? "dikidi", dikidi_source: srcRaw, tags: want.tags, notes: want.comment, is_blocked: want.is_blocked,
          discount_percent: want.discount_percent, card_no: want.card_no, balance: want.balance, loyalty_points: want.loyalty_points,
        }).select("id").single();
        if (error || !ins) return json({ error: error?.message ?? "insert" }, 500);
        if (want.balance) balMoves.push({ customer_id: ins.id, amount: want.balance, reason: "DIKIDI açılış bakiyesi" });
        if (want.loyalty_points) ptMoves.push({ customer_id: ins.id, points: want.loyalty_points, reason: "DIKIDI açılış puanı" });
        continue;
      }
      report.matched++;
      // Yalnızca boş alanları doldur; DIKIDI'ye özgü alanlar (indirim, kart, bakiye, puan, engel) DIKIDI'ye eşitlenir
      const upd: Partial<Customer> = {};
      if (!ex.last_name && want.last_name) upd.last_name = want.last_name;
      if (!ex.email && want.email) upd.email = want.email;
      if (!ex.gender && want.gender) upd.gender = want.gender;
      if (!ex.birth_date && want.birth_date) upd.birth_date = want.birth_date;
      if (want.locale && ex.locale === "tr" && want.locale !== "tr") upd.locale = want.locale;
      if ((!ex.source || ex.source === "dikidi" || ex.source === "salon") && SOURCE[srcRaw]) upd.source = SOURCE[srcRaw];
      if (ex.dikidi_source !== srcRaw) upd.dikidi_source = srcRaw;
      const tags = [...new Set([...(ex.tags ?? []).filter((t) => !Object.values(GROUP).some((G) => G.tag === t) || want.tags.includes(t)), ...want.tags])];
      if (tags.join("|") !== (ex.tags ?? []).join("|")) upd.tags = tags;
      if (want.comment && !ex.notes.includes(want.comment.slice(0, 40))) upd.notes = ex.notes ? `${ex.notes}\n${want.comment}` : want.comment;
      if (Number(ex.discount_percent) !== want.discount_percent) upd.discount_percent = want.discount_percent;
      if (ex.card_no !== want.card_no) upd.card_no = want.card_no;
      if (ex.is_blocked !== want.is_blocked) upd.is_blocked = want.is_blocked;
      const db_ = Math.round((want.balance - Number(ex.balance)) * 100) / 100;
      if (db_) { upd.balance = want.balance; balMoves.push({ customer_id: ex.id, amount: db_, reason: "DIKIDI eşitleme" }); report.balanceAdj++; }
      const dp = want.loyalty_points - (ex.loyalty_points ?? 0);
      if (dp) { upd.loyalty_points = want.loyalty_points; ptMoves.push({ customer_id: ex.id, points: dp, reason: "DIKIDI eşitleme" }); report.pointsAdj++; }
      if (Object.keys(upd).length) {
        report.updated++;
        if (!body.dryRun) { const { error } = await db.from("customers").update(upd).eq("id", ex.id); if (error) return json({ error: error.message }, 500); }
      }
    }
    if (!body.dryRun) {
      if (balMoves.length) await db.from("balance_ledger").insert(balMoves);
      if (ptMoves.length) await db.from("loyalty_ledger").insert(ptMoves);
    }
    return json({ ok: true, dryRun: !!body.dryRun, report });
  }

  /* ---------------- yorumlar ---------------- */
  if (body.kind === "reviews") {
    const rows = ((body.data as { rows?: { id: string; name: string; phone?: string; text: string; reply: string; at: string; rating: number; public: boolean }[] })?.rows ?? []).filter((r) => r?.id);
    const { data: cs } = await db.from("customers").select("id, phone");
    const byPhone = new Map((cs ?? []).map((c) => [c.phone.replace(/\D/g, ""), c.id]));
    const out = rows.map((r) => ({
      dikidi_id: String(r.id), author_name: String(r.name ?? "").slice(0, 120), customer_id: byPhone.get(String(r.phone ?? "").replace(/\D/g, "")) ?? null,
      rating: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5))), body: String(r.text ?? ""), reply: String(r.reply ?? ""),
      is_public: r.public !== false, source: "dikidi", created_at: r.at || new Date().toISOString(),
    }));
    if (body.dryRun) return json({ ok: true, dryRun: true, report: { rows: out.length, linked: out.filter((r) => r.customer_id).length } });
    const { error } = await db.from("reviews").upsert(out, { onConflict: "dikidi_id" });
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, report: { rows: out.length, linked: out.filter((r) => r.customer_id).length } });
  }

  return json({ error: "unknown_kind" }, 422);
}
