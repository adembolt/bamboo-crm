#!/bin/bash
# Bamboo CRM · WhatsApp bağlantı programı kurulumu (macOS, yönetici şifresi gerekmez)
# Kullanım:  curl -fsSL https://bamboo-crm-tau.vercel.app/wa/install.sh | bash
set -euo pipefail

SITE="${BAMBOO_WA_SITE:-https://bamboo-crm-tau.vercel.app}"
APP_DIR="$HOME/BambooWhatsApp"
NODE_DIR="$APP_DIR/node"
LABEL="com.bamboobeauty.whatsapp"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$APP_DIR/bridge.log"
NODE_MAJOR_WANTED=22

say()  { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mHATA:\033[0m %s\n' "$*" >&2; exit 1; }

echo
echo "  Bamboo CRM · WhatsApp bağlantı programı kurulumu"
echo "  (Bu program sadece WhatsApp'a bağlı kalır, hiçbir mesaj göndermez.)"
echo

[ "$(uname -s)" = "Darwin" ] || die "Bu kurulum sadece macOS (Mac) içindir."
case "$(uname -m)" in
  arm64)  NODE_ARCH="arm64" ;;
  x86_64) NODE_ARCH="x64" ;;
  *) die "Desteklenmeyen işlemci: $(uname -m)" ;;
esac
# Rosetta altında çalışan x64 kabuk Apple Silicon'da: yerel arm64 Node kullan
if [ "$NODE_ARCH" = "x64" ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = "1" ]; then NODE_ARCH="arm64"; fi

mkdir -p "$APP_DIR" "$HOME/Library/LaunchAgents"
chmod 700 "$APP_DIR"

# ---------- 1) Node.js ----------
NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  SYS_NODE="$(command -v node)"
  SYS_MAJOR="$("$SYS_NODE" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
  if [ "${SYS_MAJOR:-0}" -ge 20 ] 2>/dev/null; then
    NODE_BIN="$SYS_NODE"
    say "Sistemdeki Node.js kullanılacak: $("$NODE_BIN" -v) ($NODE_BIN)"
  fi
fi
if [ -z "$NODE_BIN" ] && [ -x "$NODE_DIR/bin/node" ]; then
  NODE_BIN="$NODE_DIR/bin/node"
  say "Daha önce indirilen Node.js kullanılacak: $("$NODE_BIN" -v)"
fi
if [ -z "$NODE_BIN" ]; then
  say "Node.js $NODE_MAJOR_WANTED LTS indiriliyor (nodejs.org, $NODE_ARCH)…"
  BASE_URL="https://nodejs.org/dist/latest-v${NODE_MAJOR_WANTED}.x"
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  curl -fsSL "$BASE_URL/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt" || die "Node.js sürüm listesi indirilemedi (internet bağlantısını kontrol edin)."
  TARBALL="$(awk '{print $2}' "$TMP/SHASUMS256.txt" | grep -E "^node-v[0-9.]+-darwin-${NODE_ARCH}\.tar\.gz$" | head -n1)"
  [ -n "$TARBALL" ] || die "Uygun Node.js paketi bulunamadı."
  curl -fSL --progress-bar "$BASE_URL/$TARBALL" -o "$TMP/$TARBALL" || die "Node.js indirilemedi."
  EXPECTED="$(grep " $TARBALL\$" "$TMP/SHASUMS256.txt" | awk '{print $1}')"
  ACTUAL="$(shasum -a 256 "$TMP/$TARBALL" | awk '{print $1}')"
  [ "$EXPECTED" = "$ACTUAL" ] || die "Node.js dosyası doğrulanamadı (SHA-256 uyuşmuyor)."
  rm -rf "$NODE_DIR"
  mkdir -p "$NODE_DIR"
  tar -xzf "$TMP/$TARBALL" -C "$NODE_DIR" --strip-components 1
  NODE_BIN="$NODE_DIR/bin/node"
  say "Node.js kuruldu: $("$NODE_BIN" -v)"
fi
NODE_BIN_DIR="$(cd "$(dirname "$NODE_BIN")" && pwd)"
export PATH="$NODE_BIN_DIR:$PATH"
NPM_BIN="$NODE_BIN_DIR/npm"
[ -x "$NPM_BIN" ] || NPM_BIN="$(command -v npm || true)"
[ -n "$NPM_BIN" ] || die "npm bulunamadı."

