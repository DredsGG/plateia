// Teste do rodapé padrão (regra 9): Procurar atualização, Relatar bug e "feito por Dreds · vX.Y.Z".
// O relato abre nos Issues do repo com a versão e um diagnóstico SEM dado pessoal (nem token, nem login, nem nome de canal).
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom'); // npm i jsdom
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const manifest = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.json'), 'utf8'));
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.twitch.tv/drops/inventory#plateia', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
w.document.cookie = 'auth-token=SEGREDO123abc; path=/';
w.document.cookie = 'login=usuario_teste; path=/';
const store = { config: { canais: [{ login: 'canalsecreto', mostrar: true, modo: 'rodizio' }], v020: true } };
w.chrome = { runtime: { getManifest: () => manifest, sendMessage: (m, cb) => cb && cb(null), lastError: null }, storage: { local: {
  get: async (k) => ({ [k]: store[k] }), set: async (o) => Object.assign(store, o) }, onChanged: { addListener() {} } } };
w.fetch = async () => ({ ok: true, json: async () => ({ data: {} }) });
w.WebSocket = class { constructor() {} send() {} close() {} };
let aberto = null;
w.open = (u) => { aberto = u; return {}; };
for (const f of ['src/comum.js', 'src/ui.js', 'src/pokeidle-painel.js', 'src/sala.js']) w.eval(fs.readFileSync(path.join(raiz, f), 'utf8'));
setTimeout(() => {
  const sr = w.document.getElementById('plateia-sala').shadowRoot;
  const proc = [...sr.querySelectorAll('.upd-proc')].find((b) => /Procurar atualização/.test(b.textContent));
  const bugBt = [...sr.querySelectorAll('.upd-proc')].find((b) => /Relatar bug/.test(b.textContent));
  const assina = sr.querySelector('.assina');
  bugBt && bugBt.click();
  const caixa = sr.querySelector('.upd-bug');
  const txt = sr.querySelector('.upd-bug-txt');
  if (txt) txt.value = 'A live entrou e saiu sozinha';
  const previa = (sr.querySelector('.upd-bug-pre') || {}).textContent || '';
  const abrir = [...sr.querySelectorAll('.upd-bug-bt')].find((b) => b.textContent === 'Abrir no GitHub');
  abrir && abrir.click();
  const corpo = aberto ? decodeURIComponent(aberto.split('&body=')[1] || '') : '';
  const ok = [
    ['tem "Procurar atualização"', !!proc],
    ['tem "Relatar bug"', !!bugBt],
    ['tem "feito por Dreds · v' + manifest.version + '" com Dreds clicável', assina && assina.textContent === `feito por Dreds · v${manifest.version}` && assina.querySelector('a').getAttribute('href') === 'https://github.com/DredsGG' && assina.querySelector('a').getAttribute('target') === '_blank'],
    ['Relatar bug abre o cartão', caixa && caixa.style.display === ''],
    ['prévia mostra a versão e a sala', previa.includes('Plateia: v' + manifest.version) && previa.includes('Sala: Twitch')],
    ['abre nos Issues do repo da Plateia', !!aberto && aberto.startsWith('https://github.com/DredsGG/plateia/issues/new?title=')],
    ['título com [Bug] e o texto', !!aberto && decodeURIComponent(aberto.split('&body=')[0]).includes('[Bug] A live entrou e saiu sozinha')],
    ['relato leva o texto, a versão e o diagnóstico', corpo.includes('A live entrou e saiu sozinha') && corpo.includes('v' + manifest.version) && corpo.includes('Canais na lista: 1')],
    ['relato NÃO leva token, login nem nome de canal', !/SEGREDO123|usuario_teste|canalsecreto/i.test(corpo + previa)],
    ['endereço abaixo do limite do GitHub (~8 mil)', !!aberto && aberto.length < 8000],
  ];
  for (const [n, v] of ok) console.log((v ? 'OK  ' : 'FALHOU ') + n);
  console.log(ok.every(([, v]) => v) ? 'TUDO PASSOU' : 'FALHOU');
  process.exit(ok.every(([, v]) => v) ? 0 : 1);
}, 600);
