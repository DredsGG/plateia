// Testes da sala da Kick (jsdom, Kick simulada): PokeIdle, vagas em modo foco, resgate em pacote,
// trava sem vínculo, Daily Reward, Drops, aba PokeIdle, assinatura.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom'); // instalar com: npm i jsdom
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const manifest = JSON.parse(ler('manifest.json'));
let falhas = 0;
const ok = (n, c) => { console.log((c ? 'OK     ' : 'FALHOU ') + n); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function montar({ vinculado = true, saldos, recompensas3 = true, diariaProg = 60, dropConectado = true }) {
  const store = {}, ouvintes = [];
  store.pokeidleKick = { vinculado, login: 'dredsgg', pct: 0, minutos: 60, em: Date.now(),
    bonus: { xp: Date.now() + 80 * 60000, captura: 0, shiny: 0 },
    oficiais: [{ slug: 'matta', nome: 'matta', aoVivo: true, ativo: true }, { slug: 'yoda', nome: 'yoda', aoVivo: true, ativo: true }, { slug: 'jukes', nome: 'jukes', aoVivo: true, ativo: true }, { slug: 'offline1', nome: 'off', aoVivo: false, ativo: true }],
    recompensas: [{ tipo: 'xp', custo: 300 }, { tipo: 'captura', custo: 500 }, { tipo: 'shiny', custo: 1000 }] };
  const vivos = new Set(['matta', 'yoda', 'jukes']);
  const pts = Object.assign({ matta: 100, yoda: 1500, jukes: 900, offline1: 0 }, saldos || {});
  const chamadas = [];
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://kick.com/drops/claimed#plateia', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.document.cookie = 'session_token=1%7Cabc';
  w.chrome = {
    runtime: { getManifest: () => manifest },
    storage: { local: {
      get: async (k) => ({ [k]: store[k] === undefined ? undefined : JSON.parse(JSON.stringify(store[k])) }),
      set: async (o) => { const m = {}; for (const [k, v] of Object.entries(o)) { m[k] = { newValue: v }; store[k] = JSON.parse(JSON.stringify(v)); } ouvintes.forEach((f) => f(m, 'local')); } },
      onChanged: { addListener: (f) => ouvintes.push(f) } }
  };
  w.crypto.randomUUID = () => 'uuid-' + Math.random().toString(16).slice(2);
  const resp = (obj, status = 200) => ({ ok: status < 400, status, json: async () => obj });
  w.fetch = async (url, opt = {}) => {
    const u = String(url).replace('https://kick.com', '');
    const metodo = opt.method || 'GET';
    chamadas.push({ metodo, u, corpo: opt.body ? JSON.parse(opt.body) : null, auth: opt.headers && opt.headers.Authorization });
    let m;
    if (u === '/api/v1/user') return resp({ username: 'DredsGG' });
    if ((m = u.match(/^\/api\/v2\/channels\/([^/]+)$/))) return resp({ id: 1, user: { username: m[1], profile_pic: '' }, livestream: vivos.has(m[1]) ? { id: 9, is_live: true, viewer_count: 100, categories: [{ name: 'Just Chatting' }] } : null });
    if ((m = u.match(/^\/api\/v2\/channels\/([^/]+)\/points$/))) return resp({ data: { points: pts[m[1]] } });
    if ((m = u.match(/^\/api\/v2\/channels\/([^/]+)\/rewards$/))) return resp({ data: [
      { id: 'r-xp-' + m[1], title: 'Bônus +15% XP PokeIdle', description: '1 hora de +15% de XP no PokeIdle', cost: 300, is_enabled: true, is_paused: false, is_user_input_required: false },
      { id: 'r-cap-' + m[1], title: 'Bônus de +15% Capture Boost', description: '1 hora de +15% na chance de captura no PokeIdle', cost: 500, is_enabled: true, is_paused: false, is_user_input_required: false },
      ...(recompensas3 ? [{ id: 'r-lure-' + m[1], title: 'Bônus de +15% Secret Lure', description: '1 hora de +15% na chance de shiny no PokeIdle', cost: 1000, is_enabled: true, is_paused: false, is_user_input_required: false }] : []),
      { id: 'r-tarot', title: 'LEITURA DE TAROT', description: 'carta', cost: 140000, is_enabled: true, is_paused: false, is_user_input_required: true }] });
    if ((m = u.match(/^\/api\/v2\/channels\/([^/]+)\/rewards\/([^/]+)\/redeem$/))) {
      const custo = /xp/.test(m[2]) ? 300 : /cap/.test(m[2]) ? 500 : 1000; pts[m[1]] -= custo; return resp({ data: { ok: true } });
    }
    if (u.includes('gamification/challenges') && metodo === 'GET') return resp({ data: [{ id: 'd1', name: 'Daily Reward', recurrence: 'daily', status: 'in_progress', claimed_at: null, condition: { progress: diariaProg, threshold: 60 } }] });
    if (u.includes('/claim') && u.includes('challenges')) return resp({ data: { winner: { rarity: 'rare' } } });
    if (u.includes('drops/progress')) return resp({ data: [{ id: 'c1', name: 'Rust', progress_units: 130, user_app_connected: dropConectado, rewards: [{ id: 'rw1', name: 'Skin', required_units: 120, claimed: false }, { id: 'rw2', name: 'Skin 2', required_units: 240, claimed: false }] }] });
    if (u.includes('drops/claim')) return resp({ data: { id: 'x' } });
    return resp({}, 404);
  };
  for (const f of ['src/comum.js', 'src/ui.js', 'src/pokeidle-painel.js', 'src/kick/kick.js']) w.eval(ler(f));
  await espera(400);
  return { w, store, chamadas, pts, sr: () => w.document.getElementById('plateia-sala').shadowRoot };
}

(async () => {
  // 1) caso normal: yoda 1500 + 300 ganhos depois -> pacote; matta longe
  const a = await montar({});
  const frames = () => [...a.sr().querySelectorAll('iframe')].map((f) => f.dataset.slug);
  ok('PokeIdle: canais oficiais entraram na lista', ['matta', 'yoda', 'jukes', 'offline1'].every((s) => a.store.configKick.canais.some((c) => c.slug === s && c.origem === 'pokeidle')));
  ok('modo foco: tocam os 2 mais perto do pacote (yoda 1500, jukes 900)', frames().length === 2 && frames().includes('yoda') && frames().includes('jukes'));
  ok('sem resgate antes de juntar 1.800', !a.chamadas.some((c) => c.u.includes('/redeem')));
  const pkTxt = () => (a.sr().querySelector('.aba-canais .pk, .conteudo .pk') || {}).textContent || '';
  ok('resumo do PokeIdle na aba Canais: oficiais ao vivo e próximo pacote (yoda, faltam 300)', /canais oficiais ao vivo/.test(pkTxt()) && /Próximo pacote: yoda, faltam 300 pts/i.test(pkTxt()));
  // yoda chega a 1.800
  a.pts.yoda = 1850;
  await a.w.PLATEIA.kickAtualizar();
  await espera(9000);
  const red = a.chamadas.filter((c) => c.u.includes('/redeem'));
  console.log('       resgates:', red.map((c) => c.u.split('/rewards/')[1]).join(' | '));
  ok('resgate em pacote: 3 resgates no yoda (XP, Capture, Lure, nessa ordem)', red.length === 3 && /r-xp-yoda/.test(red[0].u) && /r-cap-yoda/.test(red[1].u) && /r-lure-yoda/.test(red[2].u));
  ok('cada resgate leva transaction_id e message', red.every((c) => c.corpo && c.corpo.transaction_id && c.corpo.message === ''));
  ok('resgate com o login (Bearer)', red.every((c) => /^Bearer /.test(c.auth || '')));
  ok('log de resgates gravado', (a.store.kickResgates || []).filter((r) => r.ok).length === 3);
  ok('Daily Reward pega quando completa 60 min', a.chamadas.some((c) => c.metodo === 'POST' && c.u.includes('challenges/d1/claim')));
  ok('Drop de 120 min resgatado; o de 240 não', a.chamadas.some((c) => c.u.includes('drops/claim') && c.corpo.reward_id === 'rw1') && !a.chamadas.some((c) => c.u.includes('drops/claim') && c.corpo.reward_id === 'rw2'));
  const abas = [...a.sr().querySelectorAll('.aba')];
  abas.find((b) => b.textContent === 'PokeIdle').click();
  await espera(50);
  ok('aba PokeIdle mostra bônus de XP ativo e pacote por canal', /\+15% XP/.test(a.sr().textContent) && /Pacote por canal/.test(a.sr().textContent));
  const dk = (a.w.PLATEIA.relatarBug && a.w.PLATEIA.relatarBug.diagnostico()) || '';
  ok('Relatar bug na Kick: diagnóstico com versão e sala, sem nome de canal nem conta', /Sala: Kick/.test(dk) && /Plateia: v/.test(dk) && /Valendo: 2\/2/.test(dk) && !/yoda|matta|jukes|offline1|dredsgg/i.test(dk));
  ok('assinatura "feito por Dreds · v' + manifest.version + '"', a.sr().querySelector('.assina').textContent === 'feito por Dreds · v' + manifest.version && a.sr().querySelector('.assina a').textContent === 'Dreds');

  // 2) sem vínculo no jogo: nunca resgata
  const b = await montar({ vinculado: false, saldos: { yoda: 5000 }, diariaProg: 10, dropConectado: false });
  await b.w.chrome.storage.local.set({ pokeidleKick: Object.assign({}, b.store.pokeidleKick, { em: Date.now() + 1 }) });
  await espera(1500);
  ok('sem vínculo: nenhum resgate', !b.chamadas.some((c) => c.u.includes('/redeem')));
  ok('sem vínculo: aviso no resumo da aba Canais', /Kick não vinculada no PokeIdle/.test((b.sr().querySelector('.conteudo .pk') || {}).textContent || ''));
  ok('diária com 10/60 min: não tenta pegar', !b.chamadas.some((c) => c.u.includes('challenges/d1/claim')));
  ok('drop sem conta conectada: não tenta pegar', !b.chamadas.some((c) => c.u.includes('drops/claim')));

  // 3) canal sem as 3 recompensas: não compra pacote incompleto
  const c = await montar({ saldos: { yoda: 5000 }, recompensas3: false });
  await c.w.chrome.storage.local.set({ pokeidleKick: Object.assign({}, c.store.pokeidleKick, { em: Date.now() + 1 }) });
  await espera(1500);
  ok('pacote incompleto (sem Lure): nenhum resgate', !c.chamadas.some((x) => x.u.includes('/redeem')));

  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
