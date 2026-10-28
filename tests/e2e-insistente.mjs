// Regra 14 (revisada 27/10 20h) no Chromium de verdade, com a página da Twitch JÁ ABERTA:
// Release mais novo simulado → aviso aparece sem recarregar (alarme de 30 min e ao voltar para a aba),
// X adia e o aviso volta sozinho, Release "URGENTE" sem X e com a automação pausada até atualizar
// (a atualização de verdade é gravar a versão nova na pasta: a extensão se recarrega sozinha).
// node e2e-insistente.mjs <CÓPIA da pasta da extensão> <pasta de prints>
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const [EXT, OUT = '/tmp'] = process.argv.slice(2);
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? 'OK     ' : 'FALHOU ') + n + (!c && extra ? '\n       ' + extra : '')); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await chromium.launchPersistentContext('/tmp/claude-0/pw-insist-' + Date.now(), {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 860 }, locale: 'pt-BR',
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--lang=pt-BR', '--no-proxy-server'],
});
const ATUAL = JSON.parse(fs.readFileSync(EXT + '/manifest.json', 'utf8')).version;
await ctx.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.protocol === 'chrome-extension:') return route.continue();
  if (url.host === 'gql.twitch.tv') return route.fulfill({ headers: { 'access-control-allow-origin': 'https://www.twitch.tv', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*' }, json: { data: {} } });
  if (url.host === 'www.twitch.tv') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>Twitch</title><body style="margin:0;height:100vh;background:#0e0e10;color:#eee;font:20px sans-serif"><main style="padding:40px">canal</main></body>' });
  if (url.host === 'github.com') return route.fulfill({ contentType: 'application/zip', body: 'PK' });
  return route.abort();
});
let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
const extId = sw.url().split('/')[2];
{ const ex = await ctx.newPage(); await ex.goto('chrome://extensions'); await ex.evaluate(() => new Promise((r) => chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true }, r))); await ex.close(); }
await espera(1200);
for (const p of ctx.pages()) if (p.url().includes('COMO-INSTALAR')) await p.close();
await sw.evaluate((v) => chrome.storage.local.set({ quadros: { tutorial: true, novidades: v }, atualizacao: { procuradoEm: Date.now(), atual: v, ultima: v, disponivel: false } }), ATUAL);
// GitHub falso controlado pelo teste
const release = async (r) => sw.evaluate((r) => {
  self.__rel = r;
  if (!self.__fetchReal) {
    self.__fetchReal = self.fetch; self.__idas = 0;
    self.fetch = (u, o) => {
      u = String(u);
      if (u.includes('api.github.com')) { self.__idas++; return Promise.resolve(new Response(JSON.stringify(self.__rel), { status: 200 })); }
      const m = u.match(/raw\.githubusercontent\.com\/DredsGG\/plateia\/[^/]+\/extension\/src\/changelog\/(\w+)\.js/);
      if (m) return Promise.resolve(new Response(`P.CHANGELOG.${m[1]} = { '${self.__rel.tag_name.slice(1)}': ['Correção ${m[1]} 1', 'Correção ${m[1]} 2'] };`, { status: 200 }));
      return self.__fetchReal(u, o);
    };
  }
}, r);
const idas = () => sw.evaluate(() => self.__idas || 0);
const rel = (v, nome) => ({ tag_name: 'v' + v, name: nome || ('v' + v), body: '- nota', html_url: 'https://github.com/DredsGG/plateia/releases/tag/v' + v, assets: [{ name: `plateia-v${v}.zip`, browser_download_url: `https://github.com/DredsGG/plateia/releases/download/v${v}/plateia-v${v}.zip` }] });
const N1 = ATUAL.replace(/\d+$/, (n) => String(+n + 1)), N2 = ATUAL.replace(/\d+$/, (n) => String(+n + 2));
await release(rel(ATUAL));

const p = await ctx.newPage();
await p.goto('https://www.twitch.tv/umcanal'); await p.waitForTimeout(1500);
const qd = () => p.locator('#plateia-avisos .qd');
const texto = async () => ((await qd().count()) ? qd().innerText() : '');
ok('página aberta, sem Release novo: nenhum quadro', !(await qd().count()));

// 1) alarme de 30 min acha o Release novo → aparece na página já aberta, sem recarregar
await release(rel(N1));
await sw.evaluate(() => procurar()); // o mesmo que o alarme "plateia-procura" faz a cada 30 min
await p.waitForTimeout(800);
ok(`alarme de 30 min: "Nova versão v${N1}" aparece na página aberta, sem recarregar`, (await texto()).includes('Nova versão v' + N1) && (await texto()).includes('Correção pt 1'));
const alarme = await sw.evaluate(() => chrome.alarms.get('plateia-procura'));
ok('alarme do fundo a cada 30 min', alarme && alarme.periodInMinutes === 30);
await p.screenshot({ path: OUT + '/insist-1-nova.png' });

// 2) X adia; volta sozinho quando o adiamento acaba (relógio da página), sem recarregar
await p.locator('#plateia-avisos .qd-x').click(); await p.waitForTimeout(400);
const ad = await sw.evaluate(async () => (await chrome.storage.local.get('atualizacao')).atualizacao);
ok('X fecha e adia por 1 h', !(await qd().count()) && Math.abs(ad.adiadoAte - Date.now() - 3600e3) < 10000 && ad.adiadoVersao === N1);
await sw.evaluate(async () => { const { atualizacao: a } = await chrome.storage.local.get('atualizacao'); a.adiadoAte = Date.now() + 15000; await chrome.storage.local.set({ atualizacao: a }); });
await p.waitForTimeout(3000);
ok('adiado (faltando 15 s): continua escondido', !(await qd().count()));
await p.waitForTimeout(32000);
ok('passou o adiamento: o aviso volta sozinho na mesma página', (await texto()).includes('Nova versão v' + N1));

