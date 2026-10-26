// Plateia — sala de multi-live + botão de abrir (só na aba principal)
(() => {
  const P = window.PLATEIA;
  if (!P || window.top !== window || P.salaIniciada) return;
  P.salaIniciada = true;

  const URL_SALA = 'https://www.twitch.tv/drops/inventory' + P.HASH_SALA;
  const MAX_VAGAS = 4;
  const LISTA_VELHA_POKEIDLE = ['faasii', 'tftoddy', 'axtlol', 'xdaren_', 'cogu'];

  // ---------- helpers de DOM ----------
  function h(tag, attrs, ...filhos) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.style.cssText = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat()) {
      if (f === null || f === undefined || f === false) continue;
      el.appendChild(typeof f === 'string' || typeof f === 'number' ? document.createTextNode(String(f)) : f);
    }
    return el;
  }
  const repor = (el, ...filhos) => el.replaceChildren(...filhos.flat().filter((f) => f !== null && f !== undefined && f !== false));
  const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR'));
  const mmss = (ms) => { ms = Math.max(0, ms); const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function abrirSala() {
    const w = window.open(URL_SALA, 'plateia', 'popup=yes,width=1440,height=900');
    if (!w) location.href = URL_SALA;
  }

  // ---------- Botão flutuante (fora da sala) ----------
  function botaoAbrir() {
    if (document.getElementById('plateia-lancador')) return;
    const host = h('div', { id: 'plateia-lancador' });
    const raiz = host.attachShadow({ mode: 'open' });
    raiz.appendChild(h('style', {}, `
      button{position:fixed;left:14px;bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:7px;
        background:#9147ff;color:#fff;border:0;border-radius:999px;padding:8px 14px 8px 10px;font:600 13px/1 Inter,Roobert,Arial,sans-serif;
        box-shadow:0 4px 14px rgba(0,0,0,.45);cursor:pointer;opacity:.92}
      button:hover{opacity:1;background:#a970ff}
      .ic{width:18px;height:18px}` + ((P.ui && P.ui.CSS_BOLINHA) || '')));
    const bt = h('button', { title: 'Abrir a sala de multi-live da Plateia', onclick: abrirSala }, icone(), 'Plateia');
    raiz.appendChild(bt);
    if (P.ui && P.ui.marcarNovidade) P.ui.marcarNovidade(bt);
    document.documentElement.appendChild(host);
  }
  function icone() {
    if (P.ui && P.ui.logo) { const l = P.ui.logo(20); l.setAttribute('class', 'ic'); return l; }
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic');
    s.innerHTML = '<g fill="currentColor"><circle cx="6" cy="9" r="2.6"/><circle cx="18" cy="9" r="2.6"/><circle cx="12" cy="7.5" r="3"/>' +
      '<path d="M1.5 19c0-2.6 2-4.4 4.5-4.4 1 0 1.9.3 2.6.8-.9 1-1.4 2.3-1.4 3.6H1.5z"/><path d="M22.5 19c0-2.6-2-4.4-4.5-4.4-1 0-1.9.3-2.6.8.9 1 1.4 2.3 1.4 3.6h5.7z"/>' +
      '<path d="M6.5 20.5c0-3.2 2.5-5.6 5.5-5.6s5.5 2.4 5.5 5.6z"/></g>';
    return s;
  }

  // ---------- Sala ----------
  let salaAtiva = false;
  function talvezSala() {
    if (salaAtiva) return;
    if (location.hash === P.HASH_SALA || window.name === 'plateia') iniciarSala();
    else botaoAbrir();
  }
  window.addEventListener('hashchange', talvezSala);
  talvezSala();

  async function iniciarSala() {
    salaAtiva = true;
    const ehJanela = !!window.opener || window.name === 'plateia';
    window.name = 'plateia';
    document.documentElement.dataset.plateia = 'sala';
    const lanc = document.getElementById('plateia-lancador');
    if (lanc) lanc.remove();

    let cfg = await P.config();
    const salvar = () => P.gravar('config', cfg);
    // migração para a v0.2.0: rodada padrão 20 min e modo por canal (fixo / rodízio / só chat)
    if (!cfg.v020) {
      if (cfg.rodizioMin === 15) cfg.rodizioMin = 20;
      for (const c of cfg.canais) { if (!c.modo) c.modo = c.prioridade ? 'fixo' : 'rodizio'; delete c.prioridade; }
      cfg.v020 = true; salvar();
    }
    const modo = (c) => c.modo || 'rodizio';
    const aoVivo = (login) => !!(info[login] && info[login].aoVivo);

    const info = {};          // login -> dados da Twitch
    const iframes = new Map();// login -> iframe tocando
    let vagasAtuais = [];
    let rodada = Object.assign({ inicio: Date.now(), ponteiro: 0 }, await P.ler('rodada', {}));
    if (Date.now() - rodada.inicio > 6 * 3600e3) rodada = { inicio: Date.now(), ponteiro: 0 };
    const bausInicio = await P.ler('baus', {});
    let baus = Object.assign({}, bausInicio);
    let drops = [], dropsResgatados = await P.ler('dropsResgatados', []);
    let erroGql = '';
    let pk = await P.ler('pokeidle', null); // bloco "twitch" do PokeIdle (gravado pelo pokeidle-guarda.js)
    let pkk = await P.ler('pokeidleKick', null); // bloco "kick" do PokeIdle (só para mostrar; a parte da Kick vem depois)
    const inicioSessao = Date.now();

    // ----- montagem -----
    const host = h('div', { id: 'plateia-sala' });
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483000';
    const raiz = host.attachShadow({ mode: 'open' });
    raiz.appendChild(h('style', {}, CSS + (P.CSS_PAINEL || '') + ((P.ui && P.ui.CSS_ATUALIZACAO) || '') + '.upd + .assina{margin-top:4px}'));
    const els = {};
    const app = h('div', { class: 'app' },
      h('header', {},
        h('div', { class: 'marca' }, icone(), h('b', {}, 'Plateia'), h('span', { class: 'sub' }, 'sala de multi-live')),
        els.chips = h('div', { class: 'chips' }),
        h('div', { class: 'acoes' },
          ehJanela ? null : h('button', { class: 'bt', onclick: abrirSala }, 'Abrir em janela própria'),
          h('button', { class: 'bt sec', onclick: fecharSala }, 'Fechar sala'))),
      h('div', { class: 'corpo' },
        h('aside', {},
          els.abas = h('div', { class: 'abas' }),
          els.abaPk = h('div', { class: 'aba-pk', style: 'display:none' }),
          els.abaCanais = h('div', { class: 'aba-canais' },
          h('form', { class: 'add', onsubmit: (e) => { e.preventDefault(); adicionar(els.input.value); els.input.value = ''; } },
            els.input = h('input', { placeholder: 'canal ou link (ex.: gaules)', autocomplete: 'off', spellcheck: 'false' }),
            h('button', { class: 'bt' }, 'Adicionar')),
          h('div', { class: 'atalhos' },
            h('button', { class: 'lk', onclick: puxarSeguidos, title: 'Adiciona os canais que você segue e estão ao vivo agora' }, '+ seguidos ao vivo'),
            els.btPk = h('button', { class: 'lk', onclick: () => adicionarPokeidle() }, '+ lives do PokeIdle')),
          els.pk = h('div', { class: 'pk' }),
          els.barra = h('div', { class: 'barra-lista' }),
          els.lista = h('div', { class: 'lista' }),
          els.drops = h('div', { class: 'drops' }),
          h('details', { class: 'ajustes' },
            h('summary', {}, 'Ajustes'),
            els.ajustes = h('div', {})),
          h('p', { class: 'nota' },
            'A Twitch só paga pontos e baú em 2 lives por vez (medido em 2026-10-23). Lives abertas em outras abas entram nessa conta. ',
            'Os outros canais ficam com você presente no chat.')),
          P.ui && P.ui.atualizacao ? P.ui.atualizacao() : null,
          h('div', { class: 'assina' }, 'feito por ',
            h('a', { href: 'https://github.com/DredsGG', target: '_blank', rel: 'noopener noreferrer', title: 'github.com/DredsGG' }, 'Dreds'),
            P.versao() ? ' · v' + P.versao() : null)),
        els.palco = h('main', { class: 'palco' },
          els.vazio = h('div', { class: 'vazio' }, 'Adicione canais na lista. As lives que estiverem valendo aparecem aqui.'))));
    raiz.appendChild(app);
    document.documentElement.appendChild(host);
    document.body && (document.body.style.overflow = 'hidden');
    document.title = 'Plateia · sala';

    // ----- canais -----
    function adicionar(bruto) {
      const login = P.limparLogin(bruto);
      if (!P.loginValido(login)) return;
      if (cfg.canais.some((c) => c.login === login)) return;
      cfg.canais.push({ login, mostrar: true, modo: 'rodizio' });
      cfg.pkIgnorar = cfg.pkIgnorar.filter((x) => x !== login);
      salvar(); render(); atualizar(); sincronizarChat();
    }

    // ----- PokeIdle: canais oficiais com bônus, lidos do jogo -----
    function pkComBonus() {
      if (!pk) return [];
      const of = (pk.oficiais || []).filter((o) => o.bonus).map((o) => o.login);
      return [...new Set(of.length ? of : (pk.lives || []).map((l) => l.login))];
    }
    function pkIdade() { return pk && pk.em ? Date.now() - pk.em : Infinity; }
    function sincronizarPokeidle() {
      if (!cfg.seguirPokeidle || !pk) return;
      const alvo = pkComBonus().filter((l) => P.loginValido(l) && !cfg.pkIgnorar.includes(l));
      if (!alvo.length) return; // lista vazia (jogo carregando): não apaga nada
      let mudou = false;
      for (const login of alvo) {
        const c = cfg.canais.find((x) => x.login === login);
        if (!c) { cfg.canais.push({ login, mostrar: true, modo: 'rodizio', origem: 'pokeidle' }); mudou = true; }
      }
      // v0.1.0 tinha uma lista fixa (e velha) de canais do PokeIdle: passam a ser controlados pelo jogo
      for (const c of cfg.canais) if (!c.origem && LISTA_VELHA_POKEIDLE.includes(c.login) && !alvo.includes(c.login)) { c.origem = 'pokeidle'; }
      const antes = cfg.canais.length;
      cfg.canais = cfg.canais.filter((c) => c.origem !== 'pokeidle' || alvo.includes(c.login));
      if (cfg.canais.length !== antes) mudou = true;
      if (mudou) { salvar(); aplicarVagas(); render(); atualizar(); sincronizarChat(); }
    }
    // botão "+ lives do PokeIdle": põe na lista os canais oficiais com bônus (sem apagar os seus)
    function adicionarPokeidle() {
      if (!pk) return;
      cfg.seguirPokeidle = true;
      cfg.pkIgnorar = [];
      salvar();
      sincronizarPokeidle();
      render();
    }
    function pkPct() {
      const v = pk && Number(pk.pct) || 0;
      if (!v) return '';
      const p = v <= 1 ? v * 100 : v;
      return '+' + (Math.round(p * 10) / 10).toLocaleString('pt-BR') + '%';
    }
    function remover(login) {
      const c = cfg.canais.find((x) => x.login === login);
      if (c && c.origem === 'pokeidle' && !cfg.pkIgnorar.includes(login)) cfg.pkIgnorar.push(login);
      cfg.canais = cfg.canais.filter((c) => c.login !== login);
      salvar(); aplicarVagas(); render(); sincronizarChat();
    }
    function definirModo(login, m) {
      const c = cfg.canais.find((x) => x.login === login);
      if (!c) return;
      c.modo = m;
      salvar(); aplicarVagas(); render();
    }
    // "Ver agora": este canal entra numa vaga já, e o rodízio continua dele em diante
    function verAgora(login) {
      const c = cfg.canais.find((x) => x.login === login);
      if (!c || !aoVivo(login)) return;
      if (modo(c) !== 'rodizio') c.modo = 'rodizio';
      const fila = filaRodizio();
      const i = fila.indexOf(login);
      if (i < 0) return;
      rodada = { inicio: Date.now(), ponteiro: i };
      P.gravar('rodada', rodada);
      salvar(); aplicarVagas(); render();
    }
    let confirmarLimpar = 0;
    function limparTudo(soPokeidle) {
      if (!soPokeidle && Date.now() - confirmarLimpar > 4000) { confirmarLimpar = Date.now(); renderBarra(); setTimeout(renderBarra, 4100); return; }
      confirmarLimpar = 0;
      cfg.canais = [];
      cfg.pkIgnorar = [];
      cfg.seguirPokeidle = !!soPokeidle;
      rodada = { inicio: Date.now(), ponteiro: 0 };
      P.gravar('rodada', rodada);
      salvar();
      sincronizarPokeidle();
      aplicarVagas(); render(); sincronizarChat();
    }
    function alternar(login, campo) {
      const c = cfg.canais.find((x) => x.login === login);
      if (!c) return;
      c[campo] = !c[campo];
      salvar(); aplicarVagas(); render();
    }
    function puxarSeguidos() {
      const cards = [...document.querySelectorAll('[data-a-target="side-nav-bar"] a[href^="/"]')];
      for (const a of cards) {
        const t = a.innerText || '';
        if (/offline/i.test(t) || !/\d/.test(t)) continue;
        const login = a.getAttribute('href').split('/')[1];
        if (P.loginValido(login) && !login.startsWith('directory')) adicionar(login);
      }
    }

    // ----- dados da Twitch (ao vivo, saldo) -----
    async function atualizar() {
      const logins = cfg.canais.map((c) => c.login).filter(P.loginValido);
      try {
        for (let i = 0; i < logins.length; i += 10) {
          const parte = logins.slice(i, i + 10); // a Twitch aceita no máximo 15 apelidos por consulta
          const q = 'query{' + parte.map((l, k) =>
            `c${k}:user(login:"${l}"){login displayName profileImageURL(width:70) ` +
            `stream{id viewersCount createdAt game{displayName}} channel{self{communityPoints{balance}}}}`).join(' ') + '}';
          const j = await P.gql({ query: q });
          parte.forEach((l, k) => {
            const u = j.data && j.data['c' + k];
            const ant = info[l] || {};
            if (!u) { info[l] = { inexistente: true }; return; }
            const saldo = u.channel && u.channel.self && u.channel.self.communityPoints ? u.channel.self.communityPoints.balance : null;
            info[l] = {
              nome: u.displayName || l, img: u.profileImageURL,
              aoVivo: !!u.stream, espectadores: u.stream ? u.stream.viewersCount : 0,
              jogo: u.stream && u.stream.game ? u.stream.game.displayName : '',
              saldo, saldoInicial: ant.saldoInicial !== undefined && ant.saldoInicial !== null ? ant.saldoInicial : saldo
            };
          });
        }
        erroGql = '';
      } catch (e) { erroGql = String(e.message || e); }
      aplicarVagas(); renderLeve();
    }

    // ----- Drops -----
    async function verDrops() {
      if (!cfg.dropsAuto) { drops = []; return renderDrops(); }
      try {
        const j = await P.gql({ query: 'query{currentUser{inventory{dropCampaignsInProgress{id name timeBasedDrops{id name requiredMinutesWatched self{currentMinutesWatched isClaimed dropInstanceID hasPreconditionsMet}}}}}}' });
        const camp = (j.data && j.data.currentUser && j.data.currentUser.inventory && j.data.currentUser.inventory.dropCampaignsInProgress) || [];
        drops = [];
        for (const c of camp) for (const d of c.timeBasedDrops || []) {
          if (!d.self || d.self.isClaimed) continue;
          drops.push({ campanha: c.name, nome: d.name, min: d.self.currentMinutesWatched, req: d.requiredMinutesWatched, id: d.self.dropInstanceID, ok: d.self.hasPreconditionsMet });
        }
        for (const d of drops) if (d.ok && d.req && d.min >= d.req) await resgatarDrop(d);
      } catch (e) { /* tenta na próxima */ }
      renderDrops();
    }
    async function resgatarDrop(d) {
      let ok = false;
      if (d.id) {
        try {
          const j = await P.gql({ query: 'mutation($id:String!){claimDropRewards(input:{dropInstanceID:$id}){status}}', variables: { id: d.id } });
          const st = j.data && j.data.claimDropRewards && j.data.claimDropRewards.status;
          ok = st === 'ELIGIBLE_FOR_ALL' || st === 'DROP_INSTANCE_ALREADY_CLAIMED';
        } catch (e) {}
      }
      if (!ok) return resgatarPeloInventario();
      dropsResgatados.unshift({ em: Date.now(), nome: d.nome, via: 'direto' });
      P.gravar('dropsResgatados', dropsResgatados.slice(0, 50));
    }
    let invAberto = null;
    function resgatarPeloInventario() {
      if (invAberto) return;
      // o inventário numa moldura escondida: o bau.js lá dentro clica em "Resgatar"
      invAberto = h('iframe', { src: 'https://www.twitch.tv/drops/inventory', class: 'oculto', title: 'inventario' });
      raiz.appendChild(invAberto);
      setTimeout(() => { invAberto && invAberto.remove(); invAberto = null; }, 45000);
    }

    // ----- vagas e rodízio -----
    function vagasN() { return Math.max(1, Math.min(MAX_VAGAS, cfg.vagas | 0 || 2)); }
    function filaRodizio() { return cfg.canais.filter((c) => modo(c) === 'rodizio' && aoVivo(c.login)).map((c) => c.login); }
    function fixosVivos() { return cfg.canais.filter((c) => modo(c) === 'fixo' && aoVivo(c.login)).map((c) => c.login); }
    function escolherVagas() {
      const n = vagasN();
      const fixos = fixosVivos().slice(0, n);
      const fila = filaRodizio();
      const livres = n - fixos.length;
      const out = fixos.slice();
      if (livres > 0 && fila.length) {
        if (!cfg.rodizio || fila.length <= livres) out.push(...fila.slice(0, livres));
        else for (let i = 0; i < livres; i++) out.push(fila[(rodada.ponteiro + i) % fila.length]);
      }
      return [...new Set(out)];
    }
    function girarSePreciso() {
      if (!cfg.rodizio) return;
      const fila = filaRodizio();
      const livres = vagasN() - fixosVivos().length;
      if (livres <= 0 || fila.length <= livres) return;
      if (Date.now() - rodada.inicio < cfg.rodizioMin * 60000) return;
      rodada = { inicio: Date.now(), ponteiro: (rodada.ponteiro + livres) % fila.length };
      P.gravar('rodada', rodada);
      aplicarVagas(); render();
    }

    let qualOriginal = undefined, qualTimer = null;
    function qualidadeBaixaPorUmTempo() {
      if (!cfg.qualidadeBaixa) return;
      const k = 'video-quality';
      try {
        if (qualOriginal === undefined) qualOriginal = localStorage.getItem(k);
        localStorage.setItem(k, JSON.stringify({ default: '160p30' }));
        clearTimeout(qualTimer);
        qualTimer = setTimeout(restaurarQualidade, 25000);
      } catch (e) {}
    }
    function restaurarQualidade() {
      try {
        if (qualOriginal === undefined) return;
        if (qualOriginal === null) localStorage.removeItem('video-quality');
        else localStorage.setItem('video-quality', qualOriginal);
        qualOriginal = undefined;
      } catch (e) {}
    }

    function aplicarVagas() {
      const alvo = escolherVagas();
      for (const [login, fr] of iframes) if (!alvo.includes(login)) { fr.remove(); iframes.delete(login); }
      for (const login of alvo) {
        if (iframes.has(login)) continue;
        qualidadeBaixaPorUmTempo();
        const fr = h('iframe', { src: 'https://www.twitch.tv/' + login, title: login, allow: 'autoplay; fullscreen' });
        fr.dataset.login = login;
        iframes.set(login, fr);
        els.palco.appendChild(fr);
      }
      vagasAtuais = alvo;
      // mostrar ou esconder (sem recarregar a live)
      let visiveis = 0;
      for (const [login, fr] of iframes) {
        const c = cfg.canais.find((x) => x.login === login);
        const mostrar = !c || c.mostrar;
        fr.classList.toggle('oculto', !mostrar);
        if (mostrar) visiveis++;
      }
      const col = Math.max(1, Math.ceil(Math.sqrt(visiveis)));
      els.palco.style.gridTemplateColumns = `repeat(${col}, 1fr)`;
      els.vazio.style.display = visiveis ? 'none' : '';
      els.vazio.textContent = iframes.size && !visiveis
        ? 'As lives valendo estão tocando escondidas. Clique no olho de um canal para ver.'
        : 'Adicione canais na lista. As lives que estiverem valendo aparecem aqui.';
    }

    // ----- presença no chat (IRC do próprio site) -----
    let irc = null, ircPronto = false, ircTent = 0, ircTimer = null, ircErro = '';
    const noChat = new Set(), pedidos = new Map(); // pedidos: canal -> hora do JOIN (sem resposta em 30 s, pede de novo)
    let ultimaMsgIrc = 0;
    function conectarIRC() {
      if (!cfg.presencaChat || irc) return;
      const tok = P.token(), eu = P.meuLogin();
      if (!tok || !eu) { ircErro = 'sem login'; return; }
      irc = new WebSocket('wss://irc-ws.chat.twitch.tv:443');
      irc.onopen = () => { irc.send('CAP REQ :twitch.tv/membership'); irc.send('PASS oauth:' + tok); irc.send('NICK ' + eu); };
      irc.onmessage = (e) => {
        ultimaMsgIrc = Date.now();
        for (const linha of String(e.data).split('\r\n')) {
          if (!linha) continue;
          if (linha.startsWith('PING')) { irc.send('PONG' + linha.slice(4)); continue; }
          const sem = linha.replace(/^@\S+ /, '');
          if (/^:tmi\.twitch\.tv 001 /.test(sem)) { ircPronto = true; ircTent = 0; ircErro = ''; sincronizarChat(); continue; }
          if (/NOTICE \* :Login (authentication failed|unsuccessful)/i.test(sem)) { ircErro = 'login do chat recusado'; continue; }
          let m = sem.match(/^:(\w+)!\S+ JOIN #(\w+)/);
          if (m && m[1] === eu) { noChat.add(m[2]); pedidos.delete(m[2]); renderLeve(); continue; }
          m = sem.match(/^:(\w+)!\S+ PART #(\w+)/);
          if (m && m[1] === eu) { noChat.delete(m[2]); renderLeve(); continue; }
          if (/ RECONNECT/.test(sem)) irc.close();
        }
      };
      irc.onclose = () => {
        irc = null; ircPronto = false; noChat.clear(); pedidos.clear(); renderLeve();
        if (!salaAtiva || !cfg.presencaChat) return;
        const espera = Math.min(300000, 5000 * Math.pow(2, ircTent++));
        clearTimeout(ircTimer); ircTimer = setTimeout(conectarIRC, espera);
      };
    }
    let filaJoin = [], joinTimer = null;
    function sincronizarChat() {
      if (!cfg.presencaChat) { if (irc) irc.close(); return; }
      if (!irc) return conectarIRC();
      if (!ircPronto) return;
      const quero = new Set(cfg.canais.map((c) => c.login).filter(P.loginValido));
      for (const c of noChat) if (!quero.has(c)) irc.send('PART #' + c);
      for (const [c, em] of pedidos) if (Date.now() - em > 30000) pedidos.delete(c); // a Twitch descartou o JOIN: tenta de novo
      filaJoin = [...quero].filter((c) => !noChat.has(c) && !pedidos.has(c));
      if (!joinTimer) entrarEmLotes();
    }
    P.salaTwitchChat = () => sincronizarChat(); // usado pelos testes
    function entrarEmLotes() {
      // limite da Twitch: 20 entradas a cada 10 s
      if (!irc || !ircPronto || !filaJoin.length) { joinTimer = null; return; }
      const lote = filaJoin.splice(0, 15);
      lote.forEach((c) => pedidos.set(c, Date.now()));
      irc.send('JOIN ' + lote.map((c) => '#' + c).join(','));
      joinTimer = setTimeout(entrarEmLotes, 11000);
    }

    // ----- render -----
    function chip(txt, cls, title) { return h('span', { class: 'chip ' + (cls || ''), title }, txt); }
    function renderChips() {
      const total = cfg.canais.length;
      const vivos = cfg.canais.filter((c) => info[c.login] && info[c.login].aoVivo).length;
      const nBaus = Object.keys(baus).reduce((s, k) => s + Math.max(0, (baus[k] || 0) - (bausInicio[k] || 0)), 0);
      const ganho = cfg.canais.reduce((s, c) => {
        const i = info[c.login];
        return s + (i && i.saldo !== null && i.saldoInicial !== null && i.saldo !== undefined ? Math.max(0, i.saldo - i.saldoInicial) : 0);
      }, 0);
      const fila = filaRodizio();
      const livres = vagasN() - fixosVivos().length;
      const gira = cfg.rodizio && livres > 0 && fila.length > livres;
      const pkVivos = pkComBonus().filter((l) => info[l] && info[l].aoVivo);
      const pkVe = pk ? pkVivos.filter((l) => (pk.assistindoEm || []).includes(l)).length : 0;
      repor(els.chips,
        chip(`${vivos}/${total} ao vivo`, '', 'Canais da sua lista que estão ao vivo agora / total de canais na lista'),
        chip(`no chat ${noChat.size}/${total}`, cfg.presencaChat ? (ircPronto ? 'ok' : 'alerta') : 'off',
          cfg.presencaChat ? (ircErro || 'Em quantos canais da lista você está dentro do chat (aparece na lista de quem está no chat; é isso que o PokeIdle confere)') : 'Presença no chat desligada'),
        chip(`valendo ${vagasAtuais.length}/${vagasN()}`, vagasN() > 2 ? 'alerta' : 'ok', 'Lives tocando de verdade agora / vagas. Só essas ganham pontos e baú'),
        gira ? (els.relogio = chip('troca em ' + mmss(rodada.inicio + cfg.rodizioMin * 60000 - Date.now()), 'relogio', 'Tempo até o rodízio trocar as lives que estão valendo')) : (els.relogio = null),
        chip(`+${fmt(ganho)} pts · ${nBaus} baús`, 'ok', 'Pontos ganhos e baús pegos desde que a sala abriu'),
        pk && pk.vinculado && pkVivos.length ? chip(`PokeIdle${pkPct() ? ' ' + pkPct() : ''} · te vê ${pkVe}/${pkVivos.length}`, pkVe ? 'ok' : 'alerta',
          'Em quantos canais oficiais ao vivo o PokeIdle já te reconheceu / canais oficiais com bônus ao vivo. O jogo confere de tempos em tempos') : null,
        erroGql ? chip('Twitch: ' + erroGql, 'alerta', 'A consulta de dados à Twitch falhou; a sala tenta de novo a cada minuto') : null);
      renderPokeidle();
    }
    function renderLista() {
      const ordem = cfg.canais.slice().sort((a, b) => {
        const va = vagasAtuais.includes(a.login), vb = vagasAtuais.includes(b.login);
        if (va !== vb) return va ? -1 : 1;
        const la = info[a.login] && info[a.login].aoVivo, lb = info[b.login] && info[b.login].aoVivo;
        if (la !== lb) return la ? -1 : 1;
        return 0;
      });
      if (!ordem.length) {
        repor(els.lista, h('p', { class: 'nota' }, 'Nenhum canal ainda.'));
        return;
      }
      repor(els.lista, ...ordem.map((c) => {
        const i = info[c.login] || {};
        const tocando = vagasAtuais.includes(c.login);
        const ganho = i.saldo !== null && i.saldo !== undefined && i.saldoInicial !== null && i.saldoInicial !== undefined ? i.saldo - i.saldoInicial : 0;
        const nB = Math.max(0, (baus[c.login] || 0) - (bausInicio[c.login] || 0));
        const status = i.inexistente ? 'canal não existe' : i.aoVivo === undefined ? 'carregando…' :
          i.aoVivo ? `ao vivo${i.jogo ? ' · ' + i.jogo : ''} · ${fmt(i.espectadores)}` : 'offline';
        return h('div', { class: 'card' + (tocando ? ' tocando' : '') + (i.aoVivo ? ' vivo' : '') },
          i.img ? h('img', { src: i.img, alt: '' }) : h('div', { class: 'ph' }),
          h('div', { class: 'meio' },
            h('div', { class: 'nome' }, i.nome || c.login,
              tocando ? h('span', { class: 'tag t1', title: 'Tocando agora: ganha pontos e baú' }, '▶ valendo')
                : i.aoVivo ? h('span', { class: 'tag', title: modo(c) === 'chat' ? 'Só presença no chat' : modo(c) === 'fixo' ? 'Fixo, esperando vaga' : 'Esperando a vez no rodízio' }, modo(c) === 'chat' ? 'só chat' : 'na fila') : null,
              noChat.has(c.login) ? h('span', { class: 'tag t2', title: 'Você está no chat deste canal' }, 'chat ✓') : null,
              pkComBonus().includes(c.login) ? h('span', { class: 'tag t3', title: 'Canal oficial do PokeIdle com bônus (lido do jogo)' }, 'PokeIdle') : null,
              pkComBonus().includes(c.login) && pk && i.aoVivo ? ((pk.assistindoEm || []).includes(c.login)
                ? h('span', { class: 'tag t2', title: 'O PokeIdle já te reconheceu neste canal' }, 'jogo te vê ✓')
                : h('span', { class: 'tag', title: 'O PokeIdle ainda não te reconheceu aqui. Ele confere de tempos em tempos; com o chat ✓ deve aparecer em alguns minutos' }, 'jogo ainda não viu')) : null),
            h('div', { class: 'st' }, status),
            h('div', { class: 'st' }, i.saldo === null ? 'sem pontos de canal' : `${fmt(i.saldo)} pts`,
              ganho > 0 ? h('b', { class: 'ganho' }, ` +${fmt(ganho)}`) : null,
              nB ? ` · ${nB} baú${nB > 1 ? 's' : ''}` : null)),
          h('div', { class: 'lado' },
            h('div', { class: 'bts' },
              i.aoVivo && !tocando && modo(c) !== 'chat'
                ? h('button', { class: 'ic agora', title: 'Ver agora: esta live entra numa vaga já e o rodízio continua dela', onclick: () => verAgora(c.login) }, '▶') : null,
              h('button', { class: 'ic' + (c.mostrar ? ' on' : ''), title: c.mostrar ? 'Vídeo aparece na sala (clique para esconder; continua contando)' : 'Vídeo toca escondido (clique para mostrar)', onclick: () => alternar(c.login, 'mostrar') }, c.mostrar ? '👁' : '◌'),
              h('button', { class: 'ic x', title: 'Tirar da lista', onclick: () => remover(c.login) }, '×')),
            h('div', { class: 'modos' },
              ...[['fixo', 'Fixo', 'Sempre tem vaga quando está ao vivo (fora do rodízio)'],
                ['rodizio', 'Rodízio', 'Entra na fila e reveza as vagas com os outros'],
                ['chat', 'Só chat', 'Nunca toca vídeo: fica só presente no chat']]
                .map(([m, rot, dica]) => h('button', { class: 'modo' + (modo(c) === m ? ' on' : ''), title: dica, onclick: () => definirModo(c.login, m) }, rot)))));
      }));
    }
    function renderDrops() {
      const linhas = drops.map((d) => {
        const pct = d.req ? Math.min(100, Math.round((d.min / d.req) * 100)) : 0;
        return h('div', { class: 'drop' },
          h('div', { class: 'st' }, h('b', {}, d.nome), ` · ${d.min}/${d.req} min`, d.ok ? null : ' · conecte a conta do jogo'),
          h('div', { class: 'barra' }, h('i', { style: `width:${pct}%` })));
      });
      const hoje = dropsResgatados.filter((d) => d.em > inicioSessao).length;
      repor(els.drops, 
        h('div', { class: 'tit' }, 'Drops', hoje ? h('span', { class: 'tag t2' }, `${hoje} resgatado${hoje > 1 ? 's' : ''}`) : null),
        ...(linhas.length ? linhas : [h('p', { class: 'nota' }, cfg.dropsAuto ? 'Nenhum Drop em andamento. Assista um canal com "Drops ativados" para começar.' : 'Resgate automático desligado.')]));
    }
    function renderBarra() {
      if (!els.barra) return;
      const conf = Date.now() - confirmarLimpar < 4000;
      repor(els.barra,
        h('button', { class: 'mini' + (conf ? ' perigo' : ''), title: 'Tira todos os canais da lista e desliga o "Seguir canais do PokeIdle"', onclick: () => limparTudo(false) }, conf ? 'Clique de novo para limpar' : 'Limpar lista'),
        h('button', { class: 'mini', title: pk ? 'Tira tudo e deixa só os canais oficiais com bônus do PokeIdle' : 'A Plateia ainda não leu o jogo: recarregue a aba do PokeIdle (F5)', disabled: !pk, onclick: () => limparTudo(true) }, 'Só canais do PokeIdle'));
    }
    let aba = 'canais';
    function renderAbas() {
      if (!els.abas) return;
      repor(els.abas,
        h('button', { class: 'aba' + (aba === 'canais' ? ' on' : ''), onclick: () => { aba = 'canais'; renderAbas(); } }, 'Canais'),
        h('button', { class: 'aba' + (aba === 'pokeidle' ? ' on' : ''), onclick: () => { aba = 'pokeidle'; renderAbas(); } }, 'PokeIdle'));
      els.abaCanais.style.display = aba === 'canais' ? '' : 'none';
      els.abaPk.style.display = aba === 'pokeidle' ? '' : 'none';
      if (aba === 'pokeidle' && P.painelPokeidle) repor(els.abaPk, P.painelPokeidle({ pk, pkk, plataforma: 'twitch' }));
    }
    function renderPokeidle() {
      if (aba === 'pokeidle') renderAbas();
      if (!els.pk) return;
      if (els.btPk) {
        els.btPk.disabled = !pk;
        els.btPk.title = pk
          ? 'Põe na lista os canais oficiais com bônus do PokeIdle (sem tirar os seus)'
          : 'A Plateia ainda não leu o jogo: recarregue a aba do PokeIdle (F5) depois de atualizar a extensão';
      }
      if (!pk) {
        repor(els.pk, h('p', { class: 'nota' }, 'PokeIdle: ainda sem dados do jogo. Se ele já está aberto, recarregue a aba do PokeIdle (F5) uma vez para a Plateia começar a ler os canais com bônus.'));
        return;
      }
      const eu = P.meuLogin();
      const vivos = pkComBonus().filter((l) => info[l] && info[l].aoVivo);
      const min = Math.round(pkIdade() / 60000);
      repor(els.pk,
        h('div', { class: 'st' }, h('b', {}, 'PokeIdle'),
          ` · ${pkComBonus().length} canais com bônus, ${vivos.length} ao vivo`,
          pkPct() ? ` · seu bônus ${pkPct()}` : null,
          min > 10 ? ` · dados de ${min} min atrás (abra o jogo)` : null),
        !pk.vinculado ? h('p', { class: 'aviso' }, 'Sua conta do PokeIdle não está vinculada à Twitch. Vincule no jogo (Bônus Twitch) para o bônus contar.') : null,
        pk.vinculado && eu && pk.login && pk.login !== eu ? h('p', { class: 'aviso' }, `O PokeIdle está vinculado a "${pk.login}", mas a Twitch aberta aqui é "${eu}". O bônus só conta na conta vinculada.`) : null,
        !cfg.seguirPokeidle ? h('p', { class: 'nota' }, 'Seguir canais do PokeIdle está desligado nos ajustes.') : null,
        pkk && (pkk.oficiais || []).length ? h('div', { class: 'st' }, h('b', {}, 'Kick'),
          ` · ${(pkk.oficiais || []).filter((o) => o.aoVivo).length}/${pkk.oficiais.length} oficiais ao vivo`,
          pkk.vinculado ? '' : ' · conta da Kick não vinculada no jogo') : null);
    }
    function renderAjustes() {
      const linha = (rotulo, ctrl, dica) => h('label', { class: 'aj' }, h('span', {}, rotulo, dica ? h('small', {}, dica) : null), ctrl);
      const chk = (campo) => h('input', { type: 'checkbox', checked: !!cfg[campo], onchange: (e) => { cfg[campo] = e.target.checked; salvar(); sincronizarPokeidle(); aplicarVagas(); sincronizarChat(); render(); } });
      const num = (campo, min, max) => h('input', { type: 'number', min, max, value: cfg[campo], onchange: (e) => { cfg[campo] = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min)); salvar(); aplicarVagas(); render(); } });
      repor(els.ajustes, 
        linha('Vagas (lives tocando)', num('vagas', 1, MAX_VAGAS), 'Quantas lives tocam o vídeo de verdade. Só elas ganham pontos e baú. A Twitch só paga em 2.'),
        vagasN() > 2 ? h('p', { class: 'aviso' }, 'Com mais de 2 lives tocando, as extras não ganham pontos e você pode deixar de contar como espectador em todas.') : null,
        linha('Rodízio entre os canais', chk('rodizio'), 'Troca quais lives estão valendo, para todos os canais ao vivo ganharem pontos e baú em algum momento. Desligado: ficam sempre as mesmas.'),
        linha('Minutos por rodada', num('rodizioMin', 10, 120), 'Tempo que cada par fica valendo antes de passar a vez. Mínimo 10 (pontos a cada 5 min, baú a cada ~15).'),
        linha('Presença no chat de todos', chk('presencaChat'), 'Entra no chat de todos os canais da lista, sem vídeo. É o que o PokeIdle usa para o bônus.'),
        linha('Seguir canais do PokeIdle', chk('seguirPokeidle'), 'Põe e tira da lista, sozinho, os canais oficiais com bônus que o jogo mostra (precisa do jogo aberto numa aba).'),
        linha('Baú automático', chk('bauAuto'), 'Clica no baú de +50 pontos assim que aparece, na sala e em qualquer aba da Twitch.'),
        linha('Drops automáticos', chk('dropsAuto'), 'Resgata o Drop quando chega a 100%.'),
        linha('Lives da sala em 160p', chk('qualidadeBaixa'), 'Lives da sala na menor qualidade: menos internet e PC. Sua Twitch normal não muda.'));
    }
    function renderLeve() { renderChips(); renderLista(); }
    function render() { renderAbas(); renderChips(); renderBarra(); renderLista(); renderDrops(); renderAjustes(); }

    P.aoMudar((m) => {
      if (m.baus) { baus = m.baus.newValue || {}; renderLeve(); }
      if (m.dropsResgatados) { dropsResgatados = m.dropsResgatados.newValue || []; renderDrops(); }
      if (m.pokeidle) { pk = m.pokeidle.newValue || null; sincronizarPokeidle(); renderLeve(); }
      if (m.pokeidleKick) { pkk = m.pokeidleKick.newValue || null; renderPokeidle(); }
    });

    function fecharSala() {
      salaAtiva = false;
      for (const fr of iframes.values()) fr.remove();
      iframes.clear();
      if (irc) irc.close();
      restaurarQualidade();
      clearInterval(t1); clearInterval(t2); clearInterval(t3); clearInterval(t4); clearInterval(t5);
      host.remove();
      delete document.documentElement.dataset.plateia;
      if (document.body) document.body.style.overflow = '';
      if (window.opener || window.name === 'plateia') { window.name = ''; window.close(); }
      history.replaceState(null, '', location.pathname);
      botaoAbrir();
    }
    window.addEventListener('beforeunload', restaurarQualidade);

    if (!P.token()) {
      repor(els.chips, chip('Entre na sua conta da Twitch para usar a sala', 'alerta'));
    }
    sincronizarPokeidle();
    render();
    await atualizar();
    conectarIRC();
    verDrops();
    const t1 = setInterval(atualizar, 60000);
    const t2 = setInterval(() => { girarSePreciso(); renderChips(); }, 5000);
    // relógio do rodízio andando de segundo em segundo (só troca o texto do chip)
    const t4 = setInterval(() => {
      if (els.relogio && els.relogio.isConnected) els.relogio.textContent = 'troca em ' + mmss(rodada.inicio + cfg.rodizioMin * 60000 - Date.now());
    }, 1000);
    const t3 = setInterval(verDrops, 120000);
    // vigia do chat: a cada minuto confere se está em todos os canais; conexão muda há 6 min = reconecta
    const t5 = setInterval(() => {
      if (irc && ircPronto && ultimaMsgIrc && Date.now() - ultimaMsgIrc > 6 * 60000) { try { irc.close(); } catch (e) {} return; }
      sincronizarChat();
    }, 60000);
  }

  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box}
  .app{--cor:#9147ff;position:fixed;inset:0;display:flex;flex-direction:column;background:#0e0e10;color:#efeff1;font:13px/1.4 Inter,Roobert,"Helvetica Neue",Arial,sans-serif}
  header{display:flex;align-items:center;gap:14px;padding:8px 14px;background:#18181b;border-bottom:1px solid #2f2f35}
  .marca{display:flex;align-items:center;gap:8px;color:#bf94ff;white-space:nowrap}
  .marca b{font-size:16px;color:#fff}
  .marca .sub{color:#adadb8}
  .ic{width:20px;height:20px}
  .chips{display:flex;flex-wrap:wrap;gap:6px;flex:1}
  .chip{background:#26262c;border:1px solid #35353b;border-radius:999px;padding:3px 9px;color:#dedee3;white-space:nowrap}
  .chip.ok{border-color:#00a86b55;color:#7ee2b8}
  .chip.alerta{border-color:#eb040055;color:#ff8280}
  .chip.off{opacity:.55}
  .chip.relogio{font-variant-numeric:tabular-nums;min-width:96px;text-align:center}
  .acoes{display:flex;gap:8px}
  .bt{background:#9147ff;color:#fff;border:0;border-radius:6px;padding:7px 11px;font:600 12px Inter,Arial,sans-serif;cursor:pointer}
  .bt:hover{background:#a970ff}
  .bt.sec{background:#35353b}
  .bt.sec:hover{background:#464649}
  .corpo{flex:1;display:flex;min-height:0}
  aside{width:410px;flex:none;display:flex;flex-direction:column;gap:10px;padding:12px;border-right:1px solid #2f2f35;overflow:auto;background:#121214}
  .add{display:flex;gap:6px}
  .add input{flex:1;background:#18181b;border:1px solid #464649;border-radius:6px;color:#fff;padding:7px 9px;font:13px Inter,Arial,sans-serif;outline:none}
  .add input:focus{border-color:#9147ff}
  .atalhos{display:flex;gap:12px}
  .lk{background:none;border:0;color:#bf94ff;cursor:pointer;padding:0;font:600 12px Inter,Arial,sans-serif}
  .lk:hover{text-decoration:underline}
  .lk:disabled{opacity:.45;cursor:default;text-decoration:none}
  .lista{display:flex;flex-direction:column;gap:6px}
  .card{display:flex;gap:9px;align-items:center;background:#18181b;border:1px solid #26262c;border-radius:8px;padding:7px;opacity:.7}
  .card.vivo{opacity:1}
  .card.tocando{border-color:#9147ff;box-shadow:inset 3px 0 0 #9147ff}
  .card img,.card .ph{width:38px;height:38px;border-radius:50%;flex:none;background:#26262c}
  .card.vivo img{outline:2px solid #eb0400;outline-offset:1px}
  .meio{flex:1;min-width:0}
  .nome{font-weight:700;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
  .st{color:#adadb8;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ganho{color:#7ee2b8}
  .tag{font-size:10.5px;font-weight:700;border-radius:4px;padding:1px 5px;background:#35353b;color:#dedee3}
  .tag.t1{background:#9147ff;color:#fff}
  .tag.t2{background:#00a86b33;color:#7ee2b8}
  .tag.t3{background:#ffb31a33;color:#ffd37a}
  .pk{background:#18181b;border:1px solid #3a2f1a;border-radius:8px;padding:7px 8px}
  .pk .st{white-space:normal}
  .aj small{display:block;color:#8d8d97;font-size:11px;font-weight:400;margin-top:1px;line-height:1.3}
  .aj span{flex:1}
  .bts{display:flex;gap:3px}
  .bts .ic{width:28px;height:28px;border-radius:6px;border:1px solid #35353b;background:#1f1f23;color:#adadb8;cursor:pointer;font-size:14px;line-height:1}
  .bts .ic.on{color:#fff;border-color:#9147ff;background:#9147ff33}
  .bts .ic.x:hover{color:#ff8280;border-color:#eb0400}
  .bts .ic.agora{color:#fff;background:#9147ff;border-color:#9147ff}
  .lado{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
  .modos{display:flex;border:1px solid #35353b;border-radius:6px;overflow:hidden}
  .modo{background:#1f1f23;color:#adadb8;border:0;border-left:1px solid #35353b;padding:3px 6px;font:600 10.5px Inter,Arial,sans-serif;cursor:pointer}
  .modo:first-child{border-left:0}
  .modo.on{background:#9147ff;color:#fff}
  .barra-lista{display:flex;gap:6px}
  .mini{background:#26262c;color:#dedee3;border:1px solid #35353b;border-radius:6px;padding:4px 8px;font:600 11.5px Inter,Arial,sans-serif;cursor:pointer}
  .mini:hover{border-color:#9147ff}
  .mini:disabled{opacity:.45;cursor:default}
  .mini.perigo{background:#eb040033;border-color:#eb0400;color:#ff8280}
  .drops{background:#18181b;border:1px solid #26262c;border-radius:8px;padding:8px}
  .tit{font-weight:700;display:flex;gap:6px;align-items:center;margin-bottom:4px}
  .drop{margin-top:6px}
  .barra{height:5px;background:#26262c;border-radius:3px;overflow:hidden;margin-top:3px}
  .barra i{display:block;height:100%;background:#9147ff}
  .ajustes summary{cursor:pointer;color:#bf94ff;font-weight:700}
  .aj{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #26262c}
  .aj input[type=number]{width:62px;background:#18181b;border:1px solid #464649;border-radius:5px;color:#fff;padding:4px}
  .aj input[type=checkbox]{accent-color:#9147ff;width:16px;height:16px}
  .aviso{color:#ff8280;font-size:12px;margin:4px 0}
  .nota{color:#adadb8;font-size:12px;margin:0}
  .assina{color:#adadb8;font-size:11px;margin-top:auto;align-self:flex-end}
  .assina a{color:#bf94ff;font-weight:700;text-decoration:none}
  .assina a:hover{text-decoration:underline}
  .palco{flex:1;display:grid;gap:4px;padding:4px;min-width:0;background:#000;position:relative;grid-auto-rows:1fr}
  .palco iframe{width:100%;height:100%;border:0;background:#000;border-radius:4px;min-height:0}
  iframe.oculto{position:fixed!important;left:0;bottom:0;width:2px!important;height:2px!important;opacity:0;pointer-events:none;border:0}
  .vazio{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#adadb8;text-align:center;padding:40px}
  `;
})();
