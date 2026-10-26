// E2E do aviso de atualização: node e2e-atualizacao.mjs <cópia da pasta da extensão> (o teste altera o manifest da cópia)
import { chromium } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';
const EXT = path.resolve(process.argv[2]);
// versão da cópia e a "nova" que o GitHub falso anuncia (patch + 1)
const ATUAL = JSON.parse(fs.readFileSync(EXT + '/manifest.json', 'utf8')).version;
const NOVA = ATUAL.replace(/(\d+)$/, (n) => String(+n + 1));
const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'pw-perfil-upd-' + Date.now()), {
  channel: 'chromium', headless: true, viewport: { width: 1400, height: 860 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const ok = (c, m) => console.log((c ? 'OK  ' : 'FALHOU ') + m);
await ctx.route('**/*', async (route) => {
  const url = route.request().url();
  if (url.startsWith('chrome-extension://')) return route.continue();
  if (url.startsWith('https://gql.twitch.tv/')) return route.fulfill({ headers: { 'access-control-allow-origin': 'https://www.twitch.tv', 'access-control-allow-headers': '*', 'access-control-allow-credentials': 'true' }, json: { data: {} } });
  if (url.startsWith('https://www.twitch.tv/')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Twitch</title><body style="margin:0;background:#0e0e10;color:#eee;font:20px sans-serif"><main style="padding:40px">página da Twitch</main></body>' });
  if (url.startsWith('https://github.com/')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>zip</title>download do zip' });
  return route.abort();
});
let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
{ const ex = await ctx.newPage(); await ex.goto('chrome://extensions'); await ex.evaluate(() => new Promise((ok) => chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }, ok))); await ex.close(); }
const extId = sw.url().split('/')[2];
await new Promise((r) => setTimeout(r, 1500));
// a instalação abre o guia
const guia = ctx.pages().find((p) => p.url().includes('COMO-INSTALAR.html'));
ok(!!guia, 'instalação abre o guia (#usar)');
if (guia) { await guia.reload(); await guia.waitForTimeout(800); await guia.screenshot({ path: 'upd-guia.png', fullPage: true }); }
// GitHub falso: release vNOVA com notas
const stub = async () => sw.evaluate((NOVA) => {
  const real = self.__fetchReal || (self.__fetchReal = self.fetch);
  self.fetch = (u, o) => String(u).includes('api.github.com') ? Promise.resolve(new Response(JSON.stringify({
    tag_name: 'v' + NOVA, html_url: 'https://github.com/DredsGG/plateia/releases/tag/v' + NOVA,
    body: '## O que mudou\n- **Corrige** o relógio do rodízio\n- Resgate da Kick mais rápido\n- Aviso de atualização com o que mudou',
    assets: [{ name: 'plateia-v' + NOVA + '.zip', browser_download_url: 'https://github.com/DredsGG/plateia/releases/download/v' + NOVA + '/plateia-v' + NOVA + '.zip' }],
  }), { headers: { 'content-type': 'application/json' } })) : real(u, o);
}, NOVA);
await stub();
const p = await ctx.newPage();
await p.goto('https://www.twitch.tv/gaules');
await p.waitForTimeout(1200);
// sala: clica Procurar
await p.goto('https://www.twitch.tv/drops/inventory#plateia');
await p.waitForTimeout(2000);
const raiz = p.locator('#plateia-sala');
await raiz.locator('.upd-proc').click();
await p.waitForTimeout(1200);
const card = raiz.locator('.upd-card');
ok(await card.count() === 1, 'aviso dourado aparece');
const txt = await card.textContent();
ok(txt.includes(`v${ATUAL} → v${NOVA}`), 'mostra versões: ' + txt.slice(0, 60));
ok(txt.includes('Corrige o relógio'), 'mostra o que mudou (sem **)');
await raiz.locator('aside').screenshot({ path: 'upd-sala-aviso.png' });
// Atualizar → abre o zip
const nova = ctx.waitForEvent('page');
await raiz.locator('.upd-bt:not(.sec)').click();
const aba = await nova;
ok(aba.url().endsWith(`plateia-v${NOVA}.zip`), 'Atualizar baixa o zip: ' + aba.url());
await p.bringToFront();
await p.waitForTimeout(600);
ok((await raiz.locator('.upd-dica').count()) === 1, 'mostra dica de extrair por cima');
await raiz.locator('.upd-card').screenshot({ path: 'upd-baixado.png' });
// bolinha no botão em outra aba
const p2 = await ctx.newPage();
await p2.goto('https://www.twitch.tv/gaules');
await p2.waitForTimeout(1500);
const temBolinha = await p2.evaluate(() => { const hs = [...document.querySelectorAll('*')].filter((e) => e.shadowRoot); for (const h of hs) { const b = h.shadowRoot.querySelector('button.nova'); if (b) return b.title; } return null; });
ok(!!temBolinha, 'bolinha no botão Plateia: ' + temBolinha);
await p2.screenshot({ path: 'upd-botao.png', clip: { x: 0, y: 760, width: 260, height: 100 } });
// Depois → some
await raiz.locator('.upd-bt.sec').click();
await p.waitForTimeout(500);
ok((await raiz.locator('.upd-card').count()) === 0, 'Depois esconde o aviso');
// pasta: grava manifest novo → recarrega sozinha
const mf = JSON.parse(fs.readFileSync(EXT + '/manifest.json', 'utf8')); mf.version = NOVA;
fs.writeFileSync(EXT + '/manifest.json', JSON.stringify(mf, null, 2));
await sw.evaluate(() => vigiarDisco());
const t0 = Date.now();
let ver = null;
while (Date.now() - t0 < 40000) {
  await new Promise((r) => setTimeout(r, 1000));
  const s = ctx.serviceWorkers().find((w) => w.url().includes(extId));
  try { ver = s && await s.evaluate(() => chrome.runtime.getManifest().version); } catch (e) { ver = null; }
  if (ver === NOVA) { sw = s; break; }
}
ok(ver === NOVA, 'recarregou sozinha na versão da pasta em ' + Math.round((Date.now() - t0) / 1000) + ' s');
await new Promise((r) => setTimeout(r, 3500));
const salaPg = ctx.pages().find((x) => x.url().includes('/drops/inventory'));
const ok2 = salaPg && await salaPg.evaluate(() => { const h = document.getElementById('plateia-sala'); const e = h && h.shadowRoot.querySelector('.upd-ok'); return e ? e.textContent : null; });
ok(!!ok2, 'sala reabriu com aviso verde: ' + ok2);
if (salaPg) await salaPg.locator('#plateia-sala aside').screenshot({ path: 'upd-atualizada.png' });
await ctx.close();
