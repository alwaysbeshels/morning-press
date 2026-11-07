# Relais d'impression automatique

L'imprimante HP Smart Tank 6000 ne prend pas en charge HP ePrint : elle n'imprime que ce qu'un appareil du réseau local lui envoie (AirPrint/IPP).
Le relais est un petit appareil de la maison (Raspberry Pi, Mac ou iPhone) qui, chaque matin, télécharge le PDF du jour puis l'envoie à l'imprimante.

```
Cron Cloudflare → Workflow → PDF dans KV
                                   ↑  GET /api/print/today.pdf (jeton de service Access)
                         Relais (Pi / Mac / iPhone) → imprimante (IPP, réseau local)
```

## 1. Côté Cloudflare (une seule fois)

1. Zero Trust → Access → Service Auth → Service Tokens → **Create Service Token** (« morning-press-relais », durée sans expiration ou 1 an).
   Noter le **Client ID** (se termine par `.access`) et le **Client Secret** (affiché une seule fois).
2. Zero Trust → Access → Applications → application du Worker → **Policies** → ajouter une politique :
   action **Service Auth**, règle *Include* → *Service Token* → « morning-press-relais ».
3. Associer le jeton à l'adresse autorisée (le relais agit en son nom, en lecture seule) :
   ```sh
   echo "XXXXXXXX.access=alwaysbeshels@gmail.com" | npx wrangler secret put PRINT_RELAY_TOKENS
   ```
   Plusieurs jetons : séparer par des virgules. Révoquer un relais : supprimer le jeton dans Zero Trust.

Le Worker n'accepte ce jeton que pour `GET /api/print/today.pdf` ; toute autre route répond 403.

Vérification :
```sh
curl -sS -o /tmp/journal.pdf -w '%{http_code}\n' \
  -H "CF-Access-Client-Id: XXXXXXXX.access" -H "CF-Access-Client-Secret: ..." \
  https://morning-press.alwaysbeshels.workers.dev/api/print/today.pdf
```
`200` : PDF du jour ; `404` : pas encore prêt (le relais réessaie plus tard).

## 2a. Raspberry Pi (recommandé : toujours allumé, ~2 W)

Raspberry Pi OS Lite (64 bits), Wi-Fi configuré dans Raspberry Pi Imager, puis :

```sh
sudo apt update && sudo apt install -y cups curl git
sudo usermod -aG lpadmin "$USER"
# Trouver l'imprimante (AirPrint) :
lpinfo --include-schemes dnssd -v
sudo lpadmin -p HP_Smart_Tank_6000 -E -v "ipp://HP-Smart-Tank-6000.local/ipp/print" -m everywhere
lp -d HP_Smart_Tank_6000 /usr/share/cups/data/testprint   # page d'essai

git clone https://github.com/alwaysbeshels/morning-press.git ~/morning-press   # ou copier le dossier relay/
mkdir -p ~/.config/morning-press
cp ~/morning-press/relay/relay.env.example ~/.config/morning-press/relay.env
chmod 600 ~/.config/morning-press/relay.env
nano ~/.config/morning-press/relay.env
~/morning-press/relay/print-today.sh     # essai manuel
crontab -e                                # coller la ligne de relay/morning-press-print.cron
```

Le fuseau du Pi doit être `America/Toronto` (`sudo raspi-config` → Localisation).

## 2b. Mac (si le Mac reste branché, couvercle fermé ou non)

```sh
cd ~/Documents/GitHub/morning-press/relay
./install-macos.sh            # crée ~/.config/morning-press/relay.env au premier passage
nano ~/.config/morning-press/relay.env
./install-macos.sh            # installe l'agent launchd
sudo pmset repeat wakeorpoweron MTWRFSU 07:30:00
```

L'agent tente l'impression toutes les 10 minutes de 7 h 35 à 9 h 25 ; si le Mac dormait, launchd rattrape l'essai manqué au réveil.
Nom de l'imprimante : `lpstat -p`. Journal : `~/Library/Logs/morning-press-print.log`.
Le Mac doit être sur le secteur : le réveil programmé n'est pas garanti sur batterie.

## 2c. iPhone (Raccourcis, sans matériel)

Automatisation personnelle → **Heure de la journée** (7 h 45, chaque jour) → **Exécuter immédiatement** :
1. **Obtenir le contenu de l'URL** : `https://morning-press.alwaysbeshels.workers.dev/api/print/today.pdf`, méthode GET,
   en-têtes `CF-Access-Client-Id` et `CF-Access-Client-Secret`.
2. **Imprimer** (imprimante : HP Smart Tank 6000).

Limites : iOS affiche souvent la fenêtre d'impression et demande une confirmation ; l'iPhone doit être déverrouillé au moins une fois et sur le même Wi-Fi que l'imprimante.
