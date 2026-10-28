// Lives da sala com a janela minimizada (v0.9.2): src/visivel.js, no mundo da página, só dentro das lives da sala.
// Confere: só liga dentro de iframe da sala (ou com #plateia-visivel), página sempre "visível", visibilitychange
// barrado, relógios de 1 s ou mais marcados pelo Worker (com clear funcionando) e relógios curtos com o navegador,
// "toque de som" (o Chrome não pausa escondido o vídeo que já teve som) e o aviso da sala quando o navegador nega.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom'); // npm i jsdom
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const codigo = fs.readFileSync(path.join(raiz, 'src/visivel.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.json'), 'utf8'));
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? 'OK     ' : 'FALHOU ') + n + (!c && extra ? '\n       ' + extra : '')); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Worker falso: roda o código do relógio no Node (setTimeout/setInterval reais) e conversa por mensagens
function workerFalso(w, contador) {
  w.URL.createObjectURL = () => 'blob:falso';
  w.Blob = class { constructor(partes) { this.txt = partes.join(''); w.__ultimoBlob = this.txt; } };
  w.Worker = class {
    constructor() {
      const self = this; contador.criados++;
      const escopo = { postMessage: (d) => setTimeout(() => self.onmessage && self.onmessage({ data: d }), 0), setTimeout, setInterval, clearTimeout, clearInterval, Map };
      new Function('self', 'postMessage', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Map', w.__ultimoBlob + '; self.onmessage = onmessage;')(
        escopo, escopo.postMessage, setTimeout, setInterval, clearTimeout, clearInterval, Map);
      this.postMessage = (d) => { contador.msgs++; setTimeout(() => escopo.onmessage({ data: d }), 0); };
    }
  };
}

