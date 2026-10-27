// Plateia — Kick: botão, sala de multi-live, resgate do PokeIdle, Daily Reward e Drops (feito por Dreds)
(() => {
  const P = window.PLATEIA;
  if (!P || !P.ui || P.kickIniciado) return;
  P.kickIniciado = true;
  const { h, repor, fmt, mmss, logo, assinatura, duracao, hhmm } = P.ui;

  const tr = (txt, vars) => P.t(txt, vars);
  const NOME_JANELA = 'plateia-kick';
  const X_CLIENT_TOKEN = 'e1393935a959b4020a4491574f6490129f678acdaa92760471263db43487f823'; // constante pública do site da Kick
  const MAX_VAGAS = 4;
  const slugValido = (s) => /^[a-z0-9_-]{2,40}$/.test(s || '');
  const limparSlug = (s) => String(s || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?kick\.com\//, '').replace(/^[@#]/, '').split(/[/?#\s]/)[0];
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- dentro de uma live da sala (iframe) ----------
  const naSalaKick = (() => {
    try { return window.top !== window && window.top.document.documentElement.dataset.plateia === 'sala-kick'; } catch (e) { return false; }
  })();
  if (naSalaKick) {
    const cuidar = () => {
      const v = document.querySelector('video');
      if (!v) return;
      if (!v.muted) v.muted = true;
      if (v.paused && !v.ended) v.play().catch(() => {});
    };
    setTimeout(cuidar, 4000);
    setInterval(cuidar, 15000);
    return;
  }
  if (window.top !== window) return;

  // ---------- API da Kick (com o login do próprio site) ----------
  const sessao = () => P.cookie('session_token');
  async function api(url, opts = {}) {
    const tok = sessao();
    if (!tok) throw new Error(tr('sem login'));
    const cab = { Accept: 'application/json', Authorization: 'Bearer ' + tok };
    if (url.startsWith('https://web.kick.com') || url.includes('/redeem')) cab['X-Client-Token'] = X_CLIENT_TOKEN;
    const xsrf = P.cookie('XSRF-TOKEN');
    if (xsrf && opts.method && opts.method !== 'GET') cab['X-XSRF-TOKEN'] = xsrf;
    if (opts.body) cab['Content-Type'] = 'application/json';
    const r = await P.fetch(url.startsWith('http') ? url : 'https://kick.com' + url, {
      method: opts.method || 'GET', credentials: 'include', cache: 'no-store', headers: cab,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let j = null;
    try { j = await P.lerJson(r); } catch (e) {}
    if (!r.ok) { const e = new Error((j && (j.message || j.error)) || ('HTTP ' + r.status)); e.status = r.status; e.corpo = j; throw e; }
    return j;
  }

  // ---------- botão flutuante ----------
  const URL_SALA = P.URL_SALA_KICK;
  function abrirSala() {
    const w = window.open(URL_SALA, NOME_JANELA, 'popup=yes,width=1440,height=900');
    if (!w) location.href = URL_SALA;
  }
  function botaoAbrir() {
    if (document.getElementById('plateia-lancador')) return;
    const host = h('div', { id: 'plateia-lancador' });
    const raiz = host.attachShadow({ mode: 'open' });
    raiz.appendChild(h('style', {}, `
      button{position:fixed;left:14px;bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:7px;
        background:#53fc18;color:#0b0b0c;border:0;border-radius:999px;padding:6px 14px 6px 6px;font:700 13px/1 Inter,Arial,sans-serif;
        box-shadow:0 4px 14px rgba(0,0,0,.45);cursor:pointer;opacity:.94}
      button:hover{opacity:1;filter:brightness(1.08)}` + P.ui.CSS_BOLINHA));
    const bt = h('button', { title: tr('Abrir a sala de multi-live da Plateia (Kick)'), onclick: abrirSala }, logo(22), 'Plateia');
    raiz.appendChild(bt);
    P.ui.marcarNovidade(bt);
    document.documentElement.appendChild(host);
    // regra 14: tutorial, novidades e versão nova aparecem sozinhos aqui, sem abrir a sala
    P.ui.avisosSite({ sala: 'kick', abrirSala });
  }

  let salaAtiva = false;
  function talvez() {
    if (salaAtiva) return;
    if (location.hash === '#plateia' || window.name === NOME_JANELA) iniciarSala();
    else botaoAbrir();
  }
  window.addEventListener('hashchange', talvez);
  P.idiomaPronto.then(talvez);

  // ---------- sala ----------
  async function iniciarSala() {
    salaAtiva = true;
    await P.idiomaPronto;
    const ehJanela = !!window.opener || window.name === NOME_JANELA;
    window.name = NOME_JANELA;
    document.documentElement.dataset.plateia = 'sala-kick';
    const lanc = document.getElementById('plateia-lancador');
    if (lanc) lanc.remove();
    const avisos = document.getElementById('plateia-avisos');
    if (avisos) { if (P.avisos) P.avisos.parar(); avisos.remove(); }

    let cfg = await P.configKick();
    const salvar = () => P.gravar('configKick', cfg);
    let pk = await P.ler('pokeidle', null);
    let pkk = await P.ler('pokeidleKick', null);
    let resgates = await P.ler('kickResgates', []);
    let eventos = await P.ler('kickEventos', []); // diária e drops
    const info = {};      // slug -> {nome, img, aoVivo, espectadores, jogo, saldo, saldoInicial}
    const pacotes = {};   // slug -> {itens:[{id,tipo,titulo,custo}], custo, em}
    const iframes = new Map();
    let vagasAtuais = [];
    let eu = '';
    let erro = '';
    let aba = 'canais';
    let diaria = null, drops = [];
    let resgatando = false;
    const bloqueioResgate = {}; // slug -> até quando não tentar de novo

    const host = h('div', { id: 'plateia-sala' });
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483000';
    const raiz = host.attachShadow({ mode: 'open' });
    raiz.appendChild(h('style', {}, P.ui.cssSala('kick') + P.CSS_PAINEL + P.ui.CSS_ATUALIZACAO));
    const ic = P.ui.icone;
    const els = {};
    raiz.appendChild(h('div', { class: 'app' },
      h('header', {},
        h('div', { class: 'marca' }, logo(24), h('b', {}, 'Plateia'), h('span', { class: 'sub' }, tr('sala da Kick'))),
        els.chips = h('div', { class: 'chips' }),
        h('div', { class: 'acoes' },
          els.ajuda = h('span', { class: 'ajuda' }),
          ehJanela ? null : h('button', { class: 'bt sec', onclick: abrirSala, title: tr('Abre a sala numa janela só dela') }, ic('janela'), tr('Abrir em janela própria')),
          h('button', { class: 'bt fantasma', onclick: fecharSala, title: tr('Fecha a sala (as lives param de contar)') }, ic('sair'), tr('Fechar sala')))),
      h('div', { class: 'corpo' },
        h('aside', {},
          els.abas = h('div', { class: 'abas' }),
          els.conteudo = h('div', { class: 'conteudo' }),
          P.ui.atualizacao({ sala: 'Kick', diagnostico: () => diagnosticoSala() }),
          h('div', { class: 'rodape-fim' }, assinatura(), P.ui.seletorIdioma())),
        els.palco = h('main', { class: 'palco' },
          els.vazio = h('div', { class: 'vazio' }, ic('tela', 44), els.vazioTxt = h('span', {}, tr('Adicione canais na lista. As 2 lives que estão valendo aparecem aqui.')))))));
    document.documentElement.appendChild(host);
    if (document.body) document.body.style.overflow = 'hidden';
    document.title = tr('Plateia · sala da Kick');
    // tutorial (1ª vez) e novidades (depois de atualizar), regra 12
    const qd = P.ui.quadros({ app: raiz.querySelector('.app'), sala: 'kick' });
    els.ajuda.replaceWith(qd.botao);
    P.quadros = qd; // usado pelos testes
    qd.checar();

    // diagnóstico do "Relatar bug": só números e estados, sem nome de canal, login ou token
    function diagnosticoSala() {
      const dia = Date.now() - 24 * 3600e3;
      const r24 = resgates.filter((r) => r.em > dia);
      return [
        [tr('Login na Kick'), sessao() ? tr('sim') : tr('não')],
        [tr('Canais na lista'), tr('{t} ({v} ao vivo; fixos {f}, fora {o})', { t: cfg.canais.length, v: cfg.canais.filter((c) => aoVivo(c.slug)).length, f: cfg.canais.filter((c) => modo(c) === 'fixo').length, o: cfg.canais.filter((c) => modo(c) === 'fora').length })],
        [tr('Valendo'), `${vagasAtuais.length}/${vagasN()}`],
        [tr('Resgate automático'), cfg.resgateAuto ? tr('ligado') : tr('desligado')],
        [tr('PokeIdle (Kick)'), pkk ? (pkk.vinculado ? tr('vinculado') : tr('não vinculado')) + (pkk.vinculado && pkk.login && eu ? ' · ' + (pkk.login.toLowerCase() === eu.toLowerCase() ? tr('mesma conta') : tr('OUTRA conta')) : '') + ' · ' + tr('{n} canais oficiais', { n: (pkk.oficiais || []).length }) : tr('sem dados do jogo')],
        [tr('Pacotes lidos'), tr('{a} completos, {b} com erro', { a: Object.values(pacotes).filter((p) => p.itens.length === 3).length, b: Object.values(pacotes).filter((p) => p.erro).length })],
        [tr('Resgates em 24 h'), tr('{a} ok, {b} falharam', { a: r24.filter((r) => r.ok).length, b: r24.filter((r) => !r.ok).length }) + (r24.find((r) => !r.ok) ? ' (' + tr('último: {e}', { e: r24.find((r) => !r.ok).erro }) + ')' : '')],
        [tr('Daily Reward'), diaria ? (diaria.pega ? tr('pega') : `${diaria.prog}/${diaria.meta} min`) : tr('sem dados')],
        [tr('Drops em andamento'), String(drops.length)],
        [tr('Erro da Kick'), erro || tr('nenhum')],
      ];
    }

    // ----- canais -----
    const modo = (c) => c.modo || 'fila';
    function adicionar(bruto) {
      const slug = limparSlug(bruto);
      if (!slugValido(slug) || cfg.canais.some((c) => c.slug === slug)) return;
      cfg.canais.push({ slug, mostrar: true, modo: 'fila' });
      cfg.pkIgnorar = cfg.pkIgnorar.filter((x) => x !== slug);
      salvar(); render(); atualizar();
    }
    function remover(slug) {
      const c = cfg.canais.find((x) => x.slug === slug);
      if (c && c.origem === 'pokeidle' && !cfg.pkIgnorar.includes(slug)) cfg.pkIgnorar.push(slug);
      cfg.canais = cfg.canais.filter((x) => x.slug !== slug);
      salvar(); aplicarVagas(); render();
    }
    function definir(slug, campo, valor) {
      const c = cfg.canais.find((x) => x.slug === slug);
      if (!c) return;
      c[campo] = valor === undefined ? !c[campo] : valor;
      salvar(); aplicarVagas(); render();
    }
    let confirmarLimpar = 0;
    function limpar(soPokeidle) {
      if (!soPokeidle && Date.now() - confirmarLimpar > 4000) { confirmarLimpar = Date.now(); render(); setTimeout(render, 4100); return; }
      confirmarLimpar = 0;
      cfg.canais = []; cfg.pkIgnorar = []; cfg.seguirPokeidle = !!soPokeidle;
      salvar(); sincronizarPokeidle(); aplicarVagas(); render();
    }
    async function puxarSeguidos() {
      try {
        const j = await api('/api/v2/channels/followed');
        for (const c of (j && j.channels) || []) {
          const slug = c.channel_slug || c.slug;
          if (slugValido(slug) && (c.is_live || (c.livestream && c.livestream.is_live))) adicionar(slug);
        }
      } catch (e) { erro = tr('seguidos: {e}', { e: e.message }); render(); }
    }

    // ----- PokeIdle na Kick -----
    const oficiaisPk = () => ((pkk && pkk.oficiais) || []).filter((o) => o.ativo !== false).map((o) => o.slug);
    function sincronizarPokeidle() {
      if (!cfg.seguirPokeidle || !pkk) return;
      const alvo = oficiaisPk().filter((s) => slugValido(s) && !cfg.pkIgnorar.includes(s));
      if (!alvo.length) return;
      let mudou = false;
      for (const slug of alvo) if (!cfg.canais.some((c) => c.slug === slug)) { cfg.canais.push({ slug, mostrar: true, modo: 'fila', origem: 'pokeidle' }); mudou = true; }
      const antes = cfg.canais.length;
      cfg.canais = cfg.canais.filter((c) => c.origem !== 'pokeidle' || alvo.includes(c.slug));
      if (mudou || antes !== cfg.canais.length) { salvar(); aplicarVagas(); render(); atualizar(); }
    }
    const ehPokeidle = (slug) => oficiaisPk().includes(slug) || (cfg.canais.find((c) => c.slug === slug) || {}).origem === 'pokeidle';

    // recompensas do PokeIdle num canal: uma de cada tipo (XP, Capture Boost, Secret Lure)
    function tipoDaRecompensa(r) {
      const t = `${r.title || ''} ${r.description || ''}`;
      if (!/poke\s*idle/i.test(t)) return null;
      if (/secret\s*lure|shiny/i.test(t)) return 'shiny';
      if (/captur/i.test(t)) return 'captura';
      if (/\bxp\b/i.test(t)) return 'xp';
      return null;
    }
    async function lerPacote(slug) {
      const p = pacotes[slug];
      if (p && Date.now() - p.em < 10 * 60000) return p;
      try {
        const j = await api(`/api/v2/channels/${slug}/rewards`);
        const itens = {};
        for (const r of (j && j.data) || []) {
          const tipo = tipoDaRecompensa(r);
          if (!tipo || !r.is_enabled || r.is_paused || r.is_user_input_required) continue;
          if (!itens[tipo] || r.cost < itens[tipo].custo) itens[tipo] = { id: r.id, tipo, titulo: r.title, custo: Number(r.cost) || 0 };
        }
        const lista = ['xp', 'captura', 'shiny'].map((t) => itens[t]).filter(Boolean);
        pacotes[slug] = { itens: lista, custo: lista.reduce((s, i) => s + i.custo, 0), em: Date.now() };
      } catch (e) {
        pacotes[slug] = { itens: [], custo: 0, em: Date.now(), erro: e.message };
      }
      return pacotes[slug];
    }

    // resgata o pacote inteiro (um de cada) quando o saldo do canal cobre a soma
    async function talvezResgatar() {
      if (!cfg.resgateAuto || resgatando) return;
      if (!pkk || !pkk.vinculado) return; // sem vínculo no jogo os pontos seriam perdidos
      if (pkk.login && eu && pkk.login.toLowerCase() !== eu.toLowerCase()) return; // jogo vinculado a outra conta
      for (const c of cfg.canais) {
        const slug = c.slug;
        if (!ehPokeidle(slug)) continue;
        if (bloqueioResgate[slug] && Date.now() < bloqueioResgate[slug]) continue;
        const pac = await lerPacote(slug);
        const saldo = info[slug] && info[slug].saldo;
        if (!pac.itens.length || pac.itens.length < 3 || !pac.custo || pac.custo > 20000) continue; // só pacote completo
        if (typeof saldo !== 'number' || saldo < pac.custo) continue;
        resgatando = true;
        try {
          for (const item of pac.itens) {
            const reg = { em: Date.now(), slug, tipo: item.tipo, titulo: item.titulo, custo: item.custo, ok: false };
            try {
              const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(16).slice(2);
              await api(`/api/v2/channels/${slug}/rewards/${item.id}/redeem`, { method: 'POST', body: { transaction_id: id, message: '' } });
              reg.ok = true;
            } catch (e) {
              reg.erro = e.message + (e.status ? ` (${e.status})` : '');
              bloqueioResgate[slug] = Date.now() + 15 * 60000;
            }
            resgates.unshift(reg);
            resgates = resgates.slice(0, 60);
            await P.gravar('kickResgates', resgates);
            render();
            if (!reg.ok) break;
            await espera(2500 + Math.random() * 2000);
          }
        } finally { resgatando = false; }
        await atualizarSaldos([slug]);
        aplicarVagas(); render();
      }
    }

    // ----- dados da Kick -----
    async function atualizar() {
      const slugs = cfg.canais.map((c) => c.slug).filter(slugValido);
      erro = '';
      for (const slug of slugs) {
        try {
          const j = await api(`/api/v2/channels/${slug}`);
          const ant = info[slug] || {};
          const ls = j && j.livestream;
          info[slug] = Object.assign(ant, {
            nome: (j && j.user && j.user.username) || slug,
            img: j && j.user && j.user.profile_pic,
            aoVivo: !!(ls && (ls.is_live === undefined || ls.is_live)),
            espectadores: ls ? ls.viewer_count : 0,
            jogo: ls && ls.categories && ls.categories[0] ? ls.categories[0].name : ''
          });
        } catch (e) {
          info[slug] = Object.assign(info[slug] || {}, e.status === 404 ? { inexistente: true } : {});
          if (e.status !== 404) erro = e.message;
        }
      }
      await atualizarSaldos(slugs);
      for (const slug of slugs) if (ehPokeidle(slug)) await lerPacote(slug);
      aplicarVagas(); render();
      talvezResgatar();
    }
    P.kickAtualizar = atualizar; // usado pelos testes
    async function atualizarSaldos(slugs) {
      for (const slug of slugs) {
        try {
          const j = await api(`/api/v2/channels/${slug}/points`);
          const pts = j && j.data && typeof j.data.points === 'number' ? j.data.points : (j && typeof j.points === 'number' ? j.points : null);
          const i = info[slug] = info[slug] || {};
          i.saldo = pts;
          if (i.saldoInicial === undefined || i.saldoInicial === null) i.saldoInicial = pts;
        } catch (e) { /* tenta na próxima */ }
      }
    }

    // ----- Daily Reward e Drops -----
    async function registrarEvento(ev) {
      eventos.unshift(Object.assign({ em: Date.now() }, ev));
      eventos = eventos.slice(0, 40);
      await P.gravar('kickEventos', eventos);
    }
    async function verDiaria() {
      try {
        const j = await api('https://web.kick.com/api/v1/gamification/challenges');
        const lista = (j && j.data) || [];
        const d = lista.find((c) => /daily/i.test(c.name || '') || c.recurrence === 'daily') || null;
        diaria = d ? { id: d.id, prog: d.condition ? d.condition.progress : 0, meta: d.condition ? d.condition.threshold : 60, status: d.status, pega: !!d.claimed_at || /claimed|completed_claimed/i.test(d.status || '') } : null;
        if (cfg.diariaAuto) {
          for (const c of lista) {
            const cond = c.condition || {};
            if (c.claimed_at || /claimed/i.test(c.status || '')) continue;
            if (typeof cond.progress === 'number' && cond.progress >= cond.threshold) {
              try {
                const r = await api(`https://web.kick.com/api/v1/gamification/challenges/${c.id}/claim`, { method: 'POST', body: {} });
                const raridade = r && r.data && r.data.winner && r.data.winner.rarity;
                await registrarEvento({ tipo: 'diaria', ok: true, texto: tr('{n} pega', { n: c.name || tr('Recompensa') }) + (raridade ? ' (' + raridade + ')' : '') });
              } catch (e) { await registrarEvento({ tipo: 'diaria', ok: false, texto: `${c.name || tr('Recompensa')}: ${e.message}` }); }
            }
          }
        }
      } catch (e) { /* sem acesso agora */ }
      render();
    }
    async function verDrops() {
      try {
        const j = await api('https://web.kick.com/api/v1/drops/progress');
        drops = [];
        for (const camp of (j && j.data) || []) {
          for (const r of camp.rewards || []) {
            const item = { campanha: camp.name, nome: r.name, min: camp.progress_units || 0, req: r.required_units || 0, pego: !!r.claimed, conectado: camp.user_app_connected !== false };
            if (!item.pego) drops.push(item);
            if (cfg.dropsAuto && !item.pego && item.conectado && item.req && item.min >= item.req) {
              try {
                await api('https://web.kick.com/api/v1/drops/claim', { method: 'POST', body: { campaign_id: camp.id, reward_id: r.id } });
                await registrarEvento({ tipo: 'drop', ok: true, texto: `Drop: ${r.name}` });
              } catch (e) { await registrarEvento({ tipo: 'drop', ok: false, texto: `Drop ${r.name}: ${e.message}` }); }
            }
          }
        }
      } catch (e) { /* sem acesso agora */ }
      render();
    }

    // ----- vagas (modo foco: o canal do PokeIdle mais perto de fechar o pacote fica tocando) -----
    const vagasN = () => Math.max(1, Math.min(MAX_VAGAS, cfg.vagas | 0 || 2));
    const aoVivo = (slug) => !!(info[slug] && info[slug].aoVivo);
    function prioridade(slug) {
      const pac = pacotes[slug], saldo = info[slug] && info[slug].saldo;
      if (ehPokeidle(slug) && pac && pac.custo && typeof saldo === 'number') return Math.max(0, pac.custo - saldo); // falta pouco = primeiro
      if (ehPokeidle(slug)) return 1e7;
      return 1e8;
    }
    function escolherVagas() {
      const n = vagasN();
      const fixos = cfg.canais.filter((c) => modo(c) === 'fixo' && aoVivo(c.slug)).map((c) => c.slug).slice(0, n);
      const fila = cfg.canais.filter((c) => modo(c) === 'fila' && aoVivo(c.slug)).map((c) => c.slug);
      const out = fixos.slice();
      // modo foco: os canais do PokeIdle mais perto de fechar o pacote tocam primeiro (fecham o pacote mais cedo)
      const resto = fila.filter((s) => !out.includes(s)).sort((a, b) => prioridade(a) - prioridade(b));
      while (out.length < n && resto.length) out.push(resto.shift());
      return out;
    }
    function aplicarVagas() {
      const alvo = escolherVagas();
      for (const [slug, fr] of iframes) if (!alvo.includes(slug)) { fr.remove(); iframes.delete(slug); }
      for (const slug of alvo) {
        if (iframes.has(slug)) continue;
        const fr = h('iframe', { src: 'https://kick.com/' + slug, title: slug, allow: 'autoplay; fullscreen' });
        fr.dataset.slug = slug;
        iframes.set(slug, fr);
        els.palco.appendChild(fr);
      }
      vagasAtuais = alvo;
      let visiveis = 0;
      for (const [slug, fr] of iframes) {
        const c = cfg.canais.find((x) => x.slug === slug);
        const mostrar = !c || c.mostrar;
        fr.classList.toggle('oculto', !mostrar);
        if (mostrar) visiveis++;
      }
      els.palco.style.gridTemplateColumns = `repeat(${Math.max(1, Math.ceil(Math.sqrt(visiveis)))}, 1fr)`;
      els.vazio.style.display = visiveis ? 'none' : '';
      els.vazioTxt.textContent = iframes.size && !visiveis ? tr('As lives valendo estão tocando escondidas. Clique no olho de um canal para ver.') : tr('Adicione canais na lista. As 2 lives que estão valendo aparecem aqui.');
    }
    function verAgora(slug) {
      if (!aoVivo(slug)) return;
      const c = cfg.canais.find((x) => x.slug === slug);
      if (c && modo(c) === 'fora') c.modo = 'fila';
      // na Kick as vagas seguem o pacote mais perto de fechar; "ver agora" fixa o canal (volte para Fila quando quiser)
      if (c) c.modo = 'fixo';
      salvar(); aplicarVagas(); render();
    }

    // ----- render -----
    const chip = (txt, cls, title) => h('span', { class: 'chip ' + (cls || ''), title }, txt);
    function renderChips() {
      const total = cfg.canais.length;
      const vivos = cfg.canais.filter((c) => aoVivo(c.slug)).length;
      const ganho = cfg.canais.reduce((s, c) => { const i = info[c.slug]; return s + (i && typeof i.saldo === 'number' && typeof i.saldoInicial === 'number' ? Math.max(0, i.saldo - i.saldoInicial) : 0); }, 0);
      const pacotesHoje = resgates.filter((r) => r.ok && r.tipo === 'shiny' && r.em > Date.now() - 24 * 3600e3).length;
      const ativos = pkk ? Object.values(pkk.bonus || {}).filter((ate) => Number(ate) > Date.now()) : [];
      const maior = ativos.length ? Math.max(...ativos.map(Number)) - Date.now() : 0;
      repor(els.chips,
        chip(tr('{v}/{t} ao vivo', { v: vivos, t: total }), '', tr('Canais da lista ao vivo agora / total')),
        chip(tr('valendo {n}/{t}', { n: vagasAtuais.length, t: vagasN() }), vagasN() > 2 ? 'alerta' : 'ok', tr('Lives tocando de verdade. A Kick só paga pontos em 2 por vez (medido)')),
        chip(tr('+{p} pts', { p: fmt(ganho) }), 'ok', tr('Pontos ganhos desde que a sala abriu')),
        pkk ? chip(ativos.length ? tr('PokeIdle: {n} bônus · {d}', { n: ativos.length, d: duracao(maior) }) : tr('PokeIdle: sem bônus ativo'), ativos.length ? 'ok' : '', tr('Bônus da Kick no PokeIdle (horas compradas com pontos)')) : null,
        pacotesHoje ? chip(tr(pacotesHoje > 1 ? tr('{n} pacotes em 24 h') : tr('{n} pacote em 24 h'), { n: pacotesHoje }), 'ok', tr('Pacotes XP + Capture + Lure comprados nas últimas 24 h')) : null,
        diaria ? chip(diaria.pega ? tr('diária pega ✓') : tr('diária {a}/{b} min', { a: Math.min(diaria.prog, diaria.meta), b: diaria.meta }), diaria.pega ? 'ok' : '', tr('Daily Reward da Kick: 1 h assistida no dia')) : null,
        erro ? chip('Kick: ' + erro, 'alerta', tr('Erro ao falar com a Kick; tenta de novo sozinha')) : null,
        !sessao() ? chip(tr('Entre na sua conta da Kick'), 'alerta') : null);
    }
    function renderAbas() {
      repor(els.abas,
        h('button', { class: 'aba' + (aba === 'canais' ? ' on' : ''), onclick: () => { aba = 'canais'; render(); } }, tr('Canais'), cfg.canais.length ? h('span', { class: 'cont' }, String(cfg.canais.length)) : null),
        h('button', { class: 'aba' + (aba === 'pokeidle' ? ' on' : ''), onclick: () => { aba = 'pokeidle'; render(); } }, 'PokeIdle'),
        h('button', { class: 'aba' + (aba === 'ajustes' ? ' on' : ''), onclick: () => { aba = 'ajustes'; render(); } }, tr('Ajustes')));
    }
    function cardCanal(c) {
      const i = info[c.slug] || {};
      const tocando = vagasAtuais.includes(c.slug);
      const pac = pacotes[c.slug];
      const ganho = typeof i.saldo === 'number' && typeof i.saldoInicial === 'number' ? i.saldo - i.saldoInicial : 0;
      const status = i.inexistente ? tr('canal não existe') : i.aoVivo === undefined ? tr('carregando…') : i.aoVivo ? (i.jogo || tr('ao vivo')) + ' · ' + tr('{n} assistindo', { n: fmt(i.espectadores) }) : tr('offline');
      return h('div', { class: 'card' + (tocando ? ' tocando' : '') + (i.aoVivo ? ' vivo' : '') },
        i.img ? h('img', { src: i.img, alt: '' }) : h('div', { class: 'ph' }),
        h('div', { class: 'meio' },
          h('div', { class: 'nome' }, i.nome || c.slug,
            tocando ? h('span', { class: 'tag t1' }, ic('play', 9), tr('valendo')) : i.aoVivo && modo(c) !== 'fora' ? h('span', { class: 'tag' }, tr('na fila')) : null),
          h('div', { class: 'st' }, status),
          h('div', { class: 'st' }, typeof i.saldo === 'number' ? tr('{n} pts', { n: fmt(i.saldo) }) : tr('{n} pts', { n: '—' }),
            ganho > 0 ? h('b', { class: 'ganho' }, ` +${fmt(ganho)}`) : null,
            pac && pac.custo ? ' · ' + tr('pacote {n}', { n: fmt(pac.custo) }) : null),
          h('div', { class: 'tags' },
            ehPokeidle(c.slug) ? h('span', { class: 'tag t3', title: tr('Canal oficial do PokeIdle na Kick (lido do jogo)') }, 'PokeIdle') : null)),
        h('div', { class: 'lado' },
          h('div', { class: 'bts' },
            i.aoVivo && !tocando && modo(c) !== 'fora' ? h('button', { class: 'ic agora', title: tr('Ver agora: fixa esta live numa vaga (volte para Fila quando quiser)'), 'aria-label': tr('Ver agora'), onclick: () => verAgora(c.slug) }, ic('play', 14)) : null,
            h('button', { class: 'ic' + (c.mostrar ? ' on' : ''), title: c.mostrar ? tr('Vídeo aparece na sala (clique para esconder; continua contando)') : tr('Vídeo toca escondido (clique para mostrar)'), 'aria-label': c.mostrar ? tr('Esconder vídeo') : tr('Mostrar vídeo'), onclick: () => definir(c.slug, 'mostrar') }, ic(c.mostrar ? 'olho' : 'olhoFechado')),
            h('button', { class: 'ic x', title: tr('Tirar da lista'), 'aria-label': tr('Tirar da lista'), onclick: () => remover(c.slug) }, ic('x', 14))),
          h('div', { class: 'modos' },
            ...[['fixo', tr('Fixo'), tr('Sempre tem vaga quando está ao vivo')], ['fila', tr('Fila'), tr('Entra numa vaga quando sobrar (PokeIdle: primeiro o que está mais perto de fechar o pacote)')], ['fora', tr('Fora'), tr('Nunca toca: só acompanha o saldo')]]
              .map(([m, rot, dica]) => h('button', { class: 'modo' + (modo(c) === m ? ' on' : ''), title: dica, onclick: () => definir(c.slug, 'modo', m) }, rot)))));
    }
    // resumo do PokeIdle no topo da aba Canais (o que importa na Kick: vínculo, bônus comprados, próximo pacote)
    function resumoPokeidle() {
      if (!pkk) return h('div', { class: 'pk' }, h('p', { class: 'nota' }, tr('PokeIdle: ainda sem dados do jogo. Com o PokeIdle aberto numa aba, recarregue a aba do jogo (F5) uma vez.')));
      const agora = Date.now();
      const oficiais = (pkk.oficiais || []).filter((o) => o.ativo !== false);
      const vivos = oficiais.filter((o) => o.aoVivo).length;
      const nomes = { xp: 'XP', captura: 'Capture', shiny: 'Lure' };
      const ativos = Object.entries(pkk.bonus || {}).filter(([, ate]) => Number(ate) > agora).sort((a, b) => Number(b[1]) - Number(a[1]));
      const outraConta = pkk.vinculado && pkk.login && eu && pkk.login.toLowerCase() !== eu.toLowerCase();
      // próximo pacote: canal do PokeIdle com pacote completo que está mais perto de fechar
      let prox = null;
      for (const c of cfg.canais) {
        if (!ehPokeidle(c.slug)) continue;
        const pac = pacotes[c.slug]; const saldo = (info[c.slug] || {}).saldo;
        if (!pac || pac.itens.length < 3 || !pac.custo || typeof saldo !== 'number') continue;
        const falta = Math.max(0, pac.custo - saldo);
        if (!prox || falta < prox.falta) prox = { slug: c.slug, nome: (info[c.slug] || {}).nome || c.slug, falta, tocando: vagasAtuais.includes(c.slug) };
      }
      const tw = pk && pk.vinculado ? P.pkPct(pk.pct) : '';
      return h('div', { class: 'pk' },
        !pkk.vinculado ? h('p', { class: 'aviso' }, tr('Kick não vinculada no PokeIdle: o resgate automático está parado para você não perder pontos. Vincule no jogo (Bônus na Kick).')) : null,
        outraConta ? h('p', { class: 'aviso' }, tr('O PokeIdle está vinculado a "{a}", mas a Kick aberta aqui é "{b}". O resgate só roda na conta vinculada.', { a: pkk.login, b: eu })) : null,
        h('div', { class: 'st' }, h('b', {}, 'PokeIdle'), ' · ' + tr('{v}/{n} canais oficiais ao vivo', { v: vivos, n: oficiais.length }) + ' · ',
          ativos.length ? tr('bônus: {l}', { l: ativos.map(([t, ate]) => tr('{n} até {h}', { n: nomes[t] || t, h: hhmm(Number(ate)) })).join(', ') }) : tr('nenhum bônus ativo')),
        prox ? h('div', { class: 'st' }, prox.falta
          ? tr('Próximo pacote: {c}, faltam {n} pts', { c: prox.nome, n: fmt(prox.falta) }) + (prox.tocando ? ' (~' + tr('{d} tocando', { d: duracao(prox.falta / 10 * 5 * 60000) }) + ')' : '')
          : tr('Próximo pacote: {c}, saldo já cobre', { c: prox.nome }) + (cfg.resgateAuto && pkk.vinculado ? ' (' + tr('resgatando') + ')' : '')) : null,
        !cfg.resgateAuto ? h('div', { class: 'st' }, tr('Resgate automático desligado nos Ajustes.')) : null,
        tw ? h('div', { class: 'st' }, h('b', { class: 'tw' }, 'Twitch'), ` · ${tw}`) : null);
    }
    function renderCanais() {
      const conf = Date.now() - confirmarLimpar < 4000;
      const ordem = cfg.canais.slice().sort((a, b) => {
        const ta = vagasAtuais.includes(a.slug), tb = vagasAtuais.includes(b.slug);
        if (ta !== tb) return ta ? -1 : 1;
        if (aoVivo(a.slug) !== aoVivo(b.slug)) return aoVivo(a.slug) ? -1 : 1;
        return prioridade(a.slug) - prioridade(b.slug);
      });
      const ultimos = eventos.filter((e) => e.em > Date.now() - 24 * 3600e3).slice(0, 4);
      const secao = (rot, n) => h('div', { class: 'secao' }, h('span', {}, rot, h('span', { class: 'n' }, String(n))));
      const grupos = [[tr('Valendo agora'), ordem.filter((c) => vagasAtuais.includes(c.slug))],
        [tr('Ao vivo, esperando'), ordem.filter((c) => !vagasAtuais.includes(c.slug) && aoVivo(c.slug))],
        [tr('Offline'), ordem.filter((c) => !vagasAtuais.includes(c.slug) && !aoVivo(c.slug))]];
      return [
        h('form', { class: 'add', onsubmit: (e) => { e.preventDefault(); adicionar(els.input.value); els.input.value = ''; } },
          els.input = h('input', { placeholder: tr('canal ou link da Kick'), autocomplete: 'off', spellcheck: 'false', 'aria-label': tr('Adicionar canal') }),
          h('button', { class: 'bt' }, tr('Adicionar'))),
        h('div', { class: 'atalhos' },
          h('button', { class: 'lk', onclick: puxarSeguidos, title: tr('Adiciona os canais que você segue e estão ao vivo') }, ic('mais'), tr('seguidos ao vivo')),
          h('button', { class: 'lk', disabled: !pkk, title: pkk ? tr('Põe na lista os canais oficiais do PokeIdle na Kick (sem tirar os seus)') : tr('A Plateia ainda não leu o jogo: recarregue a aba do PokeIdle (F5)'), onclick: () => { cfg.seguirPokeidle = true; cfg.pkIgnorar = []; salvar(); sincronizarPokeidle(); render(); } }, ic('mais'), tr('canais do PokeIdle'))),
        resumoPokeidle(),
        h('div', { class: 'lista' }, ...(ordem.length
          ? grupos.flatMap(([rot, l]) => (l.length ? [secao(rot, l.length), ...l.map(cardCanal)] : []))
          : [h('p', { class: 'nota', style: 'padding:0 8px' }, tr('Nenhum canal ainda. Digite um canal acima ou use os atalhos.'))])),
        h('div', { class: 'barra-lista' },
          h('button', { class: 'mini', disabled: !pkk, title: tr('Tira tudo e deixa só os canais oficiais do PokeIdle na Kick'), onclick: () => limpar(true) }, tr('Só canais do PokeIdle')),
          h('button', { class: 'mini' + (conf ? ' perigo' : ''), title: tr('Tira todos os canais e desliga "Seguir canais do PokeIdle"'), onclick: () => limpar(false) }, conf ? tr('Clique de novo para limpar') : tr('Limpar lista'))),
        drops.length ? h('div', { class: 'drops' }, h('div', { class: 'tit' }, ic('presente', 15), tr('Drops da Kick')),
          ...drops.slice(0, 6).map((d) => h('div', { class: 'drop' },
            h('div', { class: 'st' }, h('b', {}, d.nome), ` · ${Math.min(d.min, d.req)}/${d.req} min`, d.conectado ? null : ' · ' + tr('conecte a conta do jogo')),
            h('div', { class: 'barra' }, h('i', { style: `width:${d.req ? Math.min(100, Math.round(d.min / d.req * 100)) : 0}%` }))))) : null,
        ultimos.length ? h('div', { class: 'drops' }, h('div', { class: 'tit' }, tr('Pegos hoje')), ...ultimos.map((e) => h('div', { class: 'st' }, (e.ok ? '✓ ' : '✗ ') + e.texto))) : null,
        h('p', { class: 'nota' }, tr('A Kick só paga pontos em 2 lives por vez (medido em 2026-10-23). Lives da Kick abertas em outras abas entram nessa conta.'))
      ];
    }
    function renderAjustes() {
      const linha = (rotulo, ctrl, dica) => h('label', { class: 'aj' }, h('span', {}, rotulo, dica ? h('small', {}, dica) : null), ctrl);
      const chk = (campo) => h('input', { type: 'checkbox', checked: !!cfg[campo], onchange: (e) => { cfg[campo] = e.target.checked; salvar(); sincronizarPokeidle(); aplicarVagas(); render(); } });
      const grupo = (tit, ...itens) => h('div', { class: 'grupo' }, h('div', { class: 'grupo-tit' }, tit), ...itens);
      return [grupo(tr('Lives tocando'),
        linha(tr('Vagas'), h('input', { type: 'number', min: 1, max: MAX_VAGAS, value: cfg.vagas, onchange: (e) => { cfg.vagas = Math.max(1, Math.min(MAX_VAGAS, parseInt(e.target.value, 10) || 2)); salvar(); aplicarVagas(); render(); } }), tr('Quantas lives tocam de verdade. A Kick só paga pontos em 2.')),
        vagasN() > 2 ? h('p', { class: 'aviso' }, tr('Acima de 2, as lives extras não ganham pontos.')) : null,
      ), grupo('PokeIdle',
        linha(tr('Resgate automático do PokeIdle'), chk('resgateAuto'), tr('Espera o saldo do canal cobrir XP + Capture Boost + Secret Lure e compra um de cada. Só com a Kick vinculada no jogo.')),
        linha(tr('Seguir canais do PokeIdle'), chk('seguirPokeidle'), tr('Põe e tira da lista, sozinho, os canais oficiais da Kick que o jogo mostra.')),
      ), grupo(tr('Automático'),
        linha(tr('Daily Reward automática'), chk('diariaAuto'), tr('Pega a recompensa diária da Kick quando completa 1 h assistida no dia.')),
        linha(tr('Drops automáticos'), chk('dropsAuto'), tr('Resgata o Drop da Kick quando chega a 100% (precisa da conta do jogo conectada).')))
      ];
    }
    function render() {
      renderChips();
      renderAbas();
      const kickCanais = cfg.canais.filter((c) => ehPokeidle(c.slug)).map((c) => ({
        slug: c.slug, nome: (info[c.slug] || {}).nome, saldo: (info[c.slug] || {}).saldo,
        custoPacote: pacotes[c.slug] && pacotes[c.slug].itens.length === 3 ? pacotes[c.slug].custo : 0,
        aoVivo: aoVivo(c.slug), tocando: vagasAtuais.includes(c.slug)
      })).sort((a, b) => (b.tocando - a.tocando) || ((a.custoPacote ? (a.custoPacote - (a.saldo || 0)) : 1e9) - (b.custoPacote ? (b.custoPacote - (b.saldo || 0)) : 1e9)));
      const ativo = document.activeElement === host && raiz.activeElement;
      if (ativo && ativo.tagName === 'INPUT' && aba === 'canais') { renderChips(); return; } // não apaga o que está sendo digitado
      repor(els.conteudo, ...(aba === 'canais' ? renderCanais() : aba === 'pokeidle'
        ? [P.painelPokeidle({ pk, pkk, plataforma: 'kick', kickCanais, resgates })]
        : renderAjustes()));
    }

    P.aoMudar((m) => {
      if (m.pokeidleKick) { pkk = m.pokeidleKick.newValue || null; sincronizarPokeidle(); render(); talvezResgatar(); }
      if (m.pokeidle) { pk = m.pokeidle.newValue || null; if (aba === 'pokeidle') render(); }
    });

    function fecharSala() {
      salaAtiva = false;
      for (const fr of iframes.values()) fr.remove();
      iframes.clear();
      [t1, t2, t3, t4].forEach(clearInterval);
      host.remove();
      delete document.documentElement.dataset.plateia;
      if (document.body) document.body.style.overflow = '';
      if (window.opener || window.name === NOME_JANELA) { window.name = ''; window.close(); }
      history.replaceState(null, '', location.pathname);
      botaoAbrir();
    }

    try { const u = await api('/api/v1/user'); eu = (u && u.username) || ''; } catch (e) {}
    sincronizarPokeidle();
    render();
    await atualizar();
    for (const c of cfg.canais) if (ehPokeidle(c.slug)) await lerPacote(c.slug);
    aplicarVagas(); render();
    verDiaria(); verDrops();
    const t1 = setInterval(atualizar, 90000);
    const t2 = setInterval(() => { renderChips(); }, 5000);
    const t3 = setInterval(verDiaria, 5 * 60000);
    const t4 = setInterval(verDrops, 5 * 60000);
  }


})();
