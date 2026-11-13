#!/bin/zsh
# Bamboo CRM — iMac kurulumu: programı arka planda sürekli çalıştırır, bilgisayar açılınca başlatır,
# güncellemeden sonra kendiliğinden yeniden başlatır. Kullanım (CRM klasöründe):  zsh scripts/imac-kurulum.sh
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="com.bamboobeauty.crm"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/bamboo-crm.log"
NPM="$(command -v npm)"
[ -z "$NPM" ] && { echo "npm bulunamadı. Önce Node.js kurulu olmalı."; exit 1; }
echo "CRM klasörü: $DIR"
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "3000 portunda çalışan bir program var (muhtemelen 'npm run dev'). Onu Terminal'de Ctrl+C ile kapatın ve betiği tekrar çalıştırın."
  exit 1
fi
cd "$DIR"
git pull --ff-only origin main || true
npm install --no-audit --no-fund
npm run build
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>-lc</string><string>cd "$DIR" && exec "$NPM" run start -- -p 3000</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo ""
echo "Tamam. Bamboo CRM arka planda çalışıyor: http://localhost:3000/panel"
echo "Bilgisayar açılınca kendiliğinden başlar; yeni sürümler gece 03:00–05:00 arası kendiliğinden kurulur,"
echo "isterseniz paneldeki 'Şimdi güncelle' düğmesiyle hemen kurabilirsiniz. Kayıt dosyası: $LOG"
