#!/usr/bin/env bash
# Roda um E2E em Chromium neste Windows: abre o Chrome para Testing pelo shell (o Node não consegue), com a extensão
# carregada, e o teste conecta por CDP (ver pw.mjs). Ao fim encerra só os processos DESTA instância (porta de depuração
# + ms-playwright); nunca o Chrome de quem usa o PC.
# Uso: PW_DIR=<pasta com node_modules/playwright> ./e2e-cdp.sh <pasta da extensão> <script.mjs> [outros argumentos do script]
#      (o script recebe a pasta da extensão como 1º argumento; LANG_CHROME muda o idioma do navegador, padrão pt-BR)
set -e
AQUI="$(cd "$(dirname "$0")" && pwd)"
EXT="$1"; SCRIPT="$2"; shift 2
PORTA="${PORTA_CDP:-9336}"
IDIOMA="${LANG_CHROME:-pt-BR}"
CHROME="${CHROME_TESTE:-$HOME/AppData/Local/ms-playwright/chromium-1254/chrome-win64/chrome.exe}"
PERFIL="${TMPDIR:-/tmp}/pw-e2e-cdp-$(date +%s)"
cd "$(dirname "$CHROME")"
./chrome.exe --headless=new --no-first-run --remote-debugging-port="$PORTA" --user-data-dir="$PERFIL" --lang="$IDIOMA" --no-proxy-server \
  --disable-extensions-except="$EXT" --load-extension="$EXT" about:blank >/dev/null 2>&1 &
for i in $(seq 1 30); do curl -s "http://127.0.0.1:$PORTA/json/version" >/dev/null && break; sleep 1; done
encerrar() { powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { \$_.CommandLine -like '*--remote-debugging-port=$PORTA*' -and \$_.CommandLine -like '*ms-playwright*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }" || true; }
trap encerrar EXIT
cd "${E2E_CWD:-$AQUI}"
CDP="http://127.0.0.1:$PORTA" node "$AQUI/$SCRIPT" "$EXT" "$@"
