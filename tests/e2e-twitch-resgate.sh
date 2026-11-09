#!/usr/bin/env bash
# Roda o e2e-twitch-resgate.mjs neste Windows: o Node não consegue abrir o chrome.exe do Playwright (spawn UNKNOWN),
# mas o shell consegue. Abre o Chrome para Testing com a extensão, conecta por CDP e o próprio teste fecha o Chrome no fim
# (Browser.close; nunca use taskkill por nome, ele mataria o Chrome de quem usa).
# Uso: PW_DIR=<pasta com node_modules/playwright> ./e2e-twitch-resgate.sh <pasta da extensão> <pasta de saída> [porta]
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
EXT="$1"; OUT="$2"; PORTA="${3:-9335}"
CHROME="${CHROME_TESTE:-$HOME/AppData/Local/ms-playwright/chromium-1254/chrome-win64/chrome.exe}"
PERFIL="${TMPDIR:-/tmp}/pw-e2e-resgate-$(date +%s)"
cd "$(dirname "$CHROME")"
./chrome.exe --headless=new --no-first-run --remote-debugging-port="$PORTA" --user-data-dir="$PERFIL" \
  --disable-extensions-except="$EXT" --load-extension="$EXT" about:blank >/dev/null 2>&1 &
for i in $(seq 1 30); do curl -s "http://127.0.0.1:$PORTA/json/version" >/dev/null && break; sleep 1; done
cd "$AQUI"
# o Browser.close nem sempre derruba o Chrome headless: depois do teste, encerra só os processos DESTA instância
# (linha de comando com a porta de depuração e o ms-playwright); nunca o Chrome de quem usa o PC
encerrar() { powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*--remote-debugging-port=$PORTA*' -and \$_.CommandLine -like '*ms-playwright*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" || true; }
trap encerrar EXIT
CDP="http://127.0.0.1:$PORTA" node e2e-twitch-resgate.mjs "$EXT" "$OUT"
