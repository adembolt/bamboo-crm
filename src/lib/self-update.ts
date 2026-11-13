import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendFile } from "node:fs/promises";
import path from "node:path";

/* iMac'teki kopyanın kendini güncellemesi (Vercel'de çalışmaz):
   - geliştirme modunda (npm run dev) git pull yeterli, sayfa kendiliğinden yenilenir
   - üretim modunda (npm run start) pull + gerekirse npm install + build, sonra süreç kapanır;
     iMac kurulum betiğindeki LaunchAgent (KeepAlive) programı yeni sürümle yeniden başlatır */

const run = promisify(execFile);
const CWD = process.cwd();
const LOG = path.join(CWD, ".guncelleme.log");
export const isLocal = !process.env.VERCEL;
export const isDev = process.env.NODE_ENV === "development";
let busy = false;
let last: UpdateStatus | null = null;

export type UpdateStatus = { local: boolean; mode: "dev" | "prod"; current: string; latest: string; behind: number; dirty: boolean; checkedAt: string; error?: string; updating?: boolean; lastResult?: string };

async function git(...args: string[]) { const { stdout } = await run("git", args, { cwd: CWD, timeout: 120_000 }); return stdout.trim(); }
async function log(msg: string) { try { await appendFile(LOG, `${new Date().toISOString()} ${msg}\n`); } catch {} }

export async function checkUpdate(fetchRemote = true): Promise<UpdateStatus> {
  const base = { local: isLocal, mode: (isDev ? "dev" : "prod") as "dev" | "prod", checkedAt: new Date().toISOString(), updating: busy, lastResult: last?.lastResult };
  if (!isLocal) return { ...base, current: "", latest: "", behind: 0, dirty: false };
  try {
    if (fetchRemote) await git("fetch", "-q", "origin", "main");
    const [current, latest, behind, dirty] = await Promise.all([git("rev-parse", "--short", "HEAD"), git("rev-parse", "--short", "origin/main"), git("rev-list", "--count", "HEAD..origin/main"), git("status", "--porcelain", "--untracked-files=no")]);
    last = { ...base, current, latest, behind: Number(behind) || 0, dirty: dirty.length > 0 };
  } catch (e) {
    last = { ...base, current: "", latest: "", behind: 0, dirty: false, error: (e as Error).message.slice(0, 300) };
  }
  return last;
}

export async function applyUpdate(reason: string): Promise<{ ok: boolean; message: string; restarting?: boolean }> {
  if (!isLocal) return { ok: false, message: "Bu sürüm internette çalışıyor; orada güncelleme otomatik." };
  if (busy) return { ok: false, message: "Güncelleme zaten sürüyor." };
  busy = true;
  try {
    const before = await git("rev-parse", "HEAD");
    await git("fetch", "-q", "origin", "main");
    const dirty = await git("status", "--porcelain", "--untracked-files=no");
    if (dirty) { await git("stash", "push", "-m", `otomatik-guncelleme-${Date.now()}`); await log("yerel değişiklikler stash'e alındı"); }
    await git("merge", "--ff-only", "origin/main");
    const after = await git("rev-parse", "HEAD");
    if (before === after) { busy = false; return { ok: true, message: "Zaten güncel." }; }
    const changed = await git("diff", "--name-only", before, after);
    if (/^package(-lock)?\.json$/m.test(changed)) { await run("npm", ["install", "--no-audit", "--no-fund"], { cwd: CWD, timeout: 600_000 }); await log("npm install tamam"); }
    await log(`${reason}: ${before.slice(0, 7)} → ${after.slice(0, 7)}`);
    if (isDev) { busy = false; last = { ...(last ?? (await checkUpdate(false))), lastResult: `Güncellendi (${after.slice(0, 7)})` }; return { ok: true, message: "Güncellendi. Sayfa birkaç saniyede yenilenir." }; }
    await run("npm", ["run", "build"], { cwd: CWD, timeout: 900_000, maxBuffer: 50 * 1024 * 1024 });
    await log("build tamam, yeniden başlatılıyor");
    setTimeout(() => process.exit(0), 1500); // LaunchAgent yeniden başlatır
    return { ok: true, message: "Güncellendi; program yeniden başlıyor (yaklaşık 10 saniye).", restarting: true };
  } catch (e) {
    busy = false;
    const msg = (e as Error).message.slice(0, 400);
    await log(`HATA: ${msg}`);
    last = { ...(last ?? (await checkUpdate(false))), lastResult: `Hata: ${msg}` };
    return { ok: false, message: `Güncelleme yapılamadı: ${msg}` };
  }
}

/** Sunucu açıkken arka planda: 10 dakikada bir kontrol; geliştirme modunda hemen, üretim modunda gece 03:00–05:00 arası uygular */
export function startAutoUpdate() {
  if (!isLocal || process.env.BAMBOO_AUTO_UPDATE === "0") return;
  const tick = async () => {
    const s = await checkUpdate(true);
    if (!s.behind || s.error) return;
    const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Istanbul" }).format(new Date()));
    if (isDev || process.env.BAMBOO_AUTO_UPDATE === "always" || (hour >= 3 && hour < 5)) await applyUpdate("otomatik");
  };
  setTimeout(tick, 30_000);
  setInterval(tick, 10 * 60_000);
}
