// Resgate automático do bônus do PokeIdle na Twitch, no Chromium de verdade com a extensão carregada (v0.9.4).
// A Twitch é FALSA: toda a rede é interceptada e as páginas dos canais trazem um painel de pontos igual ao medido
// em 2026-11-09 (botão de saldo -> .reward-center__content -> detalhe com "Resgatar <custo>" -> 2º clique compra).
// Nenhum ponto real é gasto e nada sai para a Twitch de verdade.
// node e2e-twitch-resgate.mjs <pasta da extensão> <pasta de saída>
// (precisa do playwright: PW_DIR=<pasta com node_modules/playwright>)
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import os from 'os';
const req = createRequire(path.join(process.env.PW_DIR || process.cwd(), 'x.js'));
const { chromium } = req('playwright');
const [EXT, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? 'OK     ' : 'FALHOU ') + n + (!c && extra ? '\n       ' + extra : '')); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const RECOMPENSAS = [
  ['Destacar minha mensagem', 99], ['Bônus +15% XP PokeIdle', 300], ['Bônus de +15% Capture Boost', 500], ['Bônus +15% XP PokeIdle (3h)', 900],
  ['Bônus de +15% Secret Lure', 1000], ['Bônus +15% XP PokeIdle (5h)', 1500], ['Bônus +15% XP PokeIdle (10h)', 3000], ['Bônus de +15% Capture Boost (10h)', 5000],
  ['Bônus de +15% Secret Lure (10h)', 10000], ['ESCOLHER SKIN DO HOMEM ', 8000]];

// página de um canal da Twitch falsa: o widget de pontos e o painel, falando com o "servidor" (esta função) por fetch
const PAGINA_CANAL = `<!doctype html><meta charset="utf-8"><title>live</title>
<body style="margin:0;background:#0e0e10;color:#fff;font:14px Arial">
<div class="chat-scrollable-area__message-container" id="chat"></div>
<div data-test-selector="community-points-summary"><button aria-label="Saldos de Pontos e Bits" id="pts">...</button></div>
<script>
const canal = location.pathname.split('/').filter(Boolean)[0];
const fmt = (n) => Number(n).toLocaleString('pt-BR');
const api = async (rota, corpo) => (await fetch('/__fake/' + rota, { method: 'POST', body: JSON.stringify(Object.assign({ canal }, corpo || {})) })).json();
let painel = null;
const fechar = () => { if (painel) { painel.remove(); painel = null; } };
const novoPainel = () => { fechar(); painel = document.createElement('div'); painel.className = 'reward-center__content'; document.body.appendChild(painel); return painel; };
const cab = (voltar) => { const d = document.createElement('div'); if (voltar) { const v = document.createElement('button'); v.setAttribute('aria-label', 'Voltar'); v.onclick = lista; d.appendChild(v); }
  const x = document.createElement('button'); x.setAttribute('aria-label', 'Fechar'); x.onclick = fechar; d.appendChild(x); return d; };
async function lista() {
  const cfg = await api('config');
  const p = novoPainel(); p.appendChild(cab(false));
  for (const r of cfg.recompensas) {
    const b = document.createElement('button'); const i = document.createElement('img'); i.alt = r.nome; b.appendChild(i);
    const c = document.createElement('span'); c.className = 'reward-icon__cost'; c.textContent = fmt(r.custo); b.appendChild(c);
    b.onclick = () => detalhe(r); p.appendChild(b);
  }
}
async function detalhe(r) {
  await api('log', { e: 'detalhe ' + r.nome });
  const p = novoPainel(); p.appendChild(cab(true));
  const t = document.createElement('h4'); t.textContent = r.nome; p.appendChild(t);
  const rb = document.createElement('button'); rb.textContent = 'Resgatar ' + fmt(r.custo);
  rb.onclick = async () => {
    const j = await api('redeem', { nome: r.nome, custo: r.custo });
    if (j.ok) { const l = document.createElement('div'); l.textContent = 'odreds resgatou ' + r.nome + ' ' + fmt(r.custo); document.getElementById('chat').appendChild(l); }
    atualizarSaldo(); fechar();
  };
  p.appendChild(rb);
}
async function atualizarSaldo() { const j = await api('saldo'); document.getElementById('pts').textContent = fmt(j.saldo); }
document.getElementById('pts').onclick = async () => { if (painel) fechar(); else { await api('log', { e: 'abrir ' + canal }); lista(); } };
atualizarSaldo();
</script>`;

