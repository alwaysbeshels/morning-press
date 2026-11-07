#!/bin/sh
# Installe le relais d'impression comme agent launchd de l'utilisatrice (sans sudo).
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.local/share/morning-press"
CONFIG_DIR="$HOME/.config/morning-press"
AGENT="$HOME/Library/LaunchAgents/ca.morning-press.print.plist"
LOG="$HOME/Library/Logs/morning-press-print.log"

mkdir -p "$DEST" "$CONFIG_DIR" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cp "$HERE/print-today.sh" "$DEST/print-today.sh"
chmod 755 "$DEST/print-today.sh"
if [ ! -f "$CONFIG_DIR/relay.env" ]; then
  cp "$HERE/relay.env.example" "$CONFIG_DIR/relay.env"
  echo "Remplis $CONFIG_DIR/relay.env, puis relance ce script."
fi
chmod 600 "$CONFIG_DIR/relay.env"

INTERVALS=""
for hour in 7 8 9; do
  for minute in 05 15 25 35 45 55; do
    [ "$hour" = 7 ] && [ "$minute" -lt 35 ] && continue
    [ "$hour" = 9 ] && [ "$minute" -gt 25 ] && continue
    INTERVALS="$INTERVALS    <dict><key>Hour</key><integer>$hour</integer><key>Minute</key><integer>${minute#0}</integer></dict>\n"
  done
done

sed -e "s#__SCRIPT__#$DEST/print-today.sh#" -e "s#__LOG__#$LOG#" "$HERE/ca.morning-press.print.plist" \
  | awk -v intervals="$INTERVALS" '{ if ($0 == "__INTERVALS__") printf "%s", intervals; else print }' > "$AGENT"

launchctl bootout "gui/$(id -u)" "$AGENT" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT"
echo "Agent installé. Journal : $LOG"
echo "Pour réveiller le Mac chaque matin : sudo pmset repeat wakeorpoweron MTWRFSU 07:30:00"