(async () => {
  const cs = manifest.content_scripts.find((c) => c.js.includes('src/visivel.js'));
  ok('manifest: visivel.js no mundo da página, antes do site (document_start), em todos os frames da Twitch e da Kick',
    cs && cs.world === 'MAIN' && cs.run_at === 'document_start' && cs.all_frames === true && cs.matches.some((m) => /twitch/.test(m)) && cs.matches.some((m) => /kick/.test(m)));

  // 1) aba comum (fora da sala): nada muda
  {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://kick.com/umcanal', runScripts: 'outside-only' });
    const w = dom.window; const c = { criados: 0, msgs: 0 }; workerFalso(w, c);
    const stOriginal = w.setTimeout;
    w.eval(codigo);
    ok('aba comum da Kick: não mexe em nada (relógios e visibilidade do navegador)', w.setTimeout === stOriginal && !w.document.documentElement.dataset.plateiaVisivel && c.criados === 0);
  }

  // 2) live dentro da sala (iframe com o topo marcado como sala da Kick)
  {
    const dom = new JSDOM('<!doctype html><html><body><iframe src="about:blank"></iframe></body></html>', { url: 'https://kick.com/drops/claimed#plateia', runScripts: 'outside-only' });
    const topo = dom.window; topo.document.documentElement.dataset.plateia = 'sala-kick';
    await espera(50);
    const w = topo.document.querySelector('iframe').contentWindow;
    const c = { criados: 0, msgs: 0 }; workerFalso(w, c);
    let viuEvento = 0; w.document.addEventListener('visibilitychange', () => viuEvento++);
    w.eval(codigo);
    ok('live da sala: liga (marca no documento) e usa o relógio do Worker', w.document.documentElement.dataset.plateiaVisivel === '1' && w.__plateiaRelogio === 'worker' && c.criados === 1);
    ok('página sempre "visível": hidden false, visibilityState visible, hasFocus true', w.document.hidden === false && w.document.visibilityState === 'visible' && w.document.webkitHidden === false && w.document.hasFocus() === true);
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    ok('evento de aba escondida não chega ao site', viuEvento === 0);
    // relógios
    let a = 0, b = 0, curto = 0, cancelado = 0;
    const t0 = Date.now();
    w.setTimeout((x) => { a = x; w.__tA = Date.now() - t0; }, 1000, 7);
    const iv = w.setInterval(() => { b++; }, 1000);
    w.setTimeout(() => { curto++; }, 10);
    const cancelar = w.setTimeout(() => { cancelado++; }, 1200);
    const msgsAntes = c.msgs;
    w.clearTimeout(cancelar);
    await espera(2600);
    w.clearInterval(iv);
    const bParado = b; await espera(1300);
    ok('setTimeout de 1 s pelo Worker: roda uma vez, com os argumentos, no tempo certo', a === 7 && w.__tA >= 950 && w.__tA < 1600, 'a=' + a + ' t=' + w.__tA);
    ok('setInterval de 1 s pelo Worker: repete e para no clearInterval', bParado >= 2 && b === bParado, 'b=' + b + ' parado=' + bParado);
    ok('clearTimeout cancela o relógio do Worker', cancelado === 0 && c.msgs > msgsAntes);
    ok('relógio curto (< 1 s) fica com o navegador e roda normal', curto === 1);
    ok('ids do Worker não colidem com os do navegador', cancelar > 2e9);
  }

  // 3) sala da Twitch também
  {
    const dom = new JSDOM('<!doctype html><html><body><iframe src="about:blank"></iframe></body></html>', { url: 'https://www.twitch.tv/drops/inventory#plateia', runScripts: 'outside-only' });
    dom.window.document.documentElement.dataset.plateia = 'sala';
    await espera(50);
    const w = dom.window.document.querySelector('iframe').contentWindow; workerFalso(w, { criados: 0, msgs: 0 });
    w.eval(codigo);
    ok('live da sala da Twitch: liga também', w.document.documentElement.dataset.plateiaVisivel === '1' && w.document.hidden === false);
  }

  // 4) sem Worker (política do site): continua com os relógios do navegador, sem quebrar
  {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://kick.com/umcanal#plateia-visivel', runScripts: 'outside-only' });
    const w = dom.window; w.URL.createObjectURL = () => 'blob:x'; w.Worker = class { constructor() { throw new Error('CSP'); } };
    const st = w.setTimeout; w.eval(codigo);
    let x = 0; w.setTimeout(() => { x = 1; }, 1000); await espera(1200);
    ok('Worker bloqueado: fica com o relógio do navegador e a página continua "visível"', w.__plateiaRelogio === 'nativo' && w.setTimeout === st && x === 1 && w.document.hidden === false);
  }
  // 5) "toque de som": o Chrome pausa escondido o vídeo que nunca teve som; a live é desmutada por um instante
  // inaudível e volta a ficar muda. Simula o Chrome: desmutar sem permissão (política de autoplay) pausa o vídeo.
  {
    const dom = new JSDOM('<!doctype html><html><body><iframe src="about:blank"></iframe></body></html>', { url: 'https://www.twitch.tv/drops/inventory#plateia', runScripts: 'outside-only' });
    const topo = dom.window; topo.document.documentElement.dataset.plateia = 'sala';
    await espera(50);
    const w = topo.document.querySelector('iframe').contentWindow; workerFalso(w, { criados: 0, msgs: 0 });
    const proto = w.HTMLMediaElement.prototype;
    const sim = { permite: false, trocas: [] }; // estado do "Chrome"
    Object.defineProperty(proto, 'paused', { configurable: true, get() { return !!this.__pausado; } });
    Object.defineProperty(proto, 'readyState', { configurable: true, get() { return 4; } });
    Object.defineProperty(proto, 'muted', { configurable: true, get() { return this.__mudo !== false; }, set(x) {
      sim.trocas.push({ mudo: !!x, vol: this.__vol });
      if (!x && !sim.permite) this.__pausado = true; // política nega: o Chrome pausa
      if (!x && sim.permite && !this.__pausado) this.__teveSom = true;
      this.__mudo = !!x; this.dispatchEvent(new w.Event('volumechange'));
    } });
    Object.defineProperty(proto, 'volume', { configurable: true, get() { return this.__vol === undefined ? 1 : this.__vol; }, set(x) { this.__vol = x; } });
    proto.play = function () { this.__pausado = false; this.__plays = (this.__plays || 0) + 1; return Promise.resolve(); };
    const msgsTopo = []; topo.addEventListener('message', (e) => msgsTopo.push(e.data && e.data.plateiaSom));
    w.eval(codigo);
    const v = w.document.createElement('video'); w.document.body.appendChild(v);
    v.__vol = 0.5; let eventosSite = 0; v.addEventListener('volumechange', () => eventosSite++); v.addEventListener('pause', () => eventosSite++);
    v.dispatchEvent(new w.Event('playing', { bubbles: false }));
    await espera(100);
    ok('sem permissão do navegador: marca "negado", a live volta a tocar muda e a sala é avisada',
      w.document.documentElement.dataset.plateiaSom === 'negado' && !v.paused && v.muted === true && v.volume === 0.5 && v.__plays === 1 && msgsTopo.includes('negado'), JSON.stringify({ som: w.document.documentElement.dataset.plateiaSom, p: v.paused, m: v.muted, vol: v.volume, msgsTopo }));
    ok('desmutar foi com volume 0,0001 (inaudível) e voltou ao volume da pessoa', sim.trocas[0] && sim.trocas[0].mudo === false && sim.trocas[0].vol === 0.0001 && sim.trocas[1].mudo === true);
    ok('o site não vê a troca de volume', eventosSite === 0, 'eventos=' + eventosSite);
    // clique na sala: o topo repassa e a live tenta de novo na hora (sem esperar os 30 s)
    sim.permite = true; sim.trocas = [];
    w.postMessage({ plateiaTentarSom: 1 }, '*'); // simulado: no navegador quem manda é o topo
    await espera(100);
    const ok1 = w.document.documentElement.dataset.plateiaSom;
    // o jsdom não preenche e.source = window.top; repete a chamada direta pelo evento com a origem certa
    if (ok1 !== 'ok') { const ev = new w.MessageEvent('message', { data: { plateiaTentarSom: 1 }, source: topo }); w.dispatchEvent(ev); await espera(100); }
    ok('depois do clique na sala: tenta de novo na hora e passa a "ok" (o vídeo já teve som), muda e no volume da pessoa',
      w.document.documentElement.dataset.plateiaSom === 'ok' && v.__teveSom === true && !v.paused && v.muted === true && v.volume === 0.5 && msgsTopo.includes('ok'), JSON.stringify({ som: w.document.documentElement.dataset.plateiaSom, msgsTopo }));
    const n = sim.trocas.length; v.dispatchEvent(new w.Event('playing')); await espera(100);
    ok('vídeo que já teve som não é mexido de novo', sim.trocas.length === n);
  }

  // 6) sala: aviso "Clique na sala para contar minimizada" (P.somSala em comum.js)
  {
    const dom = new JSDOM('<!doctype html><html><body><iframe src="about:blank"></iframe></body></html>', { url: 'https://www.twitch.tv/drops/inventory#plateia', runScripts: 'outside-only' });
    const w = dom.window; await espera(50);
    w.chrome = { runtime: { sendMessage: () => Promise.resolve(null), getManifest: () => ({ version: '0.9.2' }), getURL: (x) => x, id: 'x' }, storage: { local: { get: async () => ({}), set: async () => {} }, onChanged: { addListener() {} } }, i18n: { getUILanguage: () => 'pt-BR' } };
    w.eval(fs.readFileSync(path.join(raiz, 'src/comum.js'), 'utf8'));
    const P = w.PLATEIA; let mudou = 0;
    const som = P.somSala(() => mudou++);
    const fw = w.document.querySelector('iframe').contentWindow;
    const recebidos = []; fw.addEventListener('message', (e) => recebidos.push(e.data));
    w.dispatchEvent(new w.MessageEvent('message', { data: { plateiaSom: 'negado' }, origin: 'https://www.twitch.tv', source: fw }));
    ok('live avisa "negado": a sala mostra o aviso', som.negado() === true && mudou === 1);
    w.dispatchEvent(new w.MessageEvent('message', { data: { plateiaSom: 'negado' }, origin: 'https://evil.example', source: fw }));
    ok('mensagem de outra origem é ignorada', mudou === 1);
    w.dispatchEvent(new w.Event('pointerdown'));
    await espera(50);
    ok('clique na sala é repassado às lives (tentar de novo)', recebidos.some((d) => d && d.plateiaTentarSom === 1));
    w.dispatchEvent(new w.MessageEvent('message', { data: { plateiaSom: 'ok' }, origin: 'https://www.twitch.tv', source: fw }));
    ok('live avisa "ok": o aviso some', som.negado() === false && mudou === 2);
    w.dispatchEvent(new w.MessageEvent('message', { data: { plateiaSom: 'negado' }, origin: 'https://www.twitch.tv', source: fw }));
    w.document.querySelector('iframe').remove();
    ok('live que saiu da sala não segura o aviso', som.negado() === false);
  }

  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
