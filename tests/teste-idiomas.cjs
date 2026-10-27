// Regra 13: português, inglês e espanhol. Confere (1) que todo texto da interface tem tradução,
// (2) a detecção pelo idioma do navegador, (3) as salas da Twitch e da Kick montadas em cada idioma,
// sem sobrar texto em português em en/es, e (4) o seletor PT · EN · ES gravando a escolha.
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom'); // npm i jsdom
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const manifest = JSON.parse(ler('manifest.json'));
const V = manifest.version;
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? 'OK     ' : 'FALHOU ') + n + (!c && extra ? '\n       ' + extra : '')); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1) cobertura das traduções (estático) ----------
const chaves = new Set();
const lit = /'((?:[^'\\]|\\.)*)'/g;
for (const f of ['src/ui.js', 'src/sala.js', 'src/kick/kick.js', 'src/pokeidle-painel.js']) {
  const s = ler(f);
  const re = /(?:\btr|P\.t)\(\s*('(?:[^'\\]|\\.)*'|[^,)]+\?\s*'(?:[^'\\]|\\.)*'\s*:\s*'(?:[^'\\]|\\.)*')/g;
  let m;
  while ((m = re.exec(s))) for (const l of m[1].matchAll(lit)) if (l[1] !== 'kick') chaves.add(l[1].replace(/\\'/g, "'"));
  if (f === 'src/ui.js') {
    let b = s.slice(s.indexOf('const TUTORIAL = {')); b = b.slice(0, b.indexOf('\n  };'));
    for (const l of b.matchAll(lit)) if (!['twitch', 'kick'].includes(l[1])) chaves.add(l[1].replace(/\\'/g, "'"));
  }
}
const ctx = { window: { PLATEIA: {} } };
new Function('window', ler('src/i18n/en.js') + ler('src/i18n/es.js') + ler('src/changelog/pt.js') + ler('src/changelog/en.js') + ler('src/changelog/es.js'))(ctx.window);
const DIC = ctx.window.PLATEIA.DIC, CL = ctx.window.PLATEIA.CHANGELOG;
for (const l of ['en', 'es']) {
  const falta = [...chaves].filter((k) => !(k in DIC[l]));
  ok(`${l}: todos os ${chaves.size} textos traduzidos`, !falta.length, falta.slice(0, 5).join(' | '));
  const ph = (t) => (t.match(/\{\w+\}/g) || []).sort().join();
  const ruins = [...chaves].filter((k) => DIC[l][k] !== undefined && ph(k) !== ph(DIC[l][k]));
  ok(`${l}: marcadores {x} iguais ao português`, !ruins.length, ruins.join(' | '));
  const vazios = Object.entries(DIC[l]).filter(([, v]) => !String(v).trim());
  ok(`${l}: nenhuma tradução vazia`, !vazios.length);
}
ok(`changelog da v${V} em pt, en e es`, ['pt', 'en', 'es'].every((l) => CL[l] && CL[l][V] && CL[l][V].length >= 2));
ok('manifest carrega i18n/en.js e es.js logo depois do comum.js (Twitch e Kick)',
  manifest.content_scripts.slice(0, 2).every((c) => c.js[1] === 'src/i18n/en.js' && c.js[2] === 'src/i18n/es.js' && c.js.includes('src/changelog/es.js')));
const locales = ['en', 'es', 'pt_BR'].every((l) => { try { return !!JSON.parse(ler(`_locales/${l}/messages.json`)).descricao.message; } catch (e) { return false; } });
ok('descrição da extensão em _locales (en, es, pt_BR)', manifest.default_locale === 'en' && manifest.description === '__MSG_descricao__' && locales);

// ---------- 2..4) salas montadas ----------
// palavras que só aparecem se sobrou texto em português na tela
const PT_COMUM = 'ao vivo|Valendo|valendo|Adicionar|Adicione|Fechar|Procurar|Relatar|baú|baús|rodízio|Rodízio|Canais|feito por|Como usar|Abrir em|assistindo|Nenhum|Limpar|canais oficiais|Bônus|Pacote|Resgate|Atualiz|você|não';
// no espanhol, "esperando", "vinculada", "Próximo", "seguidos" e "Ajustes" também existem
const PT = { en: new RegExp('\\b(' + PT_COMUM + '|esperando|vinculad[oa]|Próximo|seguidos|Ajustes)'), es: new RegExp('\\b(' + PT_COMUM + ')') };
function montar({ sala = 'twitch', idioma, lang = 'en-US', uiLang }) {
  const store = { quadros: { tutorial: true, novidades: V } }, ouvintes = [];
  if (idioma) store.idioma = idioma;
  const url = sala === 'kick' ? 'https://kick.com/drops/claimed#plateia' : 'https://www.twitch.tv/drops/inventory#plateia';
  const vc = new VirtualConsole(); // location.reload do jsdom não existe: só registra
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  Object.defineProperty(w.navigator, 'language', { value: lang, configurable: true });
  Object.defineProperty(w.navigator, 'languages', { value: [lang], configurable: true });
  let recarregou = 0;
  vc.on('jsdomError', (e) => { if (/navigation|reload/i.test(String(e.message))) recarregou++; });
  w.document.cookie = 'session_token=1%7Cabc';
  w.chrome = {
    runtime: { getManifest: () => manifest, sendMessage: () => Promise.resolve(null), getURL: (p) => 'chrome-extension://x/' + p },
    i18n: uiLang ? { getUILanguage: () => uiLang } : undefined,
    storage: { local: {
      get: async (k) => ({ [k]: store[k] === undefined ? undefined : JSON.parse(JSON.stringify(store[k])) }),
      set: async (o) => { const m = {}; for (const [k, v] of Object.entries(o)) { m[k] = { newValue: v, oldValue: store[k] }; store[k] = JSON.parse(JSON.stringify(v)); } ouvintes.forEach((f) => f(m, 'local')); } },
      onChanged: { addListener: (f) => ouvintes.push(f) } }
  };
  if (sala === 'twitch') {
    store.config = { canais: [{ login: 'canal1', mostrar: true, modo: 'rodizio' }, { login: 'canal2', mostrar: true, modo: 'fixo' }, { login: 'canal3', mostrar: false, modo: 'chat' }], v020: true, presencaChat: true, rodizio: true, rodizioMin: 20, vagas: 2, seguirPokeidle: true, pkIgnorar: [] };
    store.pokeidle = { vinculado: true, login: 'x', pct: 0.175, em: Date.now(), oficiais: [{ login: 'canal1', bonus: true }], lives: [{ login: 'canal1' }], assistindoEm: [] };
    store.pokeidleKick = { vinculado: false, bonus: {}, oficiais: [], em: Date.now() };
    w.document.cookie = 'auth-token=tok';
    w.fetch = async (url, opt = {}) => {
      const corpo = opt.body ? JSON.parse(opt.body) : {};
      if (/currentUser/.test(corpo.query || '')) return { ok: true, json: async () => ({ data: { currentUser: { inventory: { dropCampaignsInProgress: [{ name: 'C', timeBasedDrops: [{ id: 'd', name: 'Drop X', requiredMinutesWatched: 60, self: { currentMinutesWatched: 10, isClaimed: false, dropInstanceID: null, hasPreconditionsMet: false } }] }] } } } }) };
      const data = {}; (corpo.query || '').replace(/c(\d+):user\(login:"(\w+)"\)/g, (_, k, l) => { data['c' + k] = { login: l, displayName: l, profileImageURL: '', stream: l === 'canal3' ? null : { id: 1, viewersCount: 1234, createdAt: '', game: { displayName: 'Jogo' } }, channel: { self: { communityPoints: { balance: 5000 } } } }; });
      return { ok: true, json: async () => ({ data }) };
    };
  } else {
    store.pokeidleKick = { vinculado: true, login: 'eu', pct: 0, em: Date.now(), bonus: { xp: Date.now() + 3600e3 }, oficiais: [{ slug: 'matta', nome: 'matta', aoVivo: true, ativo: true }], recompensas: [] };
    store.configKick = { canais: [{ slug: 'matta', mostrar: true, modo: 'fila', origem: 'pokeidle' }, { slug: 'outro', mostrar: true, modo: 'fora' }], vagas: 2, resgateAuto: true, seguirPokeidle: true, pkIgnorar: [], diariaAuto: true, dropsAuto: true };
    const resp = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
    w.fetch = async (url) => {
      const u = String(url).replace('https://kick.com', '');
      let m;
      if (u === '/api/v1/user') return resp({ username: 'eu' });
      if ((m = u.match(/^\/api\/v2\/channels\/([^/]+)$/))) return resp({ id: 1, user: { username: m[1], profile_pic: '' }, livestream: { id: 9, is_live: true, viewer_count: 100, categories: [{ name: 'Just Chatting' }] } });
      if ((m = u.match(/^\/api\/v2\/channels\/([^/]+)\/points$/))) return resp({ data: { points: 700 } });
      if (/rewards$/.test(u)) return resp({ data: [] });
      if (/challenges/.test(u)) return resp({ data: [{ id: 1, name: 'Daily', recurrence: 'daily', condition: { progress: 20, threshold: 60 }, status: 'active' }] });
      if (/drops\/progress/.test(u)) return resp({ data: [] });
      return resp({});
    };
  }
  w.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };
  w.crypto.randomUUID = () => 'u' + Math.random();
  for (const f of manifest.content_scripts[sala === 'kick' ? 1 : 0].js) w.eval(ler(f));
  const sr = () => w.document.getElementById('plateia-sala').shadowRoot;
  return { w, store, sr, recarregou: () => recarregou };
}
const textoVisivel = (sr) => {
  const app = sr.querySelector('.app').cloneNode(true);
  app.querySelectorAll('style,iframe').forEach((e) => e.remove());
  const txt = [app.textContent];
  app.querySelectorAll('[title],[placeholder],[aria-label]').forEach((e) => txt.push(e.getAttribute('title') || '', e.getAttribute('placeholder') || '', e.getAttribute('aria-label') || ''));
  return txt.join(' | ');
};

(async () => {
  // 2) detecção pelo navegador
  const det = [['pt-BR', 'pt'], ['pt-PT', 'pt'], ['es-MX', 'es'], ['es-ES', 'es'], ['en-US', 'en'], ['fr-FR', 'en'], ['de-DE', 'en'], ['ja', 'en']];
  for (const [lang, esp] of det) {
    const s = montar({ lang });
    await espera(30);
    ok(`navegador em ${lang} → ${esp}`, s.w.PLATEIA.idioma === esp, 'ficou ' + s.w.PLATEIA.idioma);
  }
  const ui = montar({ lang: 'en-US', uiLang: 'es-419' }); await espera(30);
  ok('idioma da interface do navegador (i18n.getUILanguage) tem preferência', ui.w.PLATEIA.idioma === 'es');
  const salvo = montar({ lang: 'es-ES', idioma: 'pt' }); await espera(30);
  ok('escolha salva vence o navegador', salvo.w.PLATEIA.idioma === 'pt');

  // 3) salas em cada idioma
  for (const sala of ['twitch', 'kick']) {
    for (const l of ['pt', 'en', 'es']) {
      const s = montar({ sala, idioma: l });
      await espera(sala === 'kick' ? 900 : 600);
      const sr = s.sr();
      const tabs = [...sr.querySelectorAll('.aba')];
      let txt = textoVisivel(sr);
      for (const t of tabs) { t.click(); await espera(30); txt += ' | ' + textoVisivel(sr); }
      // tutorial e relatar bug também
      sr.querySelector('.qd-ajuda').click(); await espera(20);
      for (let i = 0; i < 5; i++) { txt += ' | ' + (sr.querySelector('.qd') || {}).textContent; const p = sr.querySelector('.qd-prox'); if (p) p.click(); await espera(5); }
      s.w.document.dispatchEvent(new s.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      const bug = sr.querySelector('.upd-bugbt'); if (bug) { bug.click(); await espera(20); txt += ' | ' + textoVisivel(sr); }
      if (l === 'pt') {
        ok(`${sala}/pt: interface em português`, /Valendo agora|Canais/.test(txt) && /feito por/.test(txt));
      } else {
        const m = txt.match(PT[l]);
        ok(`${sala}/${l}: nada de português na tela (abas, tutorial, relatar bug)`, !m, m && txt.slice(Math.max(0, m.index - 80), m.index + 60));
        ok(`${sala}/${l}: assinatura "${l === 'en' ? 'made by' : 'hecho por'} Dreds"`, new RegExp((l === 'en' ? 'made by' : 'hecho por') + ' Dreds · v' + V.replace(/\./g, '\\.')).test(txt));
      }
      if (l === 'es') {
        const bts = [...sr.querySelectorAll('.idiomas .idioma')];
        ok(`${sala}: seletor PT · EN · ES no rodapé, ES marcado`, bts.map((b) => b.textContent).join(' ') === 'PT EN ES' && sr.querySelector('.idioma.on').textContent === 'ES' && !!sr.querySelector('.rodape-fim .assina'));
        bts[1].click(); await espera(50);
        ok(`${sala}: clicar EN grava a escolha e recarrega a sala`, s.store.idioma === 'en' && s.recarregou() >= 1);
      }
      if (sala === 'twitch' && l === 'en') ok('números no formato do idioma (en: 5,000)', /5,000 pts/.test(txt));
      if (sala === 'twitch' && l === 'pt') ok('números no formato do idioma (pt: 5.000)', /5\.000 pts/.test(txt));
    }
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
  process.exit(falhas ? 1 : 0);
})();
