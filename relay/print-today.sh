#!/bin/sh
# Relais d'impression de Mon Journal du Matin.
# Télécharge le PDF du jour depuis le Worker (jeton de service Cloudflare Access),
# puis l'envoie à l'imprimante du réseau local avec CUPS (`lp`).
# Fonctionne sur macOS et sur Raspberry Pi OS. N'imprime qu'une fois par édition.
set -eu

CONFIG="${MORNING_PRESS_CONFIG:-$HOME/.config/morning-press/relay.env}"
if [ ! -r "$CONFIG" ]; then
  echo "Configuration introuvable : $CONFIG" >&2
  exit 1
fi
# shellcheck disable=SC1090
. "$CONFIG"

: "${MORNING_PRESS_URL:?MORNING_PRESS_URL manquant}"
: "${CF_ACCESS_CLIENT_ID:?CF_ACCESS_CLIENT_ID manquant}"
: "${CF_ACCESS_CLIENT_SECRET:?CF_ACCESS_CLIENT_SECRET manquant}"
: "${PRINTER:?PRINTER manquant (voir lpstat -p)}"
STATE_DIR="${STATE_DIR:-$HOME/.local/state/morning-press}"
LP_OPTIONS="${LP_OPTIONS:--o sides=two-sided-long-edge -o media=Letter}"

mkdir -p "$STATE_DIR"
LAST_FILE="$STATE_DIR/last-printed"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Le secret est passé par un fichier d'en-têtes pour ne pas apparaître dans `ps`.
HEADERS="$TMP_DIR/headers"
umask 077
printf 'CF-Access-Client-Id: %s\nCF-Access-Client-Secret: %s\n' "$CF_ACCESS_CLIENT_ID" "$CF_ACCESS_CLIENT_SECRET" > "$HEADERS"

STATUS="$(curl --silent --show-error --location --max-time 60 \
  --header "@$HEADERS" \
  --dump-header "$TMP_DIR/response-headers" \
  --output "$TMP_DIR/journal.pdf" \
  --write-out '%{http_code}' \
  "${MORNING_PRESS_URL%/}/api/print/today.pdf")" || { echo "Réseau indisponible, nouvel essai plus tard." >&2; exit 0; }

case "$STATUS" in
  200) ;;
  404) echo "$(date '+%F %T') Journal du jour pas encore prêt."; exit 0 ;;
  *) echo "$(date '+%F %T') Réponse inattendue du serveur : HTTP $STATUS" >&2; exit 1 ;;
esac

EDITION_ID="$(tr -d '\r' < "$TMP_DIR/response-headers" | awk 'tolower($1) == "x-edition-id:" { print $2 }' | tail -n 1)"
if [ -z "$EDITION_ID" ] || ! head -c 5 "$TMP_DIR/journal.pdf" | grep -q '%PDF-'; then
  echo "$(date '+%F %T') Réponse reçue, mais ce n'est pas un PDF (jeton Access refusé ?)." >&2
  exit 1
fi

if [ -f "$LAST_FILE" ] && [ "$(cat "$LAST_FILE")" = "$EDITION_ID" ]; then
  exit 0
fi

# shellcheck disable=SC2086
lp -d "$PRINTER" -t "Mon Journal du Matin" $LP_OPTIONS "$TMP_DIR/journal.pdf"
printf '%s\n' "$EDITION_ID" > "$LAST_FILE"
echo "$(date '+%F %T') Édition $EDITION_ID envoyée à $PRINTER."