// Neste Windows o Node não consegue abrir o chrome.exe do Playwright (spawn UNKNOWN), mas o shell consegue:
// por isso o script de apoio e2e-twitch-resgate.sh abre o Chrome com a extensão e este arquivo conecta por CDP (CDP=http://127.0.0.1:porta).
// Sem CDP, abre o Chromium sozinho (Linux/CI).
let browser, ctx, sw, V, mundo = null;
async function iniciar() {
  if (process.env.CDP) {
    browser = await chromium.connectOverCDP(process.env.CDP);
    ctx = browser.contexts()[0];
    for (let i = 0; i < 100 && !sw; i++) { sw = ctx.serviceWorkers().find((w) => /\/src\/fundo\.js$/.test(w.url())); if (!sw) await espera(100); }
  } else {
    ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'pw-resgate-' + Date.now()), {
      channel: 'chromium', headless: true, viewport: { width: 1440, height: 860 }, locale: 'pt-BR',
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--lang=pt-BR', '--no-proxy-server'] });
    sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  }
  V = await sw.evaluate(() => chrome.runtime.getManifest().version);
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.protocol === 'chrome-extension:' || url.protocol === 'data:' || url.protocol === 'chrome:') return route.continue();
    mundo.rede.push(req.method() + ' ' + url.host + url.pathname);
    if (url.host === 'gql.twitch.tv') {
      const cors = { 'access-control-allow-origin': 'https://www.twitch.tv', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      const q = (JSON.parse(req.postData() || '{}').query) || '';
      if (q.includes('inventory')) return route.fulfill({ headers: cors, json: { data: { currentUser: { inventory: { dropCampaignsInProgress: [] } } } } });
      const data = {};
      for (const m of q.matchAll(/(c\d+):user\(login:"([^"]+)"\)/g)) {
        const l = m[2];
        data[m[1]] = { login: l, displayName: l, profileImageURL: '', stream: mundo.vivos.has(l) ? { id: '1', viewersCount: 10, game: { displayName: 'Jogo' } } : null,
          channel: { self: { communityPoints: { balance: mundo.saldos[l] === undefined ? null : mundo.saldos[l] } } } };
      }
      return route.fulfill({ headers: cors, json: { data } });
    }
    if (url.host === 'www.twitch.tv') {
      if (url.pathname.startsWith('/__fake/')) {
        const corpo = JSON.parse(req.postData() || '{}');
        const rota = url.pathname.replace('/__fake/', '');
        if (rota === 'saldo') return route.fulfill({ json: { saldo: mundo.saldos[corpo.canal] } });
        if (rota === 'config') return route.fulfill({ json: { recompensas: mundo.recompensas } });
        if (rota === 'log') { mundo.log.push(corpo.e); return route.fulfill({ json: {} }); }
        if (rota === 'redeem') { mundo.log.push('RESGATAR ' + corpo.canal + ' ' + corpo.nome); mundo.compras.push({ canal: corpo.canal, nome: corpo.nome, custo: corpo.custo }); mundo.saldos[corpo.canal] -= corpo.custo; return route.fulfill({ json: { ok: true } }); }
        return route.fulfill({ status: 404, body: '' });
      }
      if (url.pathname.startsWith('/drops/inventory')) return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>sala</title><body style="margin:0;background:#0e0e10"></body>' });
      return route.fulfill({ contentType: 'text/html', body: PAGINA_CANAL });
    }
    return route.fulfill({ status: 404, body: '' }); // GitHub etc.: nada sai daqui
  });
  await ctx.addCookies([{ name: 'auth-token', value: 'fake', url: 'https://www.twitch.tv' }, { name: 'login', value: 'odreds', url: 'https://www.twitch.tv' }]);
  for (const p of ctx.pages()) if (p.url().includes('COMO-INSTALAR')) await p.close().catch(() => {});
}
async function encerrar() {
  if (process.env.CDP) { const s = await browser.newBrowserCDPSession(); await s.send('Browser.close').catch(() => {}); } else await ctx.close();
}

