// Teste do tutorial de primeiro uso e do quadro de novidades (regra 12), nas salas da Twitch e da Kick.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom'); // npm i jsdom
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const manifest = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.json'), 'utf8'));
const V = manifest.version;
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
function montar(store, sala = 'twitch') {
  const url = sala === 'kick' ? 'https://kick.com/drops/claimed#plateia' : 'https://www.twitch.tv/drops/inventory#plateia';
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.chrome = { runtime: { getManifest: () => manifest, sendMessage: () => Promise.resolve(null), getURL: (p) => 'chrome-extension://x/' + p }, storage: { local: {
    get: async (k) => ({ [k]: store[k] }), set: async (o) => Object.assign(store, o) }, onChanged: { addListener() {} } } };
  w.fetch = async () => ({ ok: true, json: async () => ({ data: {} }) });
  w.WebSocket = class { constructor() {} send() {} close() {} };
  const lista = sala === 'kick'
    ? ['src/comum.js', 'src/changelog/pt.js', 'src/changelog/en.js', 'src/ui.js', 'src/pokeidle-painel.js', 'src/kick/kick.js']
    : ['src/comum.js', 'src/changelog/pt.js', 'src/changelog/en.js', 'src/ui.js', 'src/pokeidle-painel.js', 'src/sala.js'];
  for (const f of lista) w.eval(fs.readFileSync(path.join(raiz, f), 'utf8'));
  const sr = () => w.document.getElementById('plateia-sala').shadowRoot;
  const quadro = () => sr().querySelector('.qd');
  return { w, store, sr, quadro };
}
const res = [];
const ok = (n, v) => { res.push(v); console.log((v ? 'OK  ' : 'FALHOU ') + n); };
(async () => {
  // 1) instalação nova: só o tutorial
  const a = montar({ atualizacao: { instalacaoNova: true } });
  await espera(400);
  ok('instalação nova abre o tutorial', !!a.quadro() && /Como usar a sala da Twitch/.test(a.quadro().textContent) && /Passo 1 de 5/.test(a.quadro().textContent));
  ok('tutorial tem "Pular" e "Próximo"', !!a.sr().querySelector('.qd-pular') && !!a.sr().querySelector('.qd-prox'));
  for (let i = 0; i < 4; i++) a.sr().querySelector('.qd-prox').click();
  ok('último passo tem "Entendi"', /Passo 5 de 5/.test(a.quadro().textContent) && !!a.sr().querySelector('.qd-ok'));
  a.sr().querySelector('.qd-ok').click(); await espera(50);
  ok('"Entendi" fecha e grava que viu', !a.quadro() && a.store.quadros && a.store.quadros.tutorial === true && a.store.quadros.novidades === V);
  a.sr().querySelector('.qd-ajuda').click(); await espera(50);
  ok('"? Como usar" reabre o tutorial', !!a.quadro() && /Passo 1 de 5/.test(a.quadro().textContent));
  a.w.document.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await espera(50);
  ok('Esc fecha o quadro', !a.quadro());
  // 2) atualização (já usava a Plateia, nunca viu os quadros): só as novidades
  const b = montar({ config: { canais: [{ login: 'canal1', modo: 'rodizio', mostrar: true }], v020: true } });
  await espera(400);
  ok(`atualização abre "Novidades da v${V}"`, !!b.quadro() && b.quadro().textContent.includes(`Novidades da v${V}`) && b.sr().querySelectorAll('.qd-lista li').length >= 3);
  ok('novidades não mostram o tutorial junto', !/Passo 1 de/.test(b.quadro().textContent));
  b.sr().querySelector('.qd-x').click(); await espera(50);
  ok('X fecha e grava a versão vista', !b.quadro() && b.store.quadros && b.store.quadros.novidades === V);
  // 3) já viu esta versão: nada aparece
  const c = montar({ quadros: { tutorial: true, novidades: V } });
  await espera(400);
  ok('versão já vista: nenhum quadro', !c.quadro());
  // 4) viu a versão anterior: novidades da atual
  const d = montar({ quadros: { tutorial: true, novidades: '0.0.1' } });
  await espera(400);
  ok('versão nova depois de já ter visto outra: novidades', !!d.quadro() && d.quadro().textContent.includes(`Novidades da v${V}`));
  // 5) sala da Kick também tem
  const k = montar({ atualizacao: { instalacaoNova: true } }, 'kick');
  await espera(600);
  ok('sala da Kick: tutorial próprio e botão "Como usar"', !!k.quadro() && /Como usar a sala da Kick/.test(k.quadro().textContent) && !!k.sr().querySelector('.qd-ajuda'));
  ok('changelog em pt e en para a versão atual', !!(a.w.PLATEIA.CHANGELOG.pt[V] && a.w.PLATEIA.CHANGELOG.en[V]));
  console.log(res.every(Boolean) ? 'TUDO PASSOU' : 'FALHOU');
  process.exit(res.every(Boolean) ? 0 : 1);
})();
