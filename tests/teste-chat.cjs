// Teste: JOIN que a Twitch descarta é pedido de novo (presença no chat em todos os canais)
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom'); // instalar com: npm i jsdom
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const manifest = JSON.parse(ler('manifest.json'));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0; const ok = (n, c) => { console.log((c ? 'OK     ' : 'FALHOU ') + n); if (!c) falhas++; };
(async () => {
  const store = { config: { canais: ['a1', 'b2', 'c3', 'perdido'].map((login) => ({ login, mostrar: true, modo: 'chat' })), seguirPokeidle: false } };
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.twitch.tv/drops/inventory#plateia', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.document.cookie = 'auth-token=x'; w.document.cookie = 'login=eu';
  w.chrome = { runtime: { getManifest: () => manifest }, storage: { local: { get: async (k) => ({ [k]: store[k] }), set: async (o) => Object.assign(store, o) }, onChanged: { addListener() {} } } };
  w.fetch = async () => ({ ok: true, json: async () => ({ data: {} }) });
  let joins = [], perdeu = false;
  w.WebSocket = class {
    constructor() { setTimeout(() => this.onopen && this.onopen(), 1); }
    send(m) {
      if (m.startsWith('NICK')) setTimeout(() => this.onmessage({ data: ':tmi.twitch.tv 001 eu :Welcome\r\n' }), 1);
      if (m.startsWith('JOIN')) {
        const canais = m.slice(5).split(',').map((c) => c.replace('#', ''));
        joins.push(...canais);
        for (const c of canais) {
          if (c === 'perdido' && !perdeu) { perdeu = true; continue; } // a Twitch "esquece" o primeiro JOIN
          setTimeout(() => this.onmessage({ data: `:eu!eu@eu.tmi.twitch.tv JOIN #${c}\r\n` }), 1);
        }
      }
    }
    close() {}
  };
  for (const f of ['src/comum.js', 'src/ui.js', 'src/pokeidle-painel.js', 'src/sala.js']) w.eval(ler(f));
  await espera(400);
  const chip = () => [...w.document.getElementById('plateia-sala').shadowRoot.querySelectorAll('.chip')].find((c) => /no chat/.test(c.textContent)).textContent;
  ok('primeira rodada: 3/4 no chat (um JOIN foi descartado)', /no chat 3\/4/.test(chip()));
  // 31 s depois, o vigia pede de novo
  const agoraReal = w.Date.now; const desloc = 31000;
  w.Date.now = () => agoraReal() + desloc;
  w.PLATEIA.salaTwitchChat();
  await espera(12000); // o lote seguinte sai depois de 11 s
  ok('o canal descartado foi pedido de novo', joins.filter((c) => c === 'perdido').length === 2);
  ok('agora 4/4 no chat', /no chat 4\/4/.test(chip()));
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