// 3) voltar para a aba: confere de novo (se a última procura tem mais de 10 min)
await p.locator('#plateia-avisos .qd-x').click(); await p.waitForTimeout(300);
await sw.evaluate(async () => { const { atualizacao: a } = await chrome.storage.local.get('atualizacao'); a.procuradoEm = Date.now() - 11 * 60000; await chrome.storage.local.set({ atualizacao: a }); });
await release(rel(N2));
const antes = await idas();
const outra = await ctx.newPage(); await outra.goto('about:blank'); await outra.bringToFront(); await p.waitForTimeout(500);
await p.bringToFront();
// no Chromium sem janela (headless) a aba nunca fica "escondida": o evento de voltar para a aba é disparado na página
await p.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
await p.waitForTimeout(1500);
ok(`voltar para a aba: procurou no GitHub e "Nova versão v${N2}" apareceu (mesmo com a anterior adiada)`, (await idas()) > antes && (await texto()).includes('Nova versão v' + N2), 'idas ' + antes + '→' + (await idas()) + ' / ' + (await texto()).slice(0, 60));
const antes2 = await idas();
await outra.bringToFront(); await p.waitForTimeout(300); await p.bringToFront();
await p.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); }); await p.waitForTimeout(1200);
ok('voltar de novo em menos de 10 min: não vai ao GitHub outra vez', (await idas()) === antes2);
await outra.close();

// 4) URGENTE: sem X, Esc não fecha, automação pausa (baú não é pego, sala sem lives)
await sw.evaluate(async () => { const { atualizacao: a } = await chrome.storage.local.get('atualizacao'); a.procuradoEm = 0; await chrome.storage.local.set({ atualizacao: a }); });
await release(rel(N2, `v${N2} URGENTE: corrige o baú`));
await sw.evaluate(() => procurar()); await p.waitForTimeout(800);
const tu = await texto();
ok('Release "URGENTE": quadro urgente aparece sozinho, sem X', tu.includes('Atualização urgente v' + N2) && !(await p.locator('#plateia-avisos .qd-x').count()));
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
ok('urgente: Esc não fecha', (await qd().count()) === 1);
await p.screenshot({ path: OUT + '/insist-2-urgente.png' });
await p.evaluate(() => { window.cliques = 0; const b = document.createElement('button'); b.innerHTML = '<div class="claimable-bonus__icon"></div>'; b.onclick = () => window.cliques++; document.querySelector('main').appendChild(b); });
await p.waitForTimeout(4000);
ok('urgente: o baú NÃO é pego', (await p.evaluate(() => window.cliques)) === 0);
await sw.evaluate(() => chrome.storage.local.set({ config: { canais: [{ login: 'umcanal', mostrar: true, modo: 'fixo' }], v020: true, presencaChat: false } }));
const s = await ctx.newPage(); await s.goto('https://www.twitch.tv/drops/inventory#plateia'); await s.waitForTimeout(2500);
const sala = s.locator('#plateia-sala');
ok('urgente: a sala abre com o quadro travando (fundo escuro, sem X) e o chip de pausa', (await sala.locator('.qd-fundo.urgente .qd').count()) === 1 && !(await sala.locator('.qd-fundo.urgente .qd-x').count()) && (await sala.locator('.chips').innerText()).includes('Pausada'));
ok('urgente: nenhuma live tocando na sala', !(await sala.locator('.palco iframe').count()));
await s.screenshot({ path: OUT + '/insist-3-sala-urgente.png' });

// 5) atualizar de verdade: a versão nova chega na pasta, a extensão se recarrega e tudo volta
const mf = JSON.parse(fs.readFileSync(EXT + '/manifest.json', 'utf8')); mf.version = N2;
fs.writeFileSync(EXT + '/manifest.json', JSON.stringify(mf, null, 2));
await sw.evaluate(() => vigiarDisco());
const t0 = Date.now(); let ver = null;
while (Date.now() - t0 < 45000) {
  await espera(1000);
  const w = ctx.serviceWorkers().find((x) => x.url().includes(extId));
  try { ver = w && await w.evaluate(() => chrome.runtime.getManifest().version); } catch (e) { ver = null; }
  if (ver === N2) { sw = w; break; }
}
ok(`atualizou: a extensão se recarregou na v${N2}`, ver === N2);
await espera(3000);
const p2 = await ctx.newPage(); await p2.goto('https://www.twitch.tv/outrocanal'); await p2.waitForTimeout(2000);
const t2 = (await p2.locator('#plateia-avisos .qd').count()) ? await p2.locator('#plateia-avisos .qd').innerText() : '';
ok('depois de atualizar: sem aviso urgente', !/urgente/i.test(t2));
await p2.evaluate(() => { window.cliques = 0; const b = document.createElement('button'); b.innerHTML = '<div class="claimable-bonus__icon"></div>'; b.onclick = () => window.cliques++; document.querySelector('main').appendChild(b); });
await p2.waitForTimeout(4000);
ok('depois de atualizar: o baú volta a ser pego', (await p2.evaluate(() => window.cliques)) === 1);
await ctx.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
process.exit(falhas ? 1 : 0);
