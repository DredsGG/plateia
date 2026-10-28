// Plateia — utilidades compartilhadas (feito por Dreds)
(() => {
  if (window.PLATEIA) return;
  const P = (window.PLATEIA = {});

  P.HASH_SALA = '#plateia';
  P.CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko'; // Client-ID do próprio site twitch.tv

  P.CONFIG_PADRAO = {
    bauAuto: true,        // pega o baú de pontos em toda aba e toda live da sala
    dropsAuto: true,      // resgata Drops que chegaram a 100%
    canais: [],           // [{login, mostrar, modo: 'fixo'|'rodizio'|'chat', origem?: 'pokeidle'}]
    vagas: 2,             // lives tocando de verdade (a Twitch só paga pontos em 2)
    rodizio: true,        // revezar as vagas entre os canais ao vivo
    rodizioMin: 20,       // minutos por rodada
    presencaChat: true,   // entra no chat de todos os canais escolhidos
    qualidadeBaixa: true, // players da sala em 160p
    seguirPokeidle: true, // põe na lista os canais oficiais do PokeIdle com bônus (lidos do jogo)
    pkIgnorar: []         // canais do PokeIdle que você tirou da lista na mão
  };

  // Firefox: `browser` (promessas); Chrome, Edge, Brave e Opera: `chrome`. Nos testes (jsdom) só existe `chrome`.
  const ext = (typeof browser !== 'undefined' && browser && browser.runtime && browser.runtime.id) ? browser
    : (typeof chrome !== 'undefined' ? chrome : undefined);
  P.ext = ext;
  P.ehFirefox = () => { try { return ext.runtime.getURL('').startsWith('moz-extension:'); } catch (e) { return false; } };
  const temChrome = !!(ext && ext.storage && ext.storage.local);
  // Pedido de rede como se fosse a própria página (origem e cookies do site), como o Chrome faz nos content scripts.
  // No Firefox isso é o `content.fetch`; o `fetch` comum lá sai com a identidade da extensão.
  P.fetch = (url, opts) => ((typeof content !== 'undefined' && content && typeof content.fetch === 'function')
    ? content.fetch(url, opts) : fetch(url, opts));
  // JSON lido como texto: no Firefox o objeto vem do mundo da página; o texto atravessa sem restrição
  P.lerJson = async (r) => {
    if (typeof r.text !== 'function') return r.json();
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  };
  P.ler = async (chave, padrao) => {
    try {
      if (temChrome) {
        const r = await ext.storage.local.get(chave);
        return r[chave] === undefined ? padrao : r[chave];
      }
      const v = localStorage.getItem('plateia:' + chave);
      return v === null ? padrao : JSON.parse(v);
    } catch (e) { return padrao; }
  };
  P.gravar = async (chave, valor) => {
    try {
      if (temChrome) return await ext.storage.local.set({ [chave]: valor });
      localStorage.setItem('plateia:' + chave, JSON.stringify(valor));
    } catch (e) { /* contexto invalidado (extensão recarregada) */ }
  };
  P.config = async () => Object.assign({}, P.CONFIG_PADRAO, await P.ler('config', {}));

  // ---------- Kick ----------
  P.CONFIG_KICK_PADRAO = {
    canais: [],            // [{slug, mostrar, modo: 'fixo'|'fila'|'fora', origem?: 'pokeidle'}]
    vagas: 2,              // lives tocando de verdade (medido: a Kick só paga pontos em 2 por vez)
    seguirPokeidle: true,  // põe na lista os canais oficiais do PokeIdle na Kick (lidos do jogo)
    pkIgnorar: [],
    resgateAuto: true,     // compra o pacote do PokeIdle (XP + Capture + Lure) quando o saldo do canal cobre os três
    diariaAuto: true,      // pega a Daily Reward da Kick quando completa 1 h assistida no dia
    dropsAuto: true        // resgata Drops da Kick que chegaram a 100%
  };
  P.configKick = async () => Object.assign({}, P.CONFIG_KICK_PADRAO, await P.ler('configKick', {}));
  P.ehKick = () => /(^|\.)kick\.com$/.test(location.hostname);
  P.aoMudar = (fn) => {
    try { if (temChrome) ext.storage.onChanged.addListener((m, area) => area === 'local' && fn(m)); } catch (e) {}
  };

  P.cookie = (k) => {
    const m = document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
  };
  P.token = () => P.cookie('auth-token');
  P.meuLogin = () => P.cookie('login');

  P.loginValido = (s) => /^[a-z0-9_]{2,25}$/.test(s || '');
  P.limparLogin = (s) => String(s || '').trim().toLowerCase()
    .replace(/^https?:\/\/(www\.)?twitch\.tv\//, '').replace(/^[@#]/, '').split(/[/?#\s]/)[0];

  // GraphQL do próprio site (consultas de leitura funcionam com o login do cookie)
  P.gql = async (corpo) => {
    const tok = P.token();
    if (!tok) throw new Error('sem login');
    const r = await P.fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      headers: { 'Client-Id': P.CLIENT_ID, 'Authorization': 'OAuth ' + tok, 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(corpo)
    });
    if (!r.ok) throw new Error('gql ' + r.status);
    return P.lerJson(r);
  };

  // Uma live está "dentro da sala" quando é um iframe da página-sala (mesma origem).
  P.dentroDaSala = () => {
    try {
      if (window.top === window) return false;
      const t = window.top;
      return t.document.documentElement.dataset.plateia === 'sala' || t.location.hash === P.HASH_SALA || t.name === 'plateia';
    } catch (e) { return false; }
  };
  P.canalDaPagina = () => {
    const seg = location.pathname.split('/').filter(Boolean);
    if (!seg.length) return '';
    if (seg[0] === 'popout' && seg[1]) return seg[1].toLowerCase();
    return seg[0].toLowerCase();
  };
  // versão sempre do manifest (regra 9: nunca escrita à mão)
  P.versao = () => { try { return ext.runtime.getManifest().version; } catch (e) { return ''; } };
  P.log = (...a) => console.debug('[Plateia]', ...a);

  // ---------- Idiomas (regra 13): português, inglês e espanhol ----------
  // Chave = texto em português; os dicionários de en/es ficam em src/i18n/en.js e es.js.
  // Variáveis entre chaves: t('troca em {t}', { t: '3:20' }).
  P.IDIOMAS = ['pt', 'en', 'es'];
  P.DIC = P.DIC || {};
  P.idioma = 'pt';
  P.idiomaDoNavegador = () => {
    let l = '';
    try { l = (ext && ext.i18n && ext.i18n.getUILanguage && ext.i18n.getUILanguage()) || ''; } catch (e) {}
    if (!l) l = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    l = String(l).toLowerCase();
    return l.startsWith('pt') ? 'pt' : l.startsWith('es') ? 'es' : 'en';
  };
  P.idiomaPronto = (async () => {
    const salvo = await P.ler('idioma', null);
    P.idioma = P.IDIOMAS.includes(salvo) ? salvo : P.idiomaDoNavegador();
    return P.idioma;
  })();
  P.t = (txt, vars) => {
    let s = P.idioma === 'pt' ? txt : ((P.DIC[P.idioma] && P.DIC[P.idioma][txt]) || txt);
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
    return s;
  };
  P.local = () => ({ pt: 'pt-BR', en: 'en-US', es: 'es-ES' })[P.idioma] || 'en-US';
  P.trocarIdioma = async (l) => { if (!P.IDIOMAS.includes(l)) return; await P.gravar('idioma', l); P.idioma = l; };

  // ---------- Versão nova (regras 7 e 14) ----------
  // O fundo procura nos Releases e grava em storage.local.atualizacao; aqui fica o último estado conhecido.
  P.cmpVersao = (a, b) => {
    const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0), pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1; }
    return 0;
  };
  P.versaoNova = (st) => !!(st && st.disponivel && st.ultima && P.cmpVersao(st.ultima, P.versao()) > 0);
  // Release com "URGENTE" no título: a automação pausa até atualizar (baú, resgates, lives da sala, chat)
  P.urgentePendente = (st) => P.versaoNova(st) && !!st.urgente;
  P.atualizacao = {};
  P.atualizacaoPronta = P.ler('atualizacao', {}).then((st) => (P.atualizacao = st || {}));
  P.aoMudar((m) => { if (m.atualizacao) P.atualizacao = m.atualizacao.newValue || {}; });
  P.pausado = () => P.urgentePendente(P.atualizacao);
  // Conferir sozinho: ao abrir a página e toda vez que a pessoa volta para a aba (o fundo só vai ao GitHub
  // se a última procura tiver mais de 10 min); a cada 30 min quem procura é o alarme do fundo.
  P.ESPERA_PROCURA_MS = 10 * 60000;
  P.pedirProcura = () => {
    try {
      return Promise.resolve(ext.runtime.sendMessage({ cmd: 'procurarAtualizacao', seMaisVelhoQue: P.ESPERA_PROCURA_MS })).catch(() => null);
    } catch (e) { return Promise.resolve(null); }
  };
  if (temChrome && window.top === window && /(^|\.)(twitch\.tv|kick\.com)$/.test(location.hostname)) {
    P.pedirProcura();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') P.pedirProcura(); });
    window.addEventListener('focus', () => P.pedirProcura());
  }
})();
