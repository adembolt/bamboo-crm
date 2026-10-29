#!/bin/bash
# Bamboo CRM · WhatsApp bağlantı programını durdurur ve otomatik başlatmayı kaldırır.
# Kullanım:  curl -fsSL https://bamboo-crm-tau.vercel.app/wa/uninstall.sh | bash
set -uo pipefail

LABEL="com.bamboobeauty.whatsapp"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
APP_DIR="$HOME/BambooWhatsApp"
UID_NUM="$(id -u)"

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }

say "Program durduruluyor…"
launchctl bootout "gui/$UID_NUM/$LABEL" >/dev/null 2>&1 || true
[ -f "$PLIST" ] && launchctl unload -w "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"

# Elle başlatılmış ya da artakalan kopya varsa onu da durdur
if [ -f "$APP_DIR/bridge.pid" ]; then
  PID="$(cat "$APP_DIR/bridge.pid" 2>/dev/null || true)"
  if [ -n "$PID" ] && ps -p "$PID" -o command= 2>/dev/null | grep -q "bridge.mjs"; then kill "$PID" 2>/dev/null || true; fi
  rm -f "$APP_DIR/bridge.pid"
fi
pkill -f "$APP_DIR/bridge.mjs" >/dev/null 2>&1 || true

echo
say "Kaldırıldı. Program artık çalışmıyor ve bilgisayar açılınca başlamayacak."
echo
echo "  Not: WhatsApp oturum dosyaları ve ayarlar $APP_DIR klasöründe duruyor."
echo "  Telefonda WhatsApp → Ayarlar → Bağlı cihazlar listesinden \"Bamboo CRM\" cihazını da çıkarabilirsiniz."
echo "  Klasörü tamamen silmek isterseniz:  rm -rf \"$APP_DIR\""
echo
