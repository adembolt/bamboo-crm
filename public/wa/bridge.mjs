#!/usr/bin/env node
// Bamboo CRM · WhatsApp köprüsü (salondaki Mac'te çalışır)
//
// Ne yapar:   WhatsApp'a "Bağlı cihaz" olarak bağlanır (QR ile) ve bağlı KALIR.
//             Durumunu her 10 sn'de (QR beklerken 2 sn'de) CRM'e bildirir.
// Ne YAPMAZ:  Bu sürüm HİÇBİR mesaj göndermez, gelen mesajları okumaz/işaretlemez/işlemez.
//             sendMessage hiçbir yerde çağrılmaz. Gönderim ileride, veritabanındaki
//             wa_bridge.send_enabled bayrağı ve wa_outbox kuyruğu ile ayrıca eklenecek.
//
// Ayarlar: ~/BambooWhatsApp/config.json  { "url": "https://…", "token": "…" }
// Oturum:  ~/BambooWhatsApp/auth  (yeniden başlatmada tekrar QR gerekmez)
// Log:     ~/BambooWhatsApp/bridge.log (~2 MB'ta kırpılır)

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import makeWASocket, { useMultiFileAuthState as loadMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } from "baileys";

const BRIDGE_VERSION = "1.0.0";
const HOME = process.env.BAMBOO_WA_HOME || path.join(os.homedir(), "BambooWhatsApp");
const AUTH_DIR = path.join(HOME, "auth");
const LOG_FILE = path.join(HOME, "bridge.log");
const PID_FILE = path.join(HOME, "bridge.pid");
const LOG_MAX = 2 * 1024 * 1024;
const LOG_KEEP = 256 * 1024;

fs.mkdirSync(HOME, { recursive: true });

// ---------- log ----------
let logWrites = 0;
function rotateIfNeeded() {
  try {
    const st = fs.statSync(LOG_FILE);
    if (st.size <= LOG_MAX) return;
    // Aynı dosyayı yerinde kırp (launchd'nin açık tuttuğu dosya tanıtıcısı geçerli kalsın)
    const fd = fs.openSync(LOG_FILE, "r");
    const buf = Buffer.alloc(LOG_KEEP);
    fs.readSync(fd, buf, 0, LOG_KEEP, st.size - LOG_KEEP);
    fs.closeSync(fd);
    fs.writeFileSync(LOG_FILE, Buffer.concat([Buffer.from(`--- log kırpıldı ${new Date().toISOString()} ---\n`), buf]));
  } catch { /* dosya yoksa sorun değil */ }
}
function log(level, ...parts) {
  const text = parts.map((p) => (typeof p === "string" ? p : safeJson(p))).join(" ");
  const line = `${new Date().toISOString()} [${level}] ${text}\n`;
  try {
    if (++logWrites % 50 === 0) rotateIfNeeded();
    fs.appendFileSync(LOG_FILE, line);
  } catch { /* log yazılamazsa çalışmaya devam */ }
}
function safeJson(v) {
  try {
    if (v instanceof Error) return `${v.name}: ${v.message}`;
    const s = JSON.stringify(v);
    return s && s.length > 1000 ? s.slice(0, 1000) + "…" : s;
  } catch { return String(v); }
}
// Baileys için sessiz logger: sadece warn/error dosyaya yazılır
const waLogger = {
  level: "warn",
  child() { return waLogger; },
  trace() {}, debug() {}, info() {},
  warn(obj, msg) { log("wa-warn", msg ?? "", obj); },
  error(obj, msg) { log("wa-error", msg ?? "", obj); },
};

// ---------- tek kopya kilidi ----------
try {
  const old = Number(fs.readFileSync(PID_FILE, "utf8"));
  if (old && old !== process.pid) {
    try { process.kill(old, 0); log("info", `başka bir kopya çalışıyor (pid ${old}), çıkılıyor`); process.exit(0); } catch { /* eski pid ölü */ }
  }
} catch { /* pid dosyası yok */ }
fs.writeFileSync(PID_FILE, String(process.pid));
const cleanupPid = () => { try { if (fs.readFileSync(PID_FILE, "utf8") === String(process.pid)) fs.unlinkSync(PID_FILE); } catch { /* yoksay */ } };
process.on("exit", cleanupPid);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { log("info", `${sig} alındı, çıkılıyor`); process.exit(0); });
process.on("uncaughtException", (e) => { log("error", "uncaughtException", e?.stack || e); process.exit(1); });
process.on("unhandledRejection", (e) => { log("error", "unhandledRejection", e?.stack || e); });