# ---------- 2) Program dosyaları ----------
say "Program dosyaları indiriliyor ($SITE)…"
curl -fsSL "$SITE/wa/bridge.mjs"   -o "$APP_DIR/bridge.mjs.new"   || die "bridge.mjs indirilemedi."
curl -fsSL "$SITE/wa/package.json" -o "$APP_DIR/package.json.new" || die "package.json indirilemedi."
mv -f "$APP_DIR/bridge.mjs.new" "$APP_DIR/bridge.mjs"
mv -f "$APP_DIR/package.json.new" "$APP_DIR/package.json"

say "Gerekli paketler kuruluyor (1-2 dakika sürebilir)…"
( cd "$APP_DIR" && "$NPM_BIN" install --omit=dev --no-audit --no-fund --loglevel=error ) || die "npm install başarısız oldu."

# ---------- 3) Kurulum kodu ----------
CODE="${BAMBOO_WA_CODE:-}"
if [ -z "$CODE" ]; then
  [ -r /dev/tty ] || die "Kod girilemiyor (terminal yok). BAMBOO_WA_CODE=... ile çalıştırın."
  echo
  echo "  Panelde: Ayarlar → WhatsApp bağlantısı → \"Kurulum kodu oluştur\""
  printf "  Kurulum kodunu yapıştırıp Enter'a basın: "
  IFS= read -r CODE < /dev/tty || true
fi
CODE="$(printf '%s' "$CODE" | tr -d '[:space:]')"
printf '%s' "$CODE" | grep -Eq '^[A-Za-z0-9_-]{32,128}$' || die "Kod geçersiz görünüyor. Panelden kopyalayıp tekrar deneyin."

say "Kod kontrol ediliyor…"
HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$SITE/api/wa/bridge" \
  -H "Authorization: Bearer $CODE" -H "Content-Type: application/json" \
  --data "{\"action\":\"heartbeat\",\"state\":\"starting\",\"host\":\"$(hostname -s 2>/dev/null | tr -cd 'A-Za-z0-9._-')\",\"version\":\"installer\"}" || echo 000)"
case "$HTTP_CODE" in
  200) say "Kod doğru." ;;
  401) die "Kod kabul edilmedi. Panelde yeni bir kod oluşturup tekrar deneyin (her yeni kod eskisini geçersiz kılar)." ;;
  *)   warn "Sunucuya ulaşılamadı (HTTP $HTTP_CODE). Kurulum devam ediyor; program internet gelince bağlanır." ;;
esac

( umask 077; printf '{\n  "url": "%s",\n  "token": "%s"\n}\n' "$SITE" "$CODE" > "$APP_DIR/config.json" )
chmod 600 "$APP_DIR/config.json"

# ---------- 4) Otomatik başlatma (LaunchAgent) ----------
say "Otomatik başlatma ayarlanıyor…"
# caffeinate -i: program çalışırken Mac'in boşta uykuya geçmesini engeller (ekran yine kapanabilir)
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-i</string>
    <string>$NODE_BIN</string>
    <string>$APP_DIR/bridge.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$APP_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$NODE_BIN_DIR:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>BAMBOO_WA_HOME</key><string>$APP_DIR</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
plutil -lint "$PLIST" >/dev/null || die "LaunchAgent dosyası hatalı."

UID_NUM="$(id -u)"
launchctl bootout "gui/$UID_NUM/$LABEL" >/dev/null 2>&1 || launchctl unload "$PLIST" >/dev/null 2>&1 || true
sleep 1
if ! launchctl bootstrap "gui/$UID_NUM" "$PLIST" >/dev/null 2>&1; then
  launchctl load -w "$PLIST" || die "Program başlatılamadı (launchctl)."
fi

sleep 3
if launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1 || launchctl list | grep -q "$LABEL"; then
  echo
  say "Kurulum tamam! Program arka planda çalışıyor ve bilgisayar her açıldığında kendiliğinden başlayacak."
  echo
  echo "  Şimdi panelde Ayarlar → WhatsApp bağlantısı sayfasını açın."
  echo "  Birkaç saniye içinde QR kodu görünecek. Telefonda:"
  echo "    WhatsApp → Ayarlar → Bağlı cihazlar → Cihaz bağla → QR'ı okutun."
  echo
  echo "  Not: Bu Mac kapalıyken veya uyku modundayken bağlantı panelde \"Bağlantı yok\" görünür."
  echo "  Log dosyası: $LOG"
  echo "  Kaldırmak için: curl -fsSL $SITE/wa/uninstall.sh | bash"
  echo
else
  die "Program başlamadı. Log: $LOG"
fi
