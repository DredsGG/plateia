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
})();
