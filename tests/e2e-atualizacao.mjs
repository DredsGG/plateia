import { chromium } from './pw.mjs';
import fs from 'fs';
const EXT = process.argv[2];
const ctx = await chromium.launchPersistentContext('/tmp/pw-perfil-upd-' + Date.now(), {
  channel: 'chromium', headless: true, viewport: { width: 1400, height: 860 },
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
});
const ATUAL = JSON.parse(fs.readFileSync(EXT + '/manifest.json', 'utf8')).version;
const NOVA = ATUAL.replace(/\d+$/, (n) => String(+n + 1));
const ok = (c, m) => console.log((c ? 'OK  ' : 'FALHOU ') + m);
await ctx.route('**/*', async (route) => {
  const url = route.request().url();
  if (url.startsWith('chrome-extension://')) return route.continue();
  if (url.startsWith('https://gql.twitch.tv/')) return route.fulfill({ headers: { 'access-control-allow-origin': 'https://www.twitch.tv', 'access-control-allow-headers': '*', 'access-control-allow-credentials': 'true' }, json: { data: {} } });
  if (url.startsWith('https://www.twitch.tv/')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Twitch</title><body style="margin:0;background:#0e0e10;color:#eee;font:20px sans-serif"><main style="padding:40px">página da Twitch</main></body>' });
  if (url.startsWith('https://github.com/')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>zip</title>download do zip' });
  // v0.9.7: pokeidle.io falso que manda o bloco da Twitch a cada 1 s (como o jogo pelo WebSocket, via pokeidle-ponte)
  if (url.startsWith('https://pokeidle.io/')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>PokeIdle</title><body>jogo<script>setInterval(() => window.postMessage({ plateia: "pokeidle-twitch", tw: { vinculado: true, login: "odreds", pct: 15, oficiais: [] } }, location.origin), 1000);</script></body>' });
  return route.abort();
});
const acharSw = async (ctx) => { for (let i = 0; i < 100; i++) { const w = ctx.serviceWorkers().find((x) => /\/src\/fundo\.js$/.test(x.url())); if (w) return w; await new Promise((r) => setTimeout(r, 100)); } return ctx.waitForEvent('serviceworker'); };
let sw = await acharSw(ctx);
{ const ex = await ctx.newPage(); await ex.goto('chrome://extensions'); await ex.evaluate(() => new Promise((ok) => chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }, ok))); await ex.close(); }
const extId = sw.url().split('/')[2];
await new Promise((r) => setTimeout(r, 1500));
// a instalação abre o guia
const guia = ctx.pages().find((p) => p.url().includes('COMO-INSTALAR.html'));
ok(!!guia, 'instalação abre o guia (#usar)');
if (guia) { await guia.reload(); await guia.waitForTimeout(800); await guia.screenshot({ path: 'upd-guia.png', fullPage: true }); }
// GitHub falso: release v0.4.1 com notas
const stub = async () => sw.evaluate((NOVA) => {
  const real = self.__fetchReal || (self.__fetchReal = self.fetch);
  self.fetch = (u, o) => String(u).includes('api.github.com') ? Promise.resolve(new Response(JSON.stringify({
    tag_name: 'v' + NOVA, html_url: 'https://github.com/DredsGG/plateia/releases/tag/v' + NOVA,
    body: '## O que mudou\n- **Corrige** o relógio do rodízio\n- Resgate da Kick mais rápido\n- Aviso de atualização com o que mudou',
    assets: [{ name: 'plateia-v' + NOVA + '.zip', browser_download_url: 'https://github.com/DredsGG/plateia/releases/download/v' + NOVA + '/plateia-v' + NOVA + '.zip' }],
  }), { headers: { 'content-type': 'application/json' } })) : real(u, o);
}, NOVA);
await stub();
// tutorial e novidades já vistos: o quadro de primeiro uso (v0.7.0) cobre a sala e intercepta o clique
await sw.evaluate((v) => chrome.storage.local.set({ quadros: { tutorial: true, novidades: v } }), ATUAL);
const p = await ctx.newPage();
await p.goto('https://www.twitch.tv/gaules');
await p.waitForTimeout(1200);
// sala: clica Procurar
await p.goto('https://www.twitch.tv/drops/inventory#plateia');
await p.waitForTimeout(2000);
const raiz = p.locator('#plateia-sala');
await raiz.locator('.upd-proc[title*="Procurar"]').click();
await p.waitForTimeout(1200);
const card = raiz.locator('.upd-card');
if (!(await card.count())) console.log('DBG', JSON.stringify(await sw.evaluate(async () => (await chrome.storage.local.get('atualizacao')).atualizacao)));
ok(await card.count() === 1, 'aviso dourado aparece');
const txt = await card.textContent();
ok(txt.includes('v' + ATUAL + ' → v' + NOVA), 'mostra versões: ' + txt.slice(0, 60));
ok(txt.includes('Corrige o relógio'), 'mostra o que mudou (sem **)');
await raiz.locator('aside').screenshot({ path: 'upd-sala-aviso.png' });
// Atualizar → abre o zip
const nova = ctx.waitForEvent('page');
await raiz.locator('.upd-bt:not(.sec)').click();
const aba = await nova;
await aba.waitForURL(/\.zip$/, { timeout: 8000 }).catch(() => {}); // o evento 'page' chega antes de a aba navegar (url vazia)
ok(aba.url().endsWith('plateia-v' + NOVA + '.zip'), 'Atualizar baixa o zip: ' + aba.url());
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
await p2.screenshot({ path: 'upd-botao.png', clip: { x: 0, y: 760, width: 260, height: 100 } }).catch(() => {}); // só evidência: a janela do CDP pode ser menor que 860 px
// Depois → some
await raiz.locator('.upd-bt.sec').click();
await p.waitForTimeout(500);
ok((await raiz.locator('.upd-card').count()) === 0, 'Depois esconde o aviso');
// aba do jogo aberta antes da atualização, marcada para saber se recarregou
const jogo = await ctx.newPage();
await jogo.goto('https://pokeidle.io/app');
await jogo.waitForTimeout(2500);
await jogo.evaluate(() => { window.__antesDaAtualizacao = true; });
const pkEm = async () => { try { return ((await sw.evaluate(async () => (await chrome.storage.local.get('pokeidle')).pokeidle)) || {}).em || 0; } catch (e) { return 0; } };
ok((await pkEm()) > Date.now() - 5000, 'antes de atualizar: o jogo aberto manda dados (pokeidle.em recente)');
// pasta: grava manifest novo → recarrega sozinha
const mf =JSON.parse(fs.readFileSync(EXT + '/manifest.json', 'utf8')); mf.version = NOVA;
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
// v0.9.7: a aba do jogo recarregou sozinha e voltou a mandar dados (sem F5 de quem usa)
let recarregou = null; for (let i = 0; i < 10 && recarregou === null; i++) { try { recarregou = await jogo.evaluate(() => !window.__antesDaAtualizacao); } catch (e) { await new Promise((r) => setTimeout(r, 500)); } }
ok(recarregou === true, 'depois de atualizar: a aba do PokeIdle recarregou sozinha');
// o guarda grava na hora quando o dado muda e, igual, 1x por minuto: vale qualquer gravação depois da versão nova na pasta (t0)
await new Promise((r) => setTimeout(r, 2000));
const em2 = await pkEm();
ok(em2 > t0, 'depois de atualizar: o jogo voltou a mandar dados à Plateia (pokeidle.em ' + Math.round((em2 - t0) / 1000) + ' s depois da versão nova na pasta)');
await ctx.close();
