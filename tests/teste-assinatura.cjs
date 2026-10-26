// Teste da assinatura (regra 9): "feito por Dreds · vX.Y.Z", Dreds clicável para o GitHub
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom'); // npm i jsdom
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const manifest = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.json'), 'utf8'));
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.twitch.tv/drops/inventory#plateia', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window;
const store = {};
w.chrome = { runtime: { getManifest: () => manifest }, storage: { local: {
  get: async (k) => ({ [k]: store[k] }), set: async (o) => Object.assign(store, o) }, onChanged: { addListener() {} } } };
w.fetch = async () => ({ ok: true, json: async () => ({ data: {} }) });
w.WebSocket = class { constructor() {} send() {} close() {} };
for (const f of ['src/comum.js', 'src/ui.js', 'src/pokeidle-painel.js', 'src/sala.js']) w.eval(fs.readFileSync(path.join(raiz, f), 'utf8'));
setTimeout(() => {
  const host = w.document.getElementById('plateia-sala');
  const a = host && host.shadowRoot.querySelector('.assina');
  const link = a && a.querySelector('a');
  const ok = [
    ['sala montada', !!host],
    ['texto', a && a.textContent === `feito por Dreds · v${manifest.version}`],
    ['só "Dreds" é link', link && link.textContent === 'Dreds'],
    ['href', link && link.getAttribute('href') === 'https://github.com/DredsGG'],
    ['target _blank', link && link.getAttribute('target') === '_blank'],
    ['rel noopener noreferrer', link && link.getAttribute('rel') === 'noopener noreferrer'],
  ];
  for (const [n, v] of ok) console.log((v ? 'OK  ' : 'FALHOU ') + n);
  console.log('texto:', a && a.textContent);
  process.exit(ok.every(([, v]) => v) ? 0 : 1);
}, 500);
