// Regras 13 e 14 no Chromium de verdade, com a extensão carregada e Twitch/Kick simulados:
// instalação nova, Release mais novo simulado e atualização simulada, na página do site (sem abrir a sala),
// em cada idioma do navegador (--lang), e troca de idioma pelo seletor da sala.
// node e2e-regra14.mjs <pasta da extensão> <pasta de prints> <lang do navegador: pt-BR | en-US | es | fr>
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const [EXT, OUT, LANG = 'pt-BR'] = process.argv.slice(2);
const ESPERADO = LANG.startsWith('pt') ? 'pt' : LANG.startsWith('es') ? 'es' : 'en';
const T = {
  tutorial: { pt: 'Como usar a sala da Twitch', en: 'How to use the Twitch room', es: 'Cómo usar la sala de Twitch' },
  passo: { pt: 'Passo 1 de 5', en: 'Step 1 of 5', es: 'Paso 1 de 5' },
  novidades: { pt: 'Novidades da v', en: "What's new in v", es: 'Novedades de la v' },
  nova: { pt: 'Nova versão v9.9.9', en: 'New version v9.9.9', es: 'Nueva versión v9.9.9' },
  item: { pt: 'Coisa nova', en: 'New thing', es: 'Cosa nueva' },
  zip: { pt: 'Zip baixado', en: 'Zip downloaded', es: 'Zip descargado' },
  guia: { pt: '1. Instalar', en: '1. Install', es: '1. Instalar' },
};
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? 'OK     ' : 'FALHOU ') + `[${LANG}] ` + n + (!c && extra ? '\n       ' + extra : '')); if (!c) falhas++; };
const ctx = await chromium.launchPersistentContext('/tmp/claude-0/pw-r14-' + LANG + Date.now(), {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 860 }, locale: LANG,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, `--lang=${LANG}`, '--no-proxy-server'],
});
const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
const V = await sw.evaluate(() => chrome.runtime.getManifest().version);
const palco = (cor) => `<!doctype html><title>site</title><body style="margin:0;height:100vh;background:${cor};font:16px Arial;color:#fff"><div data-a-target="side-nav-bar"></div><h1 style="margin:40px">página do site</h1><button id="btsite" style="position:fixed;left:50%;top:80%">botão do site</button></body>`;
await ctx.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.protocol === 'chrome-extension:') return route.continue();
  if (url.host === 'www.twitch.tv') return route.fulfill({ contentType: 'text/html', body: palco('#18181b') });
  if (url.host === 'kick.com') return route.fulfill({ contentType: 'text/html', body: palco('#0b0e0f') });
  if (url.host === 'github.com') return route.fulfill({ contentType: 'application/zip', body: 'PK' });
  if (url.host === 'gql.twitch.tv') return route.fulfill({ headers: { 'access-control-allow-origin': 'https://www.twitch.tv', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*' }, json: { data: {} } });
  return route.abort();
});
// a página de boas-vindas (guia) abre sozinha na instalação: confere o idioma dela
await new Promise((r) => setTimeout(r, 1500));
const guia = ctx.pages().find((p) => p.url().includes('COMO-INSTALAR.html'));
if (guia) {
  await guia.waitForTimeout(500);
  const cls = await guia.evaluate(() => document.body.className);
  const vis = await guia.evaluate(() => [...document.querySelectorAll('#instalar h2')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.textContent).join('|'));
  ok(`guia abriu na instalação, no idioma do navegador (${ESPERADO})`, cls === ESPERADO && vis === T.guia[ESPERADO], cls + ' / ' + vis);
  await guia.screenshot({ path: `${OUT}/guia-${ESPERADO}.png` });
} else ok('guia abriu na instalação', false);

const avisos = (p) => p.locator('#plateia-avisos');
const textoQd = async (p) => (await avisos(p).locator('.qd').count()) ? avisos(p).locator('.qd').innerText() : '';

// 1) instalação nova: tutorial sozinho na página da Twitch (sem abrir a sala)
const p1 = await ctx.newPage();
await p1.goto('https://www.twitch.tv/algumcanal'); await p1.waitForTimeout(1500);
let t = await textoQd(p1);
ok('instalação nova: tutorial aparece sozinho na página da Twitch', t.includes(T.tutorial[ESPERADO]) && t.includes(T.passo[ESPERADO]), t.slice(0, 120));
ok('a sala não abriu', !(await p1.locator('#plateia-sala').count()));
const box = await avisos(p1).locator('.qd').boundingBox();
ok('quadro no meio da tela', box && Math.abs(box.x + box.width / 2 - 720) < 40 && Math.abs(box.y + box.height / 2 - 430) < 120, JSON.stringify(box));
await p1.screenshot({ path: `${OUT}/r14-tutorial-${ESPERADO}.png` });
// a página continua usável: clique no botão do site, fora do quadro
await p1.evaluate(() => { window.cliques = 0; document.getElementById('btsite').onclick = () => window.cliques++; });
await p1.mouse.click(720, 688);
ok('página continua clicável com o quadro aberto', (await p1.evaluate(() => window.cliques)) === 1);
await p1.keyboard.press('Escape'); await p1.waitForTimeout(300);
ok('Esc fecha', !(await avisos(p1).locator('.qd').count()));
const q = await sw.evaluate(async () => (await chrome.storage.local.get('quadros')).quadros);
ok('grava que viu', q && q.tutorial === true && q.novidades === V);
const p1b = await ctx.newPage(); await p1b.goto('https://kick.com/outrocanal'); await p1b.waitForTimeout(1500);
ok('não aparece de novo (nem na Kick)', !(await avisos(p1b).locator('.qd').count()));

// 2) atualização simulada (viu a 0.7.0): novidades da versão atual, sozinhas na página da Kick
await sw.evaluate(() => chrome.storage.local.set({ quadros: { tutorial: true, novidades: '0.7.0' }, atualizacao: { procuradoEm: Date.now() } }));
const p2 = await ctx.newPage(); await p2.goto('https://kick.com/algumcanal'); await p2.waitForTimeout(1500);
t = await textoQd(p2);
ok(`atualização: "${T.novidades[ESPERADO]}${V}" na página da Kick`, t.includes(T.novidades[ESPERADO] + V), t.slice(0, 120));
await p2.screenshot({ path: `${OUT}/r14-novidades-${ESPERADO}.png` });
await avisos(p2).locator('.qd-x').click(); await p2.waitForTimeout(300);

// 3) Release mais novo simulado: o fundo procura no GitHub (stub) e o aviso aparece sozinho na página já aberta
const p3 = await ctx.newPage(); await p3.goto('https://www.twitch.tv/outro'); await p3.waitForTimeout(1200);
ok('antes do Release novo: nenhum quadro', !(await avisos(p3).locator('.qd').count()));
await sw.evaluate(() => {
  const cl = (l, txt) => `(() => { const P = window.PLATEIA; P.CHANGELOG = P.CHANGELOG || {}; P.CHANGELOG.${l} = { '9.9.9': ['${txt} 1', '${txt} 2', "${txt} 3"], '0.8.0': ['x'] }; })();`;
  const files = { pt: cl('pt', 'Coisa nova'), en: cl('en', 'New thing'), es: cl('es', 'Cosa nueva') };
  const orig = self.fetch;
  self.fetch = (u, o) => {
    u = String(u);
    if (u.includes('api.github.com')) return Promise.resolve(new Response(JSON.stringify({ tag_name: 'v9.9.9', html_url: 'https://github.com/DredsGG/plateia/releases/tag/v9.9.9', body: '- release note',
      assets: [{ name: 'plateia-v9.9.9.zip', browser_download_url: 'https://github.com/DredsGG/plateia/releases/download/v9.9.9/plateia-v9.9.9.zip' }] }), { status: 200 }));
    const m = u.match(/raw\.githubusercontent\.com\/DredsGG\/plateia\/v9\.9\.9\/extension\/src\/changelog\/(\w+)\.js/);
    if (m) return Promise.resolve(new Response(files[m[1]], { status: 200 }));
    return orig(u, o);
  };
  return procurar();
});
await p3.waitForTimeout(800);
t = await textoQd(p3);
ok('Release novo: "Nova versão v9.9.9" aparece sozinho na página aberta', t.includes(T.nova[ESPERADO]), t.slice(0, 160));
ok('com o resumo do que mudou, no idioma', t.includes(T.item[ESPERADO] + ' 1') && t.includes(T.item[ESPERADO] + ' 3'));
await p3.screenshot({ path: `${OUT}/r14-versao-${ESPERADO}.png` });
const abas = ctx.pages().length;
await avisos(p3).locator('.qd-atualizar').click(); await p3.waitForTimeout(1200);
t = await textoQd(p3);
ok('Atualizar: baixa o zip do Release (Chromium) e diz o que fazer', ctx.pages().length > abas && t.includes(T.zip[ESPERADO]), t.slice(-160));
await p3.screenshot({ path: `${OUT}/r14-versao-baixou-${ESPERADO}.png` });
const p4 = await ctx.newPage(); await p4.goto('https://kick.com/x'); await p4.waitForTimeout(1500);
ok('aparece de novo na próxima abertura (Kick)', (await textoQd(p4)).includes(T.nova[ESPERADO]));
await avisos(p4).locator('.qd-x').click(); await p4.waitForTimeout(300);
const p5 = await ctx.newPage(); await p5.goto('https://www.twitch.tv/y'); await p5.waitForTimeout(1500);
ok('depois do X: não aparece mais nessa versão', !(await avisos(p5).locator('.qd').count()));

// 4) sala: seletor PT · EN · ES troca o idioma e grava
await sw.evaluate(() => chrome.storage.local.set({ atualizacao: { procuradoEm: Date.now() } }));
const s = await ctx.newPage(); await s.goto('https://www.twitch.tv/drops/inventory#plateia'); await s.waitForTimeout(2000);
const sala = s.locator('#plateia-sala');
ok('sala no idioma do navegador', (await sala.locator('.idioma.on').innerText()) === ESPERADO.toUpperCase());
for (const l of (ESPERADO === 'es' ? ['en', 'es', 'pt'] : ['es', 'en', 'pt'])) {
  await sala.locator(`.idioma[lang=${l}]`).click(); await s.waitForTimeout(2500);
  const st = await sw.evaluate(async () => (await chrome.storage.local.get('idioma')).idioma);
  const txt = await s.locator('#plateia-sala .assina').innerText();
  const esp = { pt: 'feito por', en: 'made by', es: 'hecho por' }[l];
  ok(`seletor → ${l.toUpperCase()}: grava e a sala recarrega em ${l}`, st === l && txt.startsWith(esp) && (await s.locator('#plateia-sala .idioma.on').innerText()) === l.toUpperCase(), st + ' / ' + txt);
  if (l === 'es') await s.screenshot({ path: `${OUT}/r14-sala-es.png` });
}
await ctx.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
process.exit(falhas ? 1 : 0);
