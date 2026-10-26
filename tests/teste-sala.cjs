// Testes da sala (jsdom): consulta em lotes de 10, PokeIdle (ponte + guarda + sincronização),
// modos por canal, "ver agora", limpar lista, migração da v0.1.0.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom'); // instalar com: npm i jsdom
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const manifest = JSON.parse(ler('manifest.json'));
let falhas = 0;
const ok = (nome, cond) => { console.log((cond ? 'OK     ' : 'FALHOU ') + nome); if (!cond) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function chromeFalso(store, ouvintes) {
  return {
    runtime: { getManifest: () => manifest },
    storage: {
      local: {
        get: async (k) => ({ [k]: store[k] === undefined ? undefined : JSON.parse(JSON.stringify(store[k])) }),
        set: async (o) => {
          const mud = {};
          for (const [k, v] of Object.entries(o)) { mud[k] = { oldValue: store[k], newValue: v }; store[k] = JSON.parse(JSON.stringify(v)); }
          for (const f of ouvintes) f(mud, 'local');
        }
      },
      onChanged: { addListener: (f) => ouvintes.push(f) }
    }
  };
}

(async () => {
  // ---------- 1) ponte + guarda no pokeidle.io ----------
  const store = {}, ouvintes = [];
  const pkdom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://pokeidle.io/app', runScripts: 'outside-only' });
  const pw = pkdom.window;
  class WSFalso extends pw.EventTarget { constructor(url) { super(); this.url = url; pw.__ws = this; } send() {} close() {} }
  pw.WebSocket = WSFalso;
  // o postMessage do jsdom não preenche "source" (o Chrome preenche): imita o Chrome
  pw.postMessage = (data, origem) => setTimeout(() => pw.dispatchEvent(new pw.MessageEvent('message', { data, origin: origem, source: pw })), 0);
  pw.chrome = chromeFalso(store, ouvintes);
  pw.eval(ler('src/pokeidle-ponte.js'));
  pw.eval(ler('src/comum.js'));
  pw.eval(ler('src/pokeidle-guarda.js'));
  const ws = new pw.WebSocket('wss://pokeidle.io/ws');
  ok('ponte: WebSocket continua sendo instância do original', ws instanceof WSFalso);
  const tw = { login: 'odreds', aoVivo: true, assistindo: true, pctAtual: 0.2,
    lives: [{ login: 'dersin2k', nome: 'dersin2k', bonus: true }, { login: 'FaturetoSL', nome: 'FaturetoSL', bonus: true }, { login: 'matta', bonus: true }],
    oficiais: [{ login: 'dersin2k', bonus: true }, { login: 'FaturetoSL', bonus: true }, { login: 'matta', bonus: true }, { login: 'offline1', bonus: true }, { login: 'semBonus', bonus: false }],
    assistindoEm: ['dersin2k'] };
  ws.dispatchEvent(new pw.MessageEvent('message', { data: JSON.stringify({ t: 'chat', canal: 'x' }) }));
  ws.dispatchEvent(new pw.MessageEvent('message', { data: JSON.stringify({ t: 'estado', estado: { twitch: tw, ouro: 5 } }) }));
  await espera(50);
  ok('guarda gravou o bloco twitch', store.pokeidle && store.pokeidle.vinculado === true);
  ok('logins em minúsculas', store.pokeidle && store.pokeidle.oficiais.some((o) => o.login === 'faturetosl'));
  ok('não guarda nada além do bloco twitch', store.pokeidle && !('ouro' in store.pokeidle));

  // ---------- 2) sala na twitch ----------
  // config da v0.1.0: lista velha do PokeIdle + canais manuais, rodada 15
  store.config = { canais: [
    { login: 'faasii', mostrar: true, prioridade: false }, { login: 'cogu', mostrar: true, prioridade: false },
    { login: 'necros', mostrar: true, prioridade: true }, { login: 'eugengen', mostrar: true, prioridade: false },
    ...Array.from({ length: 12 }, (_, i) => ({ login: 'extra' + i, mostrar: false, prioridade: false }))
  ], rodizioMin: 15 };
  const vivos = new Set(['dersin2k', 'faturetosl', 'matta', 'necros', 'eugengen', 'extra1', 'extra2']);
  const consultas = [];
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.twitch.tv/drops/inventory#plateia', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.document.cookie = 'auth-token=x'; w.document.cookie = 'login=odreds';
  w.chrome = chromeFalso(store, ouvintes);
  w.fetch = async (url, opt) => {
    const corpo = JSON.parse(opt.body);
    const q = corpo.query || '';
    if (q.includes('inventory')) return { ok: true, json: async () => ({ data: { currentUser: { inventory: { dropCampaignsInProgress: [] } } } }) };
    const apelidos = [...q.matchAll(/(c\d+):user\(login:"([^"]+)"\)/g)];
    consultas.push(apelidos.length);
    if (apelidos.length > 15) return { ok: false, status: 400, json: async () => ({}) };
    const data = {};
    for (const [, ap, l] of apelidos) data[ap] = { login: l, displayName: l, profileImageURL: '', stream: vivos.has(l) ? { id: '1', viewersCount: 10, game: { displayName: 'Jogo' } } : null, channel: { self: { communityPoints: { balance: 100 } } } };
    return { ok: true, json: async () => ({ data }) };
  };
  w.WebSocket = class { constructor() { setTimeout(() => this.onopen && this.onopen(), 1); } send() {} close() {} };
  w.HTMLIFrameElement.prototype.__ok = 1;
  w.eval(ler('src/comum.js'));
  w.eval(ler('src/ui.js'));
  w.eval(ler('src/pokeidle-painel.js'));
  w.eval(ler('src/sala.js'));
  await espera(300);
  const sr = () => w.document.getElementById('plateia-sala').shadowRoot;
  const cfg = () => store.config;
  const login = (c) => c.login;

  ok('nenhuma consulta com mais de 15 apelidos', consultas.length && consultas.every((n) => n <= 10));
  ok('migração: rodada 15 → 20', cfg().rodizioMin === 20);
  ok('migração: prioridade → modo fixo', cfg().canais.find((c) => c.login === 'necros').modo === 'fixo');
  ok('PokeIdle: entrou dersin2k, faturetosl, matta, offline1', ['dersin2k', 'faturetosl', 'matta', 'offline1'].every((l) => cfg().canais.some((c) => c.login === l && c.origem === 'pokeidle')));
  ok('PokeIdle: canal sem bônus não entrou', !cfg().canais.some((c) => c.login === 'sembonus'));
  ok('lista velha (faasii, cogu) saiu', !cfg().canais.some((c) => ['faasii', 'cogu'].includes(c.login)));
  ok('canal manual continua', cfg().canais.some((c) => c.login === 'eugengen' && !c.origem));
  const frames = () => [...sr().querySelectorAll('iframe')].filter((f) => f.title !== 'inventario').map((f) => f.dataset.login);
  ok('2 vagas tocando, com o fixo (necros) dentro', frames().length === 2 && frames().includes('necros'));
  ok('chip do PokeIdle mostra "te vê 1/3"', /te vê 1\/3/.test(sr().querySelector('.chips').textContent));
  ok('tag "jogo te vê ✓" no dersin2k', [...sr().querySelectorAll('.card')].some((c) => /dersin2k/.test(c.textContent) && /jogo te vê ✓/.test(c.textContent)));

  // modo "só chat": nunca toca
  const card = (l) => [...sr().querySelectorAll('.card')].find((c) => c.querySelector('.nome').firstChild.textContent === l);
  const clicarModo = (l, rot) => [...card(l).querySelectorAll('.modo')].find((b) => b.textContent === rot).click();
  clicarModo('necros', 'Só chat');
  await espera(30);
  ok('só chat: necros saiu da vaga', !frames().includes('necros') && frames().length === 2);
  ok('só chat: sem botão ▶ no necros', !card('necros').querySelector('.agora'));

  // ver agora
  const alvoAgora = cfg().canais.map(login).find((l) => vivos.has(l) && !frames().includes(l) && cfg().canais.find((c) => c.login === l).modo !== 'chat');
  card(alvoAgora).querySelector('.agora').click();
  await espera(30);
  ok('▶ ver agora: ' + alvoAgora + ' entrou numa vaga', frames().includes(alvoAgora));

  // fixo
  clicarModo('matta', 'Fixo');
  await espera(30);
  ok('fixo: matta sempre na vaga', frames().includes('matta'));

  // tirar canal do PokeIdle na mão: não volta sozinho
  card('faturetosl').querySelector('.x').click();
  await espera(30);
  ws.dispatchEvent(new pw.MessageEvent('message', { data: JSON.stringify({ t: 'estado', estado: { twitch: Object.assign({}, tw, { assistindoEm: ['dersin2k', 'matta'] }) } }) }));
  await espera(80);
  ok('canal do PokeIdle tirado na mão não volta', !cfg().canais.some((c) => c.login === 'faturetosl'));

  // limpar lista (dois cliques) e "só canais do PokeIdle"
  const botao = (txt) => [...sr().querySelectorAll('.mini')].find((b) => b.textContent.includes(txt));
  botao('Limpar lista').click();
  await espera(20);
  ok('limpar pede confirmação', cfg().canais.length > 0 && /Clique de novo/.test(botao('Clique de novo').textContent));
  botao('Clique de novo').click();
  await espera(30);
  ok('limpar: lista vazia e seguir PokeIdle desligado', cfg().canais.length === 0 && cfg().seguirPokeidle === false && frames().length === 0);
  botao('Só canais do PokeIdle').click();
  await espera(30);
  ok('só PokeIdle: volta só os 4 canais com bônus (inclusive o tirado antes)', cfg().canais.length === 4 && cfg().canais.every((c) => c.origem === 'pokeidle') && cfg().seguirPokeidle === true);

  // "+ lives do PokeIdle": depois de limpar tudo, o botão põe de volta os canais com bônus sem apagar os manuais
  botao('Limpar lista').click(); await espera(20); botao('Clique de novo').click(); await espera(30);
  const inp = sr().querySelector('form.add input'); inp.value = 'manual1';
  sr().querySelector('form.add').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await espera(30);
  const btPk = [...sr().querySelectorAll('.atalhos .lk')].find((b) => /lives do PokeIdle/.test(b.textContent));
  ok('botão "+ lives do PokeIdle" existe e está ativo', btPk && !btPk.disabled);
  ok('sem link "abrir o PokeIdle"', !/abrir o PokeIdle/.test(sr().textContent));
  btPk.click(); await espera(30);
  ok('+ lives do PokeIdle: 4 canais com bônus + o manual', cfg().canais.length === 5 && cfg().canais.some((c) => c.login === 'manual1') && cfg().seguirPokeidle === true);

  // ajustes com explicação e rodada 20
  sr().querySelector('details').open = true;
  ok('ajustes têm explicação embaixo', sr().querySelectorAll('.aj small').length >= 8);
  const assina = sr().querySelector('.assina');
  ok('assinatura "feito por Dreds · v' + manifest.version + '"', assina.textContent === 'feito por Dreds · v' + manifest.version && assina.querySelector('a').textContent === 'Dreds');

  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