async function cenario(nome, { saldos, semXp10, pkExtra = {}, esperaMax = 80000 }) {
  console.log('\n== ' + nome);
  mundo = { saldos: Object.assign({}, saldos), vivos: new Set(Object.keys(saldos)), log: [], compras: [], rede: [],
    recompensas: RECOMPENSAS.filter(([n]) => !(semXp10 && n === 'Bônus +15% XP PokeIdle (10h)')).map(([n, c]) => ({ nome: n, custo: c })) };
  await sw.evaluate(() => chrome.storage.local.clear());
  const semear = (extra) => sw.evaluate(([v, canais, extra]) => chrome.storage.local.set({
    idioma: 'pt', quadros: { tutorial: true, novidades: v }, atualizacao: { procuradoEm: Date.now(), atual: v, ultima: v, disponivel: false },
    config: { canais: canais.map((login) => ({ login, mostrar: false, modo: 'rodizio' })), seguirPokeidle: false, vagas: 2, rodizio: false, presencaChat: false, qualidadeBaixa: false, dropsAuto: false, bauAuto: false, v020: true },
    pokeidle: Object.assign({ vinculado: true, login: 'odreds', assistindo: false, pct: 15, lives: [], assistindoEm: [], minutos: 60, em: Date.now(),
      oficiais: canais.map((l) => ({ login: l, nome: l, bonus: true, ativo: true, aoVivo: true })) }, extra)
  }), [V, Object.keys(saldos), extra]);
  await semear(pkExtra);
  const pagina = await ctx.newPage();
  await pagina.setViewportSize({ width: 1440, height: 860 }).catch(() => {});
  await pagina.goto('https://www.twitch.tv/drops/inventory#plateia');
  await pagina.waitForSelector('#plateia-sala', { state: 'attached' });
  // dados novos do jogo depois de as lives carregarem (é o gatilho natural; sem isso o ciclo roda no tique de 30 s)
  await espera(11000); await semear(pkExtra);
  // espera as compras acabarem: 12 s sem compra nova (ou o limite)
  let ultimo = -1, parado = 0;
  for (let t = 0; t < esperaMax; t += 1000) {
    await espera(1000);
    if (mundo.compras.length === ultimo) parado++; else { parado = 0; ultimo = mundo.compras.length; }
    if (parado >= 12) break;
  }
  return { pagina, sw, mundo, fechar: async () => { await pagina.close().catch(() => {}); } };
}

