// Plateia — resgate automático do bônus do PokeIdle na Twitch (v0.9.4, feito por Dreds)
//
// Desde 2026-11-04 o bônus do jogo na Twitch é comprado com os pontos do canal (como na Kick). Aqui a Plateia
// compra a recompensa de 10 h de cada bônus (XP, depois Capture Boost, depois Secret Lure), CLICANDO na interface
// da própria página, dentro da live da sala (iframe que vale). Não chama a API de resgate: a mutação fora da página
// pede token de integridade e os hashes mudam; o clique na página não.
//
// Fluxo medido em 2026-11-09 (faturetosl, iframe de 2x2 px escondido): botão "Saldos de Pontos e Bits" abre o painel
// (.reward-center__content); cada recompensa é um botão com custo em .reward-icon__cost e nome no alt da imagem;
// clicar nela abre o DETALHE com o botão "Resgatar <custo>"; o 2º clique compra.
//
// Este arquivo também traz as contas puras (restante de cada bônus, próxima compra) que a aba PokeIdle usa.
(() => {
  const P = window.PLATEIA;
  if (!P || P.twitchResgate) return;
  const tr = (txt, vars) => P.t(txt, vars);

  // A compra: sempre a versão de 10 h (a mais cara e a que dura mais). Ordem de prioridade: XP, Capture, Lure.
  const TIPOS = [
    { tipo: 'xp', nome: 'Bônus +15% XP PokeIdle (10h)', custo: 3000, rotulo: 'XP' },
    { tipo: 'captura', nome: 'Bônus de +15% Capture Boost (10h)', custo: 5000, rotulo: 'Capture Boost' },
    { tipo: 'shiny', nome: 'Bônus de +15% Secret Lure (10h)', custo: 10000, rotulo: 'Secret Lure' }
  ];
  const HORAS_POR_COMPRA = 10;
  const HORA_MS = 3600e3;
  const CUSTO_MAX = 10000;          // trava: nenhuma compra acima disso
  const ESPERA_ERRO_MS = 15 * 60000; // qualquer erro para tudo por 15 min
  const DADOS_MAX_MS = 30 * 60000;  // dados do jogo mais velhos que isso: não compra
  const TOLERANCIA_SALDO = 200;     // pontos que podem ter entrado (baú, minuto) entre o saldo lido e a conferência
  const TRAVA_MS = 90000;           // trava entre salas abertas ao mesmo tempo (duas janelas não compram junto)

  // Tempos (os testes encurtam)
  const TEMPOS = {
    entreCompras: () => 3000 + Math.random() * 2000, // 3 a 5 s entre uma compra e outra
    achar: 8000,       // esperar o painel de pontos / o painel abrir / o detalhe aparecer
    confirmar: 12000,  // esperar o efeito da compra (saldo caiu / linha no chat)
    confirmarPasso: 2000,
    poll: 150,
    folga: 8000,       // live recém-aberta: dá tempo de a página montar o widget de pontos
    jitterTrava: () => 150 + Math.random() * 250 // salas que acordam juntas: espera um pouco e confere quem ficou com a trava
  };

  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  async function esperarAte(fn, ms) {
    const fim = Date.now() + ms;
    for (;;) {
      let v = null;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      if (Date.now() >= fim) return null;
      await esperar(TEMPOS.poll);
    }
  }
  // "3.000" (pt), "3,000" (en), "3 000": só os dígitos. "7,6 mil" ou "10K" não vira número: NaN.
  const numero = (txt) => {
    const s = String(txt || '').trim();
    if (!s || /[a-z]/i.test(s)) return NaN;
    const d = s.replace(/\D/g, '');
    return d ? Number(d) : NaN;
  };
  const RE_RESGATAR = /^\s*(resgatar|redeem|canjear|reclamar|racheter|échanger|einlösen|riscatta|odbierz|claim)/i;
  const RE_VOLTAR = /^(voltar|back|volver|retour|zurück)/i;
  const RE_FECHAR = /^(fechar|close|cerrar|fermer|schließen)/i;

  class ErroResgate extends Error { constructor(msg, leve) { super(msg); this.leve = !!leve; } }

  // ---------- contas puras (a aba PokeIdle usa) ----------
  // Fim estimado de um bônus pelas nossas compras (relógio corrido: 10 h por compra, as horas somam).
  function fimEstimado(tipo, regs) {
    const compras = (regs || []).filter((r) => r && r.tipo === tipo && (r.ok || r.incerta)).map((r) => Number(r.em) || 0).sort((a, b) => a - b);
    let fim = 0;
    for (const em of compras) fim = Math.max(fim, em) + HORAS_POR_COMPRA * HORA_MS;
    return fim;
  }
  // Fim que o próprio jogo informa (pk.bonus[tipo], em ms), ou null se o jogo não manda esse campo.
  function fimDoJogo(pk, tipo) {
    if (!pk || !pk.bonus || typeof pk.bonus !== 'object') return null;
    return Number(pk.bonus[tipo]) || 0;
  }
  // Fim valendo = o maior entre o do jogo e o das nossas compras (o jogo demora a creditar: sem isso, compraria em dobro).
  function fim(tipo, pk, regs) {
    const j = fimDoJogo(pk, tipo), e = fimEstimado(tipo, regs);
    return { ate: Math.max(j || 0, e), fonte: j !== null && j >= e ? 'jogo' : 'estimado' };
  }
  function bonusAtivos(pk, regs, agora = Date.now()) {
    return TIPOS.map((t) => Object.assign({ tipo: t.tipo, rotulo: t.rotulo }, fim(t.tipo, pk, regs))).filter((b) => b.ate > agora);
  }
  // Próxima compra: o primeiro bônus (na ordem de prioridade) com menos de 1 h restante e o canal onde o saldo chega
  // mais perto. canais: [{login, nome, saldo, tocando}]. Devolve também, para cada canal, quanto falta.
  function resumo({ pk, regs, canais, agora = Date.now() }) {
    const ativos = bonusAtivos(pk, regs, agora);
    const precisa = TIPOS.find((t) => fim(t.tipo, pk, regs).ate - agora < HORA_MS) || null;
    let prox = null;
    if (precisa) {
      const lista = (canais || []).map((c) => ({ login: c.login, nome: c.nome || c.login, saldo: typeof c.saldo === 'number' ? c.saldo : null, tocando: !!c.tocando }))
        .filter((c) => c.saldo !== null).sort((a, b) => b.saldo - a.saldo);
      const melhor = lista[0] || null;
      prox = { tipo: precisa.tipo, rotulo: precisa.rotulo, nome: precisa.nome, custo: precisa.custo,
        canal: melhor, falta: melhor ? Math.max(0, precisa.custo - melhor.saldo) : precisa.custo,
        canais: lista.map((c) => Object.assign({}, c, { falta: Math.max(0, precisa.custo - c.saldo) })) };
    }
    const proximoEm = !precisa ? Math.min(...TIPOS.map((t) => fim(t.tipo, pk, regs).ate)) - HORA_MS : 0;
    return { ativos, prox, proximoEm };
  }

  // ---------- o robô ----------
  function criar(dep) {
    let registros = (dep.registros || []).slice(0, 50);
    let resgatando = false;
    let bloqueadoAte = 0, ultimoErro = '', ultimoAviso = '';
    let pausado = false;
    const idSala = 'sala-' + Math.random().toString(36).slice(2);
    const avisar = () => { try { dep.aoMudar && dep.aoMudar(); } catch (e) {} };

    // por que NÃO comprar agora (vazio = pode)
    function impedimento() {
      const cfg = dep.cfg() || {};
      const pk = dep.pk();
      if (cfg.resgateAuto === false) return tr('desligado nos Ajustes');
      if (pausado) return tr('pausado por você');
      if (P.pausado()) return tr('atualização urgente pendente');
      if (Date.now() < bloqueadoAte) return tr('parado após um erro');
      if (!pk || !pk.vinculado) return tr('Twitch não vinculada no jogo');
      const eu = String(dep.eu() || '').toLowerCase();
      if (!eu || !pk.login || String(pk.login).toLowerCase() !== eu) return tr('conta do jogo diferente da conta da Twitch aberta');
      if (!pk.em || Date.now() - pk.em > DADOS_MAX_MS) return tr('dados do jogo antigos (abra o jogo)');
      return '';
    }

    // próximo item a comprar: prioridade XP, Capture, Lure; só se restar menos de 1 h (não empilha);
    // canal = o de MENOR saldo que cobre o custo (guarda os saldos grandes para os itens caros)
    function proxima() {
      const pk = dep.pk();
      const agora = Date.now();
      const cands = dep.canais() || [];
      for (const t of TIPOS) {
        if (t.custo > CUSTO_MAX) continue;
        if (fim(t.tipo, pk, registros).ate - agora >= HORA_MS) continue;
        const aptos = cands.filter((c) => c.frame && typeof c.saldo === 'number' && c.saldo >= t.custo).sort((a, b) => a.saldo - b.saldo);
        if (aptos.length) return { t, canal: aptos[0] };
      }
      return null;
    }

    async function registrar(reg) {
      // cada compra tem um id: o storage devolve CÓPIAS (onChanged troca a lista), então não dá para achar o registro por referência
      reg.id = reg.id || `${reg.em}-${reg.tipo}-${reg.canal}`;
      const i = registros.findIndex((r) => r && r.id === reg.id);
      if (i >= 0) registros[i] = reg; else registros.unshift(reg);
      registros = registros.slice(0, 50);
      await P.gravar('twitchResgates', registros);
      avisar();
    }

    // ----- clique na página (dentro do iframe da live) -----
    const painelDe = (doc) => doc.querySelector('.reward-center__content');
    const nomeDe = (b) => String(b.getAttribute('aria-label') || (b.querySelector('img') || {}).alt || '').trim();
    const botaoSaldo = (doc) => {
      const resumoPts = doc.querySelector('[data-test-selector="community-points-summary"]');
      return resumoPts ? [...resumoPts.querySelectorAll('button')].find((b) => !b.querySelector('.claimable-bonus__icon')) : null;
    };
    async function abrirPainel(doc) {
      if (painelDe(doc)) return;
      const bt = await esperarAte(() => botaoSaldo(doc), TEMPOS.achar);
      if (!bt) throw new ErroResgate(tr('o painel de pontos ainda não apareceu na live'), true);
      bt.click();
      const p = await esperarAte(() => { const x = painelDe(doc); return x && x.querySelector('.reward-icon__cost') ? x : null; }, TEMPOS.achar);
      if (!p) throw new ErroResgate(tr('o painel de pontos não abriu'));
    }
    async function fecharPainel(doc) {
      try {
        for (let i = 0; i < 4 && painelDe(doc); i++) {
          const bts = [...painelDe(doc).querySelectorAll('button')];
          const alvo = bts.find((b) => RE_VOLTAR.test(b.getAttribute('aria-label') || '')) || bts.find((b) => RE_FECHAR.test(b.getAttribute('aria-label') || ''));
          if (!alvo) break;
          alvo.click();
          await esperar(Math.min(400, TEMPOS.poll * 3));
        }
        if (painelDe(doc)) { const bt = botaoSaldo(doc); if (bt) bt.click(); } // o botão do saldo também abre e fecha
      } catch (e) { /* aba sumiu */ }
    }
    function acharRecompensa(doc, t) {
      const botoes = [...painelDe(doc).querySelectorAll('button')].filter((b) => b.querySelector('.reward-icon__cost'));
      const iguais = botoes.filter((b) => nomeDe(b) === t.nome);
      if (!iguais.length) throw new ErroResgate(tr('recompensa "{n}" não encontrada no painel', { n: t.nome }));
      if (iguais.length > 1) throw new ErroResgate(tr('mais de uma recompensa chamada "{n}"', { n: t.nome }));
      const custo = numero(iguais[0].querySelector('.reward-icon__cost').textContent);
      if (custo !== t.custo) throw new ErroResgate(tr('custo diferente em "{n}": {c} em vez de {e}', { n: t.nome, c: Number.isNaN(custo) ? '?' : custo, e: t.custo }));
      return iguais[0];
    }
    async function acharResgatar(doc, t) {
      const b = await esperarAte(() => {
        const p = painelDe(doc);
        if (!p) return null;
        return [...p.querySelectorAll('button')].find((x) => RE_RESGATAR.test(x.textContent || '')) || null;
      }, TEMPOS.achar);
      if (!b) throw new ErroResgate(tr('o botão Resgatar não apareceu'));
      if (b.disabled || b.getAttribute('aria-disabled') === 'true') throw new ErroResgate(tr('o botão Resgatar está desabilitado'));
      const p = painelDe(doc);
      if (!(p.textContent || '').includes(t.nome)) throw new ErroResgate(tr('a tela de detalhe não é de "{n}"', { n: t.nome }));
      const custo = numero(String(b.textContent).replace(RE_RESGATAR, ''));
      if (custo !== t.custo) throw new ErroResgate(tr('o botão Resgatar mostra {c}, esperado {e}', { c: Number.isNaN(custo) ? '?' : custo, e: t.custo }));
      return b;
    }
    // efeito da compra: o saldo do canal caiu o custo (conferido pela consulta de leitura) ou a linha
    // "<login> resgatou <nome>" apareceu no chat da live
    const esc = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    function contarLinhas(doc, t) {
      const eu = String(dep.eu() || '').toLowerCase();
      if (!eu) return 0;
      const txt = String((doc.querySelector('.chat-scrollable-area__message-container') || doc.body || {}).textContent || '').toLowerCase();
      return (txt.match(new RegExp(esc(eu) + '\\s*resgatou\\s*' + esc(t.nome.toLowerCase()), 'g')) || []).length;
    }
    async function confirmar(doc, canal, t, antes, linhasAntes) {
      const limite = Date.now() + TEMPOS.confirmar;
      let depois = null;
      for (;;) {
        const s = await dep.lerSaldo(canal.login);
        if (typeof s === 'number') depois = s;
        if (typeof s === 'number' && s <= antes - t.custo + TOLERANCIA_SALDO) return { via: 'saldo', depois };
        if (contarLinhas(doc, t) > linhasAntes) return { via: 'linha', depois };
        if (Date.now() >= limite) return { via: '', depois };
        await esperar(TEMPOS.confirmarPasso);
      }
    }

    async function comprar({ t, canal }) {
      const reg = { em: Date.now(), canal: canal.login, tipo: t.tipo, nome: t.nome, custo: t.custo, ok: false, saldoAntes: canal.saldo };
      let doc = null;
      try {
        let fr = canal.frame;
        try { doc = fr.contentDocument; } catch (e) { doc = null; }
        if (!doc || !doc.body) throw new ErroResgate(tr('não consegui acessar a live da sala'), true);
        // a moldura tem que estar mesmo no canal esperado (a live pode ter ido para outra página)
        if (String(P.twitchResgate.canalDoFrame(fr) || '').toLowerCase() !== canal.login) throw new ErroResgate(tr('a live da sala não está mais em {c}', { c: canal.login }), true);
        const antes = await dep.lerSaldo(canal.login);
        if (typeof antes !== 'number') throw new ErroResgate(tr('não consegui ler o saldo de {c}', { c: canal.login }), true);
        if (antes < t.custo) return { ok: false, leve: true, saldoMudou: true };
        reg.saldoAntes = antes;
        await abrirPainel(doc);
        const botao = acharRecompensa(doc, t);
        if (impedimento()) { await fecharPainel(doc); return { ok: false, leve: true }; }
        botao.click(); // 1º clique: só abre o detalhe
        const resgatar = await acharResgatar(doc, t);
        if (impedimento()) { await fecharPainel(doc); return { ok: false, leve: true }; }
        const linhasAntes = contarLinhas(doc, t);
        reg.incerta = true; // assume comprada até confirmar (nunca comprar em dobro): grava ANTES do clique, para valer mesmo se a aba cair
        await registrar(reg);
        resgatar.click(); // 2º clique: compra (sem outra confirmação)
        const c = await confirmar(doc, canal, t, antes, linhasAntes);
        reg.saldoDepois = c.depois;
        if (!c.via) throw new ErroResgate(tr('o saldo não caiu depois do clique (compra não confirmada)'));
        reg.ok = true; reg.incerta = false; reg.via = c.via;
        await fecharPainel(doc);
        await registrar(reg);
        return { ok: true };
      } catch (e) {
        if (doc) await fecharPainel(doc);
        if (e instanceof ErroResgate && e.leve) { ultimoAviso = e.message; avisar(); return { ok: false, leve: true, aviso: e.message }; }
        reg.erro = String((e && e.message) || e);
        ultimoErro = reg.erro;
        bloqueadoAte = Date.now() + ESPERA_ERRO_MS; // qualquer erro para tudo por 15 min (também no storage: reabrir a sala não zera)
        await P.gravar('twitchResgateBloqueio', { ate: bloqueadoAte, erro: reg.erro });
        await registrar(reg);
        return { ok: false, erro: reg.erro };
      }
    }

    // trava entre salas abertas ao mesmo tempo (duas janelas): grava, espera um instante e confere quem ficou com ela
    async function pegarTrava() {
      try {
        const t = await P.ler('twitchResgateTrava', null);
        if (t && t.id !== idSala && t.ate > Date.now()) return false;
        await P.gravar('twitchResgateTrava', { id: idSala, ate: Date.now() + TRAVA_MS });
        await esperar(TEMPOS.jitterTrava());
        const conf = await P.ler('twitchResgateTrava', null);
        return !!conf && conf.id === idSala;
      } catch (e) { return false; }
    }
    const renovarTrava = () => P.gravar('twitchResgateTrava', { id: idSala, ate: Date.now() + TRAVA_MS });
    async function soltarTrava() { // só solta a trava que é minha (quem perdeu não apaga a de quem está comprando)
      const t = await P.ler('twitchResgateTrava', null);
      if (t && t.id === idSala) await P.gravar('twitchResgateTrava', { id: idSala, ate: 0 });
    }
    // o bloqueio de 15 min também vale entre salas e depois de reabrir a sala
    async function sincronizarBloqueio() {
      const b = await P.ler('twitchResgateBloqueio', null);
      if (b && Number(b.ate) > bloqueadoAte) { bloqueadoAte = Number(b.ate); ultimoErro = b.erro || ultimoErro; }
    }

    // um ciclo: compra o que estiver devendo, um item por vez (no máximo um de cada bônus)
    async function tentar() {
      if (resgatando) return { pulou: 'ocupado' };
      resgatando = true; // trava ligada já na entrada: duas chamadas ao mesmo tempo = uma compra só
      let compras = 0, pegou = false;
      try {
        await sincronizarBloqueio();
        if (impedimento()) return { pulou: impedimento() };
        pegou = await pegarTrava();
        if (!pegou) return { pulou: 'outra sala' };
        for (let i = 0; i < TIPOS.length; i++) {
          if (impedimento()) break;
          const alvo = proxima();
          if (!alvo) break;
          ultimoAviso = '';
          await renovarTrava();
          const r = await comprar(alvo);
          if (!r.ok) break; // erro: para (e já está bloqueado); leve: tenta no próximo ciclo
          compras++;
          if (impedimento()) break;
          await esperar(TEMPOS.entreCompras()); // 3 a 5 s entre compras
        }
        return { compras };
      } finally {
        resgatando = false;
        if (pegou) { try { await soltarTrava(); } catch (e) {} }
        avisar();
      }
    }

    return {
      tentar,
      pausar: (v) => { pausado = v === undefined ? !pausado : !!v; avisar(); return pausado; },
      estado: () => ({ resgatando, pausado, bloqueadoAte: Date.now() < bloqueadoAte ? bloqueadoAte : 0, erro: Date.now() < bloqueadoAte ? ultimoErro : '', aviso: ultimoAviso, impedimento: impedimento() }),
      registros: () => registros,
      definirRegistros: (r) => { registros = (r || []).slice(0, 50); },
      proxima
    };
  }

  // em que canal a moldura da live está agora (pelo endereço da página dela)
  const canalDoFrame = (fr) => { try { return fr.contentWindow.location.pathname.split('/').filter(Boolean)[0] || ''; } catch (e) { return ''; } };

  P.twitchResgate = { TIPOS, TEMPOS, CUSTO_MAX, ESPERA_ERRO_MS, HORA_MS, criar, fim, fimEstimado, fimDoJogo, bonusAtivos, resumo, numero, canalDoFrame };
})();
