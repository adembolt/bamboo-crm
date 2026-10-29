import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import type { WaBridge, WaState } from "@/lib/database.types";

/* Salondaki Mac'te çalışan WhatsApp köprüsünün (public/wa/bridge.mjs) tek uç noktası.
   Kimlik: "Authorization: Bearer <kurulum kodu>" → sha256(kod) == wa_bridge.token_hash.
   Bu sürüm SADECE durum (heartbeat) alır ve logout/restart komutu döndürür; mesaj göndermez. */

const MAX_BODY = 16 * 1024;
const STATES: WaState[] = ["starting", "qr", "connected", "reconnecting", "logged_out"];
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

const str = (v: unknown, max: number) => (typeof v === "string" && v.length ? v.slice(0, max) : null);
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function sameHash(a: string, b: string) {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === 32 && y.length === 32 && timingSafeEqual(x, y);
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  // 1) Ucuz kontroller (veritabanına gitmeden)
  const token = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1] ?? "";
  if (!TOKEN_RE.test(token)) return json({ error: "unauthorized" }, 401);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return json({ error: "too_large" }, 413);

  let raw: string;
  try { raw = await req.text(); } catch { return json({ error: "bad_request" }, 400); }
  if (raw.length > MAX_BODY) return json({ error: "too_large" }, 413);
  let b: Record<string, unknown>;
  try { b = JSON.parse(raw) as Record<string, unknown>; } catch { return json({ error: "bad_request" }, 400); }
  if (!b || typeof b !== "object" || Array.isArray(b)) return json({ error: "bad_request" }, 400);

  // 2) Kod doğrulama
  const db = createAdminClient();
  const { data: row, error } = await db.from("wa_bridge").select("token_hash, command").eq("id", 1).maybeSingle();
  if (error) return json({ error: "db" }, 500);
  const r = row as Pick<WaBridge, "token_hash" | "command"> | null;
  if (!r?.token_hash || !sameHash(sha256(token), r.token_hash)) return json({ error: "unauthorized" }, 401);

  if (b.action !== "heartbeat") return json({ error: "unknown_action" }, 400);

  // 3) Durum kaydı (bilinmeyen alanlar yok sayılır)
  const state: WaState = STATES.includes(b.state as WaState) ? (b.state as WaState) : "starting";
  const linked = state !== "qr" && state !== "logged_out";
  const { error: upErr } = await db.from("wa_bridge").update({
    state,
    qr: state === "qr" ? str(b.qr, 2048) : null,
    phone: linked ? str(b.phone, 32) : null,
    push_name: linked ? str(b.pushName, 100) : null,
    version: str(b.version, 60),
    host: str(b.host, 100),
    error: str(b.error, 300),
    last_seen: new Date().toISOString(),
  }).eq("id", 1);
  if (upErr) return json({ error: "db" }, 500);

  // 4) Bekleyen komut: bir kez döndür ve temizle (arada yenisi yazıldıysa ona dokunma)
  const command = r.command === "logout" || r.command === "restart" ? r.command : null;
  if (command) await db.from("wa_bridge").update({ command: null }).eq("id", 1).eq("command", command);

  return json({ command });
}
