// Plateia — Kick: botão, sala de multi-live, resgate do PokeIdle, Daily Reward e Drops (feito por Dreds)
(() => {
  const P = window.PLATEIA;
  if (!P || !P.ui || P.kickIniciado) return;
  P.kickIniciado = true;
  const { h, repor, fmt, mmss, logo, assinatura, duracao } = P.ui;

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
    if (!tok) throw new Error('sem login');
    const cab = { Accept: 'application/json', Authorization: 'Bearer ' + tok };
    if (url.startsWith('https://web.kick.com') || url.includes('/redeem')) cab['X-Client-Token'] = X_CLIENT_TOKEN;
    const xsrf = P.cookie('XSRF-TOKEN');
    if (xsrf && opts.method && opts.method !== 'GET') cab['X-XSRF-TOKEN'] = xsrf;
    if (opts.body) cab['Content-Type'] = 'application/json';
    const r = await fetch(url.startsWith('http') ? url : 'https://kick.com' + url, {
      method: opts.method || 'GET', credentials: 'include', cache: 'no-store', headers: cab,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let j = null;
    try { j = await r.json(); } catch (e) {}
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
    const bt = h('button', { title: 'Abrir a sala de multi-live da Plateia (Kick)', onclick: abrirSala }, logo(22), 'Plateia');
    raiz.appendChild(bt);
    P.ui.marcarNovidade(bt);
    document.documentElement.appendChild(host);
  }

  let salaAtiva = false;
  function talvez() {
    if (salaAtiva) return;
    if (location.hash === '#plateia' || window.name === NOME_JANELA) iniciarSala();
    else botaoAbrir();
  }
  window.addEventListener('hashchange', talvez);
  talvez();

  // ---------- sala ----------
  async function iniciarSala() {
    salaAtiva = true;
    const ehJanela = !!window.opener || window.name === NOME_JANELA;
    window.name = NOME_JANELA;
    document.documentElement.dataset.plateia = 'sala-kick';
    const lanc = document.getElementById('plateia-lancador');
    if (lanc) lanc.remove();

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
    raiz.appendChild(h('style', {}, CSS + P.CSS_PAINEL + P.ui.CSS_ATUALIZACAO + '.upd + .assina{margin-top:4px}'));
    const els = {};
    raiz.appendChild(h('div', { class: 'app' },
      h('header', {},
        h('div', { class: 'marca' }, logo(24), h('b', {}, 'Plateia'), h('span', { class: 'sub' }, 'sala da Kick')),
        els.chips = h('div', { class: 'chips' }),
        h('div', { class: 'acoes' },
          ehJanela ? null : h('button', { class: 'bt', onclick: abrirSala }, 'Abrir em janela própria'),
          h('button', { class: 'bt sec', onclick: fecharSala }, 'Fechar sala'))),
      h('div', { class: 'corpo' },
        h('aside', {},
          els.abas = h('div', { class: 'abas' }),
          els.conteudo = h('div', { class: 'conteudo' }),
          P.ui.atualizacao({ sala: 'Kick', diagnostico: () => diagnosticoSala() }),
          assinatura()),
        els.palco = h('main', { class: 'palco' },
          els.vazio = h('div', { class: 'vazio' }, 'Adicione canais na lista. As 2 lives que estão valendo aparecem aqui.')))));
    document.documentElement.appendChild(host);
    if (document.body) document.body.style.overflow = 'hidden';
    document.title = 'Plateia · sala da Kick';

    // diagnóstico do "Relatar bug": só números e estados, sem nome de canal, login ou token
    function diagnosticoSala() {
      const dia = Date.now() - 24 * 3600e3;
      const r24 = resgates.filter((r) => r.em > dia);
      return [
        ['Login na Kick', sessao() ? 'sim' : 'não'],
        ['Canais na lista', `${cfg.canais.length} (${cfg.canais.filter((c) => aoVivo(c.slug)).length} ao vivo; fixos ${cfg.canais.filter((c) => modo(c) === 'fixo').length}, fora ${cfg.canais.filter((c) => modo(c) === 'fora').length})`],
        ['Valendo', `${vagasAtuais.length}/${vagasN()}`],
        ['Resgate automático', cfg.resgateAuto ? 'ligado' : 'desligado'],
        ['PokeIdle (Kick)', pkk ? `${pkk.vinculado ? 'vinculado' : 'não vinculado'}${pkk.vinculado && pkk.login && eu ? (pkk.login.toLowerCase() === eu.toLowerCase() ? ' · mesma conta' : ' · OUTRA conta') : ''} · ${(pkk.oficiais || []).length} canais oficiais` : 'sem dados do jogo'],
        ['Pacotes lidos', `${Object.values(pacotes).filter((p) => p.itens.length === 3).length} completos, ${Object.values(pacotes).filter((p) => p.erro).length} com erro`],
        ['Resgates em 24 h', `${r24.filter((r) => r.ok).length} ok, ${r24.filter((r) => !r.ok).length} falharam${r24.find((r) => !r.ok) ? ' (último: ' + r24.find((r) => !r.ok).erro + ')' : ''}`],
        ['Daily Reward', diaria ? (diaria.pega ? 'pega' : `${diaria.prog}/${diaria.meta} min`) : 'sem dados'],
        ['Drops em andamento', String(drops.length)],
        ['Erro da Kick', erro || 'nenhum'],
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
      } catch (e) { erro = 'seguidos: ' + e.message; render(); }
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
                await registrarEvento({ tipo: 'diaria', ok: true, texto: `${c.name || 'Recompensa'} pega${raridade ? ' (' + raridade + ')' : ''}` });
              } catch (e) { await registrarEvento({ tipo: 'diaria', ok: false, texto: `${c.name || 'Recompensa'}: ${e.message}` }); }
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
      els.vazio.textContent = iframes.size && !visiveis ? 'As lives valendo estão tocando escondidas. Clique no olho de um canal para ver.' : 'Adicione canais na lista. As 2 lives que estão valendo aparecem aqui.';
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
        chip(`${vivos}/${total} ao vivo`, '', 'Canais da lista ao vivo agora / total'),
        chip(`valendo ${vagasAtuais.length}/${vagasN()}`, vagasN() > 2 ? 'alerta' : 'ok', 'Lives tocando de verdade. A Kick só paga pontos em 2 por vez (medido)'),
        chip(`+${fmt(ganho)} pts`, 'ok', 'Pontos ganhos desde que a sala abriu'),
        pkk ? chip(ativos.length ? `PokeIdle: ${ativos.length} bônus · ${duracao(maior)}` : 'PokeIdle: sem bônus ativo', ativos.length ? 'ok' : '', 'Bônus da Kick no PokeIdle (horas compradas com pontos)') : null,
        pacotesHoje ? chip(`${pacotesHoje} pacote${pacotesHoje > 1 ? 's' : ''} em 24 h`, 'ok', 'Pacotes XP + Capture + Lure comprados nas últimas 24 h') : null,
        diaria ? chip(diaria.pega ? 'diária pega ✓' : `diária ${Math.min(diaria.prog, diaria.meta)}/${diaria.meta} min`, diaria.pega ? 'ok' : '', 'Daily Reward da Kick: 1 h assistida no dia') : null,
        erro ? chip('Kick: ' + erro, 'alerta', 'Erro ao falar com a Kick; tenta de novo sozinha') : null,
        !sessao() ? chip('Entre na sua conta da Kick', 'alerta') : null);
    }
    function renderAbas() {
      repor(els.abas,
        h('button', { class: 'aba' + (aba === 'canais' ? ' on' : ''), onclick: () => { aba = 'canais'; render(); } }, 'Canais'),
        h('button', { class: 'aba' + (aba === 'pokeidle' ? ' on' : ''), onclick: () => { aba = 'pokeidle'; render(); } }, 'PokeIdle'),
        h('button', { class: 'aba' + (aba === 'ajustes' ? ' on' : ''), onclick: () => { aba = 'ajustes'; render(); } }, 'Ajustes'));
    }
    function cardCanal(c) {
      const i = info[c.slug] || {};
      const tocando = vagasAtuais.includes(c.slug);
      const pac = pacotes[c.slug];
      const ganho = typeof i.saldo === 'number' && typeof i.saldoInicial === 'number' ? i.saldo - i.saldoInicial : 0;
      const status = i.inexistente ? 'canal não existe' : i.aoVivo === undefined ? 'carregando…' : i.aoVivo ? `ao vivo${i.jogo ? ' · ' + i.jogo : ''} · ${fmt(i.espectadores)}` : 'offline';
      return h('div', { class: 'card' + (tocando ? ' tocando' : '') + (i.aoVivo ? ' vivo' : '') },
        i.img ? h('img', { src: i.img, alt: '' }) : h('div', { class: 'ph' }),
        h('div', { class: 'meio' },
          h('div', { class: 'nome' }, i.nome || c.slug,
            tocando ? h('span', { class: 'tag t1' }, '▶ valendo') : i.aoVivo && modo(c) !== 'fora' ? h('span', { class: 'tag' }, 'na fila') : null,
            ehPokeidle(c.slug) ? h('span', { class: 'tag t3', title: 'Canal oficial do PokeIdle na Kick (lido do jogo)' }, 'PokeIdle') : null),
          h('div', { class: 'st' }, status),
          h('div', { class: 'st' }, typeof i.saldo === 'number' ? `${fmt(i.saldo)} pts` : '— pts',
            ganho > 0 ? h('b', { class: 'ganho' }, ` +${fmt(ganho)}`) : null,
            pac && pac.custo ? ` · pacote ${fmt(pac.custo)}` : null)),
        h('div', { class: 'lado' },
          h('div', { class: 'bts' },
            i.aoVivo && !tocando && modo(c) !== 'fora' ? h('button', { class: 'ic agora', title: 'Ver agora: fixa esta live numa vaga (volte para Fila quando quiser)', onclick: () => verAgora(c.slug) }, '▶') : null,
            h('button', { class: 'ic' + (c.mostrar ? ' on' : ''), title: c.mostrar ? 'Vídeo aparece na sala (clique para esconder; continua contando)' : 'Vídeo toca escondido (clique para mostrar)', onclick: () => definir(c.slug, 'mostrar') }, c.mostrar ? '👁' : '◌'),
            h('button', { class: 'ic x', title: 'Tirar da lista', onclick: () => remover(c.slug) }, '×')),
          h('div', { class: 'modos' },
            ...[['fixo', 'Fixo', 'Sempre tem vaga quando está ao vivo'], ['fila', 'Fila', 'Entra numa vaga quando sobrar (PokeIdle: primeiro o que está mais perto de fechar o pacote)'], ['fora', 'Fora', 'Nunca toca: só acompanha o saldo']]
              .map(([m, rot, dica]) => h('button', { class: 'modo' + (modo(c) === m ? ' on' : ''), title: dica, onclick: () => definir(c.slug, 'modo', m) }, rot)))));
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
      return [
        h('form', { class: 'add', onsubmit: (e) => { e.preventDefault(); adicionar(els.input.value); els.input.value = ''; } },
          els.input = h('input', { placeholder: 'canal ou link da Kick', autocomplete: 'off', spellcheck: 'false' }),
          h('button', { class: 'bt' }, 'Adicionar')),
        h('div', { class: 'atalhos' },
          h('button', { class: 'lk', onclick: puxarSeguidos, title: 'Adiciona os canais que você segue e estão ao vivo' }, '+ seguidos ao vivo'),
          h('button', { class: 'lk', disabled: !pkk, title: pkk ? 'Põe na lista os canais oficiais do PokeIdle na Kick (sem tirar os seus)' : 'A Plateia ainda não leu o jogo: recarregue a aba do PokeIdle (F5)', onclick: () => { cfg.seguirPokeidle = true; cfg.pkIgnorar = []; salvar(); sincronizarPokeidle(); render(); } }, '+ canais do PokeIdle')),
        h('div', { class: 'barra-lista' },
          h('button', { class: 'mini' + (conf ? ' perigo' : ''), title: 'Tira todos os canais e desliga "Seguir canais do PokeIdle"', onclick: () => limpar(false) }, conf ? 'Clique de novo para limpar' : 'Limpar lista'),
          h('button', { class: 'mini', disabled: !pkk, onclick: () => limpar(true) }, 'Só canais do PokeIdle')),
        h('div', { class: 'lista' }, ...(ordem.length ? ordem.map(cardCanal) : [h('p', { class: 'nota' }, 'Nenhum canal ainda.')])),
        drops.length ? h('div', { class: 'drops' }, h('div', { class: 'tit' }, 'Drops da Kick'),
          ...drops.slice(0, 6).map((d) => h('div', { class: 'drop' },
            h('div', { class: 'st' }, h('b', {}, d.nome), ` · ${Math.min(d.min, d.req)}/${d.req} min`, d.conectado ? null : ' · conecte a conta do jogo'),
            h('div', { class: 'barra' }, h('i', { style: `width:${d.req ? Math.min(100, Math.round(d.min / d.req * 100)) : 0}%` }))))) : null,
        ultimos.length ? h('div', { class: 'drops' }, h('div', { class: 'tit' }, 'Pegos hoje'), ...ultimos.map((e) => h('div', { class: 'st' }, (e.ok ? '✓ ' : '✗ ') + e.texto))) : null,
        h('p', { class: 'nota' }, 'A Kick só paga pontos em 2 lives por vez (medido em 2026-10-23). Lives da Kick abertas em outras abas entram nessa conta.')
      ];
    }
    function renderAjustes() {
      const linha = (rotulo, ctrl, dica) => h('label', { class: 'aj' }, h('span', {}, rotulo, dica ? h('small', {}, dica) : null), ctrl);
      const chk = (campo) => h('input', { type: 'checkbox', checked: !!cfg[campo], onchange: (e) => { cfg[campo] = e.target.checked; salvar(); sincronizarPokeidle(); aplicarVagas(); render(); } });
      return [
        linha('Vagas (lives tocando)', h('input', { type: 'number', min: 1, max: MAX_VAGAS, value: cfg.vagas, onchange: (e) => { cfg.vagas = Math.max(1, Math.min(MAX_VAGAS, parseInt(e.target.value, 10) || 2)); salvar(); aplicarVagas(); render(); } }), 'Quantas lives tocam de verdade. A Kick só paga pontos em 2.'),
        vagasN() > 2 ? h('p', { class: 'aviso' }, 'Acima de 2, as lives extras não ganham pontos.') : null,
        linha('Resgate automático do PokeIdle', chk('resgateAuto'), 'Espera o saldo do canal cobrir XP + Capture Boost + Secret Lure e compra um de cada. Só com a Kick vinculada no jogo.'),
        linha('Seguir canais do PokeIdle', chk('seguirPokeidle'), 'Põe e tira da lista, sozinho, os canais oficiais da Kick que o jogo mostra.'),
        linha('Daily Reward automática', chk('diariaAuto'), 'Pega a recompensa diária da Kick quando completa 1 h assistida no dia.'),
        linha('Drops automáticos', chk('dropsAuto'), 'Resgata o Drop da Kick quando chega a 100% (precisa da conta do jogo conectada).')
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

  const CSS = `
  :host{all:initial}
  *{box-sizing:border-box}
  .app{--cor:#53fc18;position:fixed;inset:0;display:flex;flex-direction:column;background:#0b0b0c;color:#efeff1;font:13px/1.4 Inter,"Helvetica Neue",Arial,sans-serif}
  header{display:flex;align-items:center;gap:14px;padding:8px 14px;background:#141417;border-bottom:1px solid #26262c}
  .marca{display:flex;align-items:center;gap:8px;white-space:nowrap}
  .marca b{font-size:16px;color:#fff}
  .marca .sub{color:#53fc18;font-weight:600}
  .chips{display:flex;flex-wrap:wrap;gap:6px;flex:1}
  .chip{background:#1f1f23;border:1px solid #303036;border-radius:999px;padding:3px 9px;color:#dedee3;white-space:nowrap}
  .chip.ok{border-color:#53fc1855;color:#a6ff7f}
  .chip.alerta{border-color:#eb040055;color:#ff8280}
  .acoes{display:flex;gap:8px}
  .bt{background:#53fc18;color:#0b0b0c;border:0;border-radius:6px;padding:7px 11px;font:700 12px Inter,Arial,sans-serif;cursor:pointer}
  .bt:hover{filter:brightness(1.08)}
  .bt.sec{background:#303036;color:#fff}
  .corpo{flex:1;display:flex;min-height:0}
  aside{width:370px;flex:none;display:flex;flex-direction:column;gap:10px;padding:12px;border-right:1px solid #26262c;overflow:auto;background:#101012}
  .conteudo{display:flex;flex-direction:column;gap:10px}
  .add{display:flex;gap:6px}
  .add input{flex:1;background:#141417;border:1px solid #3a3a42;border-radius:6px;color:#fff;padding:7px 9px;font:13px Inter,Arial,sans-serif;outline:none}
  .add input:focus{border-color:#53fc18}
  .atalhos{display:flex;gap:12px}
  .lk{background:none;border:0;color:#53fc18;cursor:pointer;padding:0;font:700 12px Inter,Arial,sans-serif}
  .lk:hover{text-decoration:underline}
  .lk:disabled{opacity:.45;cursor:default;text-decoration:none}
  .barra-lista{display:flex;gap:6px}
  .mini{background:#1f1f23;color:#dedee3;border:1px solid #303036;border-radius:6px;padding:4px 8px;font:600 11.5px Inter,Arial,sans-serif;cursor:pointer}
  .mini:hover{border-color:#53fc18}
  .mini:disabled{opacity:.45;cursor:default}
  .mini.perigo{background:#eb040033;border-color:#eb0400;color:#ff8280}
  .lista{display:flex;flex-direction:column;gap:6px}
  .card{display:flex;gap:9px;align-items:center;background:#141417;border:1px solid #222227;border-radius:8px;padding:7px;opacity:.7}
  .card.vivo{opacity:1}
  .card.tocando{border-color:#53fc18;box-shadow:inset 3px 0 0 #53fc18}
  .card img,.card .ph{width:38px;height:38px;border-radius:50%;flex:none;background:#222227;object-fit:cover}
  .card.vivo img{outline:2px solid #53fc18;outline-offset:1px}
  .meio{flex:1;min-width:0}
  .nome{font-weight:700;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
  .st{color:#a8a8b3;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ganho{color:#a6ff7f}
  .tag{font-size:10.5px;font-weight:700;border-radius:4px;padding:1px 5px;background:#303036;color:#dedee3}
  .tag.t1{background:#53fc18;color:#0b0b0c}
  .tag.t2{background:#53fc1833;color:#a6ff7f}
  .tag.t3{background:#ffb31a33;color:#ffd37a}
  .lado{display:flex;flex-direction:column;align-items:flex-end;gap:4px}
  .bts{display:flex;gap:3px}
  .bts .ic{width:28px;height:28px;border-radius:6px;border:1px solid #303036;background:#1a1a1e;color:#a8a8b3;cursor:pointer;font-size:14px;line-height:1}
  .bts .ic.on{color:#fff;border-color:#53fc18;background:#53fc1822}
  .bts .ic.agora{color:#0b0b0c;background:#53fc18;border-color:#53fc18}
  .bts .ic.x:hover{color:#ff8280;border-color:#eb0400}
  .modos{display:flex;border:1px solid #303036;border-radius:6px;overflow:hidden}
  .modo{background:#1a1a1e;color:#a8a8b3;border:0;border-left:1px solid #303036;padding:3px 6px;font:600 10.5px Inter,Arial,sans-serif;cursor:pointer}
  .modo:first-child{border-left:0}
  .modo.on{background:#53fc18;color:#0b0b0c}
  .drops{background:#141417;border:1px solid #222227;border-radius:8px;padding:8px}
  .tit{font-weight:700;margin-bottom:4px}
  .drop{margin-top:6px}
  .barra{height:5px;background:#222227;border-radius:3px;overflow:hidden;margin-top:3px}
  .barra i{display:block;height:100%;background:#53fc18}
  .aj{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #222227}
  .aj span{flex:1}
  .aj small{display:block;color:#8d8d97;font-size:11px;margin-top:1px;line-height:1.3}
  .aj input[type=number]{width:62px;background:#141417;border:1px solid #3a3a42;border-radius:5px;color:#fff;padding:4px}
  .aj input[type=checkbox]{accent-color:#53fc18;width:16px;height:16px}
  .aviso{color:#ff8280;font-size:12px;margin:2px 0}
  .nota{color:#a8a8b3;font-size:12px;margin:0}
  .assina{color:#a8a8b3;font-size:11px;margin-top:auto;align-self:flex-end}
  .assina a{color:#53fc18;font-weight:700;text-decoration:none}
  .assina a:hover{text-decoration:underline}
  .palco{flex:1;display:grid;gap:4px;padding:4px;min-width:0;background:#000;position:relative;grid-auto-rows:1fr}
  .palco iframe{width:100%;height:100%;border:0;background:#000;border-radius:4px;min-height:0}
  iframe.oculto{position:fixed!important;left:0;bottom:0;width:2px!important;height:2px!important;opacity:0;pointer-events:none;border:0}
  .vazio{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#a8a8b3;text-align:center;padding:40px}
  `;
})();
