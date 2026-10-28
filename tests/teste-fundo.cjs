// Fundo (service worker) da Plateia, rodado no Node com a API do navegador simulada:
// procura a cada 30 min, pedido da página respeita o mínimo de 10 min, Release "URGENTE",
// resumo do changelog do próprio Release e adiamento zerado ao abrir o navegador (regras 7 e 14).
const fs = require('fs'), path = require('path'), vm = require('vm');
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const manifest = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.json'), 'utf8'));
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? 'OK     ' : 'FALHOU ') + n + (!c && extra ? '\n       ' + extra : '')); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function montar(release) {
  const store = {}, ouv = { msg: [], alarm: [], startup: [], installed: [] }, alarmes = {}, pedidos = [];
  const ev = (k) => ({ addListener: (f) => ouv[k].push(f) });
  const chrome = {
    runtime: { getManifest: () => manifest, getURL: (p) => 'chrome-extension://x/' + (p || ''), onMessage: ev('msg'), onStartup: ev('startup'), onInstalled: ev('installed'), reload() {}, requestUpdateCheck: async () => ({ status: 'no_update' }) },
    storage: { local: { get: async (k) => ({ [k]: store[k] && JSON.parse(JSON.stringify(store[k])) }), set: async (o) => Object.assign(store, JSON.parse(JSON.stringify(o))) } },
    alarms: { create: (n, o) => { alarmes[n] = o; }, onAlarm: ev('alarm') },
    tabs: { create: async () => ({}), query: async () => [], reload() {} },
    management: { getSelf: async () => ({ installType: 'development' }) },
    permissions: { contains: async () => true },
  };
  const fetch = async (u) => {
    pedidos.push(String(u));
    if (String(u).includes('api.github.com')) return { ok: true, status: 200, json: async () => release() };
    const m = String(u).match(/changelog\/(\w+)\.js$/);
    if (m) return { ok: true, status: 200, text: async () => `P.CHANGELOG.${m[1]} = { '9.9.9': ['${m[1]} item 1', "${m[1]} item 2"] };` };
    return { ok: false, status: 404 };
  };
  const ctx = vm.createContext({ chrome, fetch, console, setTimeout, clearTimeout, Date, Promise, encodeURIComponent, String, Number, JSON, Object, Array, RegExp });
  vm.runInContext(fs.readFileSync(path.join(raiz, 'src/fundo.js'), 'utf8'), ctx);
  const mensagem = (msg) => new Promise((r) => { for (const f of ouv.msg) f(msg, {}, r); });
  return { store, ouv, alarmes, pedidos, mensagem, ctx };
}

(async () => {
  let rel = { tag_name: 'v9.9.9', name: 'v9.9.9', body: '- algo', assets: [{ name: 'plateia-v9.9.9.zip', browser_download_url: 'https://x/z.zip' }] };
  const f = montar(() => rel);
  for (const g of f.ouv.installed) await g({ reason: 'update', previousVersion: '0.8.0' });
  await espera(50);
  ok('alarme de procura a cada 30 min', f.alarmes['plateia-procura'] && f.alarmes['plateia-procura'].periodInMinutes === 30);
  const st = f.store.atualizacao || {};
  ok('achou a v9.9.9 e leu o resumo do changelog do Release nos 3 idiomas', st.disponivel === true && st.ultima === '9.9.9' && ['pt', 'en', 'es'].every((l) => st.novidades && st.novidades[l] && st.novidades[l][0] === l + ' item 1'));
  ok('Release normal: não é urgente', st.urgente === false);
  const n0 = f.pedidos.filter((u) => u.includes('api.github.com')).length;
  await f.mensagem({ cmd: 'procurarAtualizacao', seMaisVelhoQue: 600000 });
  ok('pedido da página dentro de 10 min: não vai ao GitHub de novo', f.pedidos.filter((u) => u.includes('api.github.com')).length === n0);
  f.store.atualizacao.procuradoEm = Date.now() - 11 * 60000;
  rel = Object.assign({}, rel, { name: 'v9.9.9 URGENTE — corrige o baú' });
  const r = await f.mensagem({ cmd: 'procurarAtualizacao', seMaisVelhoQue: 600000 });
  ok('pedido da página depois de 10 min: procura de novo', f.pedidos.filter((u) => u.includes('api.github.com')).length === n0 + 1 && r && r.ultima === '9.9.9');
  ok('título do Release com "URGENTE": marca urgente', f.store.atualizacao.urgente === true);
  const n1 = f.pedidos.filter((u) => u.includes('api.github.com')).length;
  await f.mensagem({ cmd: 'procurarAtualizacao' });
  ok('botão do rodapé (sem limite): procura na hora', f.pedidos.filter((u) => u.includes('api.github.com')).length === n1 + 1);
  f.store.atualizacao.adiadoAte = Date.now() + 3600e3;
  for (const g of f.ouv.startup) await g();
  await espera(50);
  ok('abrir o navegador zera o adiamento do X (o aviso volta)', f.store.atualizacao.adiadoAte === 0);
  rel = { tag_name: 'v0.0.1', name: 'URGENTE velho', assets: [] };
  await f.mensagem({ cmd: 'procurarAtualizacao' });
  ok('Release "URGENTE" mais velho que a instalada: nem disponível nem urgente', f.store.atualizacao.disponivel === false && f.store.atualizacao.urgente === false);
  for (const g of f.ouv.installed) await g({ reason: 'update', previousVersion: '0.8.0' });
  ok('depois de atualizar: limpa urgente e adiamento', f.store.atualizacao.urgente === false && f.store.atualizacao.adiadoAte === 0);
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