// ---------- ayarlar ----------
let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(HOME, "config.json"), "utf8"));
  if (!config.url || !config.token) throw new Error("url/token eksik");
} catch (e) {
  log("error", "config.json okunamadı:", e);
  console.error("config.json okunamadı:", e?.message || e);
  // launchd hemen tekrar başlatmasın diye biraz bekle
  setTimeout(() => process.exit(1), 30_000);
}
const ENDPOINT = config ? new URL("/api/wa/bridge", config.url).toString() : "";

// ---------- durum ----------
let state = "starting";        // starting | qr | connected | reconnecting | logged_out
let qr = null;
let lastError = null;
let waVersion = null;
let sock = null;
let generation = 0;            // eski soketlerin olaylarını yok saymak için
let backoffMs = 5_000;
let reconnectTimer = null;
let handlingCommand = false;
let lastMe = null;             // son bağlı hesap (yeniden bağlanırken de numara görünsün)

const me = () => sock?.user ?? lastMe;
const phoneOf = (u) => (u?.id ? "+" + String(u.id).split(":")[0].split("@")[0] : null);

function setState(next, extra = {}) {
  const changed = next !== state || ("qr" in extra && extra.qr !== qr);
  state = next;
  if ("qr" in extra) qr = extra.qr;
  if (next !== "qr") qr = null;
  if ("error" in extra) lastError = extra.error;
  if (changed) { log("info", `durum: ${next}`); scheduleHeartbeat(0); }
}

// ---------- heartbeat ----------
let hbTimer = null;
let hbInFlight = false;
let hbAgain = false;
let authFailCount = 0;

function scheduleHeartbeat(ms) {
  if (!ENDPOINT) return;
  // Gönderim sürerken gelen "hemen gönder" isteği, bitince hemen yeni bir sinyal olarak gider
  if (hbInFlight) { if (ms === 0) hbAgain = true; return; }
  clearTimeout(hbTimer);
  hbTimer = setTimeout(heartbeat, ms);
}

async function heartbeat() {
  if (hbInFlight) { hbAgain = true; return; }
  hbInFlight = true;
  let next = state === "qr" ? 2_000 : 10_000;
  try {
    const u = me();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({
        action: "heartbeat",
        state,
        qr: state === "qr" ? qr : null,
        phone: phoneOf(u),
        pushName: u?.name ?? u?.notify ?? null,
        version: `bridge ${BRIDGE_VERSION} · wa ${waVersion ? waVersion.join(".") : "?"}`,
        host: os.hostname(),
        error: lastError,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 401) {
      authFailCount++;
      if (authFailCount === 1 || authFailCount % 30 === 0) log("error", "Kurulum kodu geçersiz (401). Panelden yeni kod oluşturup install.sh'ı tekrar çalıştırın.");
      next = 60_000;
    } else if (!res.ok) {
      log("warn", `heartbeat HTTP ${res.status}`);
    } else {
      authFailCount = 0;
      const data = await res.json().catch(() => ({}));
      if (data?.command) await handleCommand(data.command);
    }
  } catch (e) {
    log("warn", "heartbeat gönderilemedi:", e?.message || e);
  } finally {
    hbInFlight = false;
    if (hbAgain) { hbAgain = false; next = 0; }
    scheduleHeartbeat(next);
  }
}

// ---------- komutlar (panelden) ----------
async function handleCommand(cmd) {
  if (handlingCommand) return;
  handlingCommand = true;
  try {
    log("info", `komut alındı: ${cmd}`);
    if (cmd === "restart") {
      // launchd (KeepAlive) programı ~10 sn içinde yeniden başlatır
      setTimeout(() => process.exit(0), 200);
      return;
    }
    if (cmd === "logout") {
      const old = sock;
      generation++; // eski soketin "close" olayını yok say
      clearTimeout(reconnectTimer);
      if (old) {
        try {
          await Promise.race([old.logout("panelden çıkış"), new Promise((r) => setTimeout(r, 8_000))]);
        } catch (e) { log("warn", "logout hatası:", e?.message || e); }
        try { old.end(undefined); } catch { /* yoksay */ }
      }
      sock = null;
      lastMe = null;
      clearAuth();
      setState("logged_out", { error: null });
      reconnectTimer = setTimeout(start, 3_000);
    }
  } finally {
    handlingCommand = false;
  }
}

function clearAuth() {
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); log("info", "oturum dosyaları silindi"); }
  catch (e) { log("error", "auth silinemedi:", e); }
}

