import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

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

  return json({ error: "unknown_kind" }, 422);
}
