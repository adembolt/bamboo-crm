"use server";
import { createHash, randomBytes } from "node:crypto";
import { requireManager } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import type { WaState } from "@/lib/database.types";

/* Panel ↔ wa_bridge. Oturum istemcisi kullanılır (RLS: is_manager); token_hash sütununa SELECT
   yetkisi yoktur (bkz. 0013_whatsapp_bridge.sql), bu yüzden hep açık sütun listesi seçilir. */

const STALE_SEC = 45;

export type WaStatus = {
  state: WaState;
  online: boolean;
  qr: string | null;
  phone: string | null;
  pushName: string | null;
  version: string | null;
  host: string | null;
  error: string | null;
  ageSec: number | null;
  hasToken: boolean;
  tokenCreatedAt: string | null;
  command: string | null;
};

type Res<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function getWaStatus(): Promise<Res<WaStatus>> {
  try {
    const { supabase } = await requireManager();
    const { data, error } = await supabase.from("wa_bridge")
      .select("state, qr, phone, push_name, version, host, error, last_seen, command, token_created_at")
      .eq("id", 1).maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: (await getT())("WhatsApp tablosu bulunamadı (SQL uygulanmamış olabilir).") };
    // Yaş sunucu saatine göre hesaplanır (tarayıcı saati yanlış olabilir)
    const ageSec = data.last_seen ? Math.max(0, Math.round((Date.now() - new Date(data.last_seen).getTime()) / 1000)) : null;
    const online = ageSec !== null && ageSec <= STALE_SEC;
    return { ok: true, data: {
      state: data.state as WaState,
      online,
      qr: online && data.state === "qr" ? data.qr : null,
      phone: data.phone, pushName: data.push_name, version: data.version, host: data.host, error: data.error,
      ageSec, hasToken: !!data.token_created_at, tokenCreatedAt: data.token_created_at, command: data.command,
    } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Yeni kurulum kodu: 32 bayt rastgele (base64url). DB'de sadece SHA-256 hex'i tutulur; eskisi geçersiz olur. */
export async function createSetupCode(): Promise<Res<{ code: string }>> {
  try {
    const { supabase } = await requireManager();
    const code = randomBytes(32).toString("base64url");
    const token_hash = createHash("sha256").update(code).digest("hex");
    const { error } = await supabase.from("wa_bridge").update({ token_hash, token_created_at: new Date().toISOString() }).eq("id", 1);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { code } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Mac'teki programa komut: bir sonraki sinyalde alınır ve sunucuda temizlenir. */
export async function sendWaCommand(command: "logout" | "restart"): Promise<Res> {
  try {
    if (command !== "logout" && command !== "restart") return { ok: false, error: "bad_command" };
    const { supabase } = await requireManager();
    const { error } = await supabase.from("wa_bridge").update({ command }).eq("id", 1);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