// ---------- WhatsApp bağlantısı ----------
async function start() {
  clearTimeout(reconnectTimer);
  const gen = ++generation;
  try {
    const { state: authState, saveCreds } = await loadMultiFileAuthState(AUTH_DIR);
    if (gen !== generation) return;
    if (!waVersion) {
      try {
        const v = await fetchLatestBaileysVersion();
        waVersion = v.version;
      } catch (e) { log("warn", "WA sürümü alınamadı, varsayılan kullanılacak:", e?.message || e); }
    }
    const s = makeWASocket({
      auth: authState,
      ...(waVersion ? { version: waVersion } : {}),
      browser: Browsers.macOS("Bamboo CRM"),
      logger: waLogger,
      printQRInTerminal: false,
      markOnlineOnConnect: false,    // telefonda "çevrimiçi" görünmesin, bildirimler telefona gelmeye devam etsin
      syncFullHistory: false,        // geçmiş mesajlar istenmez (Baileys'in ilk LID eşlemesi için varsayılan kısa senkron kalır)
      generateHighQualityLinkPreview: false,
      getMessage: async () => undefined,
    });
    sock = s;

    s.ev.on("creds.update", saveCreds);
    s.ev.on("connection.update", (u) => {
      if (gen !== generation) return;
      if (u.qr) setState("qr", { qr: u.qr });
      if (u.connection === "open") {
        backoffMs = 5_000;
        lastMe = s.user ?? null;
        setState("connected", { error: null });
        log("info", `bağlandı: ${phoneOf(s.user) ?? "?"} (${s.user?.name ?? ""})`);
      }
      if (u.connection === "close") onClose(u.lastDisconnect?.error, authState.creds?.registered);
    });
    // BİLİNÇLİ OLARAK: messages.upsert / messages.update / chats.* dinlenmez. Gelen mesajlar
    // okunmaz, "okundu" yapılmaz, işlenmez.
    //
    // TODO (ileride, send_enabled = true olunca): burada CRM'den wa_outbox kuyruğu çekilip
    // sırayla gönderilecek. Bu sürümde KESİNLİKLE gönderim kodu yoktur.
  } catch (e) {
    log("error", "başlatma hatası:", e?.stack || e);
    setState("reconnecting", { error: String(e?.message || e) });
    scheduleReconnect(backoffMs);
    backoffMs = Math.min(backoffMs * 2, 60_000);
  }
}

function onClose(err, registered) {
  const code = err?.output?.statusCode;
  const msg = err?.message || String(err ?? "");
  log("info", `bağlantı kapandı: kod=${code ?? "-"} ${msg}`);
  sock = null;

  if (code === DisconnectReason.loggedOut) {
    // Telefondan "Bağlı cihazlar → Çıkış" yapıldı: oturumu sil, yeni QR göster
    lastMe = null;
    clearAuth();
    setState("logged_out", { error: null });
    scheduleReconnect(3_000);
    return;
  }
  if (code === DisconnectReason.restartRequired) {
    // QR okutulduktan hemen sonra WhatsApp yeniden bağlanmayı ister
    setState("reconnecting", { error: null });
    scheduleReconnect(500);
    return;
  }
  if (!registered) {
    // Henüz eşleşmemiş (QR süresi doldu vb.): kısa bekleyip yeni QR üret
    setState("reconnecting", { error: null });
    scheduleReconnect(3_000);
    return;
  }
  if (code === DisconnectReason.connectionReplaced) {
    setState("reconnecting", { error: "Aynı oturum başka bir yerde açıldı (connectionReplaced)" });
    scheduleReconnect(60_000);
    return;
  }
  setState("reconnecting", { error: msg.slice(0, 200) || null });
  scheduleReconnect(backoffMs);
  backoffMs = Math.min(backoffMs * 2, 60_000);
}

function scheduleReconnect(ms) {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(start, ms);
}

if (config) {
  log("info", `başlıyor · bridge ${BRIDGE_VERSION} · node ${process.version} · ${ENDPOINT}`);
  scheduleHeartbeat(0);
  start();
}