await iniciar();
// ---------- cenário A: compra feliz XP -> Capture -> Lure ----------
{
  const t0 = Date.now();
  const { pagina, mundo, fechar } = await cenario('A: três compras (saldo 20.000 no canala)', { saldos: { canala: 20000, canalb: 500 } });
  const nomes = mundo.compras.map((c) => c.nome + '@' + c.canal).join(' | ');
  ok('comprou na ordem XP -> Capture Boost -> Secret Lure, todos de 10 h, no canal que cobre', nomes === 'Bônus +15% XP PokeIdle (10h)@canala | Bônus de +15% Capture Boost (10h)@canala | Bônus de +15% Secret Lure (10h)@canala', nomes);
  const seq = mundo.log.filter((e) => /^(abrir|detalhe|RESGATAR)/.test(e));
  ok('cada compra = abrir o painel, abrir o detalhe, resgatar (nunca resgata sem abrir o detalhe antes)', seq.length === 9 && seq.every((e, i) => e.startsWith(['abrir', 'detalhe', 'RESGATAR'][i % 3])), seq.join(' | '));
  ok('saldo do canal: 20.000 - 18.000 = 2.000; o do outro canal intacto', mundo.saldos.canala === 2000 && mundo.saldos.canalb === 500, JSON.stringify(mundo.saldos));
  const reg = await sw.evaluate(async () => (await chrome.storage.local.get('twitchResgates')).twitchResgates);
  ok('twitchResgates gravado com as 3 compras confirmadas', Array.isArray(reg) && reg.length === 3 && reg.every((r) => r.ok && r.canal === 'canala' && r.via), JSON.stringify(reg));
  const hora = (reg || []).map((r) => r.em);
  ok('intervalo entre compras: 3 a 5 s (mais o tempo do clique)', hora.length === 3 && hora[0] - hora[1] >= 3000 && hora[0] - hora[1] < 7500 && hora[1] - hora[2] >= 3000 && hora[1] - hora[2] < 7500, hora.join());
  const tam = await pagina.evaluate(() => [...document.getElementById('plateia-sala').shadowRoot.querySelectorAll('iframe')].map((f) => f.getBoundingClientRect().width + 'x' + f.getBoundingClientRect().height));
  ok('as lives que compraram são os iframes escondidos de 2x2 px (nada aparece para quem usa)', tam.length === 2 && tam.every((x) => x === '2x2'), tam.join());
  const dentro = await pagina.evaluate(() => !!document.querySelector('.reward-center__content'));
  ok('a página principal da sala nunca recebeu o painel (o clique é só dentro da live)', !dentro);
  await pagina.evaluate(() => [...document.getElementById('plateia-sala').shadowRoot.querySelectorAll('.abas .aba')].find((b) => b.textContent.startsWith('PokeIdle')).click());
  const aba = await pagina.evaluate(() => document.getElementById('plateia-sala').shadowRoot.querySelector('.aba-pk').textContent.replace(/\s+/g, ' '));
  ok('aba PokeIdle: 3 bônus ativos com hora de fim, últimos resgates, sem "te vê"', (aba.match(/até \d{2}:\d{2}/g) || []).length === 3 && /Últimos resgates/.test(aba) && /Capture Boost 10h/.test(aba) && !/te vê/.test(aba), aba.slice(0, 300));
  await pagina.locator('#plateia-sala aside').first().screenshot({ path: path.join(OUT, 'resgate-aba-pokeidle.png') }).catch(async () => { await pagina.screenshot({ path: path.join(OUT, 'resgate-aba-pokeidle.png') }); });
  const extras = mundo.rede.filter((r) => !/twitch\.tv/.test(r));
  ok('nada saiu para fora da Twitch falsa (nem para a Twitch real)', extras.every((r) => /api\.github\.com/.test(r)) , extras.join(' | '));
  console.log('       (cenário A levou ' + Math.round((Date.now() - t0) / 1000) + ' s)');
  await fechar();
}

// ---------- cenário B: nome da recompensa diferente -> não compra, para e mostra o erro ----------
{
  const { pagina, mundo, fechar } = await cenario('B: recompensa XP (10h) com outro nome', { saldos: { canala: 20000, canalb: 0 }, semXp10: true, esperaMax: 30000 });
  ok('não comprou nada e não abriu o detalhe de nenhuma recompensa', mundo.compras.length === 0 && !mundo.log.some((e) => /^detalhe/.test(e)), mundo.log.join(' | '));
  const reg = await sw.evaluate(async () => (await chrome.storage.local.get('twitchResgates')).twitchResgates);
  ok('registrou o motivo (recompensa não encontrada) e parou', Array.isArray(reg) && reg.length === 1 && reg[0].ok === false && /não encontrada/.test(reg[0].erro), JSON.stringify(reg));
  await pagina.evaluate(() => [...document.getElementById('plateia-sala').shadowRoot.querySelectorAll('.abas .aba')].find((b) => b.textContent.startsWith('PokeIdle')).click());
  const aba = await pagina.evaluate(() => document.getElementById('plateia-sala').shadowRoot.querySelector('.aba-pk').textContent.replace(/\s+/g, ' '));
  ok('a aba mostra o erro e a hora da próxima tentativa', /Resgate parado: .*não encontrada/.test(aba) && /Tenta de novo às \d{2}:\d{2}/.test(aba), aba.slice(0, 300));
  await fechar();
}

// ---------- cenário C: não empilha (bônus com mais de 1 h) ----------
{
  const { mundo, fechar } = await cenario('C: os três bônus ainda têm horas (o jogo informa o fim)', { saldos: { canala: 50000, canalb: 50000 },
    pkExtra: { bonus: { xp: Date.now() + 5 * 3600e3, captura: Date.now() + 5 * 3600e3, shiny: Date.now() + 5 * 3600e3 } }, esperaMax: 30000 });
  ok('não empilha: nenhuma compra, nenhum painel aberto', mundo.compras.length === 0 && !mundo.log.length, mundo.log.join(' | '));
  await fechar();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
process.exit(falhas ? 1 : 0);
