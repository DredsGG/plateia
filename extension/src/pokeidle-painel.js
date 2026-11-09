// Plateia — aba "PokeIdle" (igual nas salas da Twitch e da Kick)
// Mostra o bônus do PokeIdle nas duas plataformas, que desde 04/11/2026 é comprado com pontos do canal: horas ativas, próxima compra e últimos resgates.
(() => {
  const P = window.PLATEIA;
  if (!P || P.painelPokeidle) return;
  const tr = (txt, vars) => P.t(txt, vars);
  const NOMES_TIPO = { xp: 'XP', captura: 'Capture Boost', shiny: 'Secret Lure (shiny)' };
  P.NOMES_TIPO_KICK = NOMES_TIPO;
  P.URL_SALA_TWITCH = 'https://www.twitch.tv/drops/inventory#plateia';
  P.URL_SALA_KICK = 'https://kick.com/drops/claimed#plateia';

  P.pkPct = (v) => {
    v = Number(v) || 0;
    if (!v) return '';
    const p = v <= 1 ? v * 100 : v;
    return '+' + (Math.round(p * 10) / 10).toLocaleString(P.local ? P.local() : 'pt-BR') + '%';
  };

  // opts: { pk, pkk, plataforma: 'twitch'|'kick', kickCanais?: [{slug, nome, saldo, custoPacote, aoVivo, tocando}], resgates?: [] }
  P.painelPokeidle = (opts) => {
    const { h, hhmm, duracao, fmt } = P.ui;
    const { pk, pkk, plataforma } = opts;
    const agora = Date.now();
    const idade = (o) => (o && o.em ? Math.round((agora - o.em) / 60000) : null);
    const blocos = [];

    // ---------- Twitch ----------
    // Desde 04/11/2026 o bônus da Twitch é comprado com pontos do canal (como na Kick): aqui vão os bônus ativos com a
    // hora de fim, a próxima compra, o saldo por canal, os últimos resgates e o erro, se houver.
    const tw = [];
    const R = P.twitchResgate;
    const regsTw = (opts.twitch && opts.twitch.regs) || [];
    if (!pk) {
      tw.push(h('p', { class: 'nota' }, tr('Sem dados do jogo ainda. Com o PokeIdle aberto numa aba, recarregue a aba do jogo (F5) uma vez.')));
    } else if (!pk.vinculado) {
      tw.push(h('p', { class: 'aviso' }, tr('Twitch não vinculada no PokeIdle. Vincule no jogo (Bônus Twitch).')));
    } else {
      const t = opts.twitch;
      const ativos = R ? (t ? t.ativos : R.bonusAtivos(pk, [])) : [];
      tw.push(h('div', { class: 'pk-linha' }, h('b', {}, ativos.length ? tr('Bônus ativos:') : tr('Nenhum bônus da Twitch ativo agora'))));
      for (const b of ativos) {
        tw.push(h('div', { class: 'pk-item' }, h('span', {}, `+15% ${b.rotulo}`),
          h('span', { class: 'tag t2', title: b.fonte === 'jogo' ? tr('Fim informado pelo jogo') : tr('Fim estimado pelas compras da Plateia (relógio corrido, 10 h por compra)') },
            tr('até {h}', { h: hhmm(b.ate) }) + ' · ' + duracao(b.ate - agora) + (b.fonte === 'jogo' ? '' : ' ~'))));
      }
      tw.push(h('p', { class: 'nota' }, tr('Na Twitch o bônus é comprado: cada resgate de recompensa do PokeIdle num canal oficial soma horas de +15%. Só rende com o vídeo rodando na página do canal (as 2 vagas da sala).')));
      if (t && plataforma === 'twitch') {
        tw.push(h('div', { class: 'pk-linha' }, h('b', {}, tr('Resgate automático')), ' · ' + (!t.ligado ? tr('desligado nos Ajustes') : t.pausado ? tr('pausado por você') : t.bloqueadoAte ? tr('parado até {h}', { h: hhmm(t.bloqueadoAte) }) : tr('ligado'))));
        if (t.erro) tw.push(h('p', { class: 'aviso' }, tr('Resgate parado: {e}', { e: t.erro }) + ' ' + tr('Tenta de novo às {h}.', { h: hhmm(t.bloqueadoAte) })));
        else if (t.ligado && t.impedimento && !t.pausado) tw.push(h('p', { class: 'nota' }, tr('Não comprando agora: {m}.', { m: t.impedimento })));
        if (t.aviso && !t.erro) tw.push(h('p', { class: 'nota' }, t.aviso));
        if (t.ligado) tw.push(h('button', { class: 'mini', onclick: t.onPausar, title: tr('Pausa o resgate automático até você retomar ou fechar a sala') }, t.pausado ? tr('Retomar') : tr('Pausar')));
        if (t.prox) {
          const pr = t.prox;
          tw.push(h('div', { class: 'pk-linha' }, h('b', {}, tr('Próxima compra')), ' · ' + `${pr.rotulo} (10h) ${fmt(pr.custo)}`));
          if (!pr.canais.length) tw.push(h('p', { class: 'nota' }, tr('Nenhum canal oficial da lista com saldo lido ainda.')));
          for (const c of pr.canais.slice(0, 8)) {
            const pct = pr.custo ? Math.min(100, Math.round(c.saldo / pr.custo * 100)) : 0;
            tw.push(h('div', { class: 'pk-canal' },
              h('div', { class: 'pk-item' }, h('span', { class: 'pk-nome' }, c.nome, c.tocando ? h('span', { class: 'tag t1', title: tr('Tocando agora na sala') }, P.ui.icone('play', 9), tr('tocando')) : null),
                h('span', { class: 'st' }, `${fmt(c.saldo)} / ${fmt(pr.custo)}`)),
              h('div', { class: 'barra' }, h('i', { style: `width:${pct}%` })),
              c.falta ? h('small', { class: 'st' }, tr('faltam {n} pts', { n: fmt(c.falta) }) + (c.tocando ? ' · ~' + tr('{d} tocando', { d: duracao(c.falta / 10 * 5 * 60000) }) : '')) : h('small', { class: 'st' }, tr('saldo já cobre'))));
          }
        } else if (ativos.length === 3) {
          tw.push(h('p', { class: 'nota' }, tr('Os três bônus têm mais de 1 h: a Plateia só compra de novo quando faltar menos de 1 h (não empilha).')));
        }
        if (regsTw.length) {
          tw.push(h('div', { class: 'pk-linha' }, h('b', {}, tr('Últimos resgates'))));
          for (const r of regsTw.slice(0, 6)) {
            tw.push(h('div', { class: 'pk-item' }, h('span', {}, `${hhmm(r.em)} · ${r.canal} · ${R && R.TIPOS.find((x) => x.tipo === r.tipo) ? R.TIPOS.find((x) => x.tipo === r.tipo).rotulo + ' 10h' : r.nome}`),
              r.ok ? h('span', { class: 'tag t2' }, `-${fmt(r.custo)}`) : h('span', { class: 'tag', title: r.erro || '' }, r.incerta ? tr('não confirmado') : tr('falhou'))));
          }
        }
      }
    }
    blocos.push(h('section', { class: 'pk-sec' },
      h('div', { class: 'pk-tit tw' }, 'Twitch', idade(pk) > 10 ? h('small', {}, ' ' + tr('dados de {m} min atrás', { m: idade(pk) })) : null),
      ...tw,
      plataforma === 'kick' ? h('a', { class: 'mini', href: P.URL_SALA_TWITCH, target: 'plateia', rel: 'noopener' }, tr('Abrir a sala da Twitch')) : null));

    // ---------- Kick ----------
    const kk = [];
    if (!pkk) {
      kk.push(h('p', { class: 'nota' }, tr('Sem dados da Kick do jogo ainda. Recarregue a aba do PokeIdle (F5) uma vez com a Plateia atualizada.')));
    } else {
      if (!pkk.vinculado) kk.push(h('p', { class: 'aviso' }, tr('Kick não vinculada no PokeIdle. Sem vínculo, os pontos gastos são perdidos: a Plateia NÃO resgata nada até você vincular no jogo (Bônus na Kick).')));
      const ativos = Object.entries(pkk.bonus || {}).filter(([, ate]) => Number(ate) > agora);
      kk.push(h('div', { class: 'pk-linha' }, h('b', {}, ativos.length ? tr('Bônus ativos:') : tr('Nenhum bônus da Kick ativo agora'))));
      for (const [tipo, ate] of ativos) {
        kk.push(h('div', { class: 'pk-item' }, h('span', {}, `+15% ${NOMES_TIPO[tipo] || tipo}`),
          h('span', { class: 'tag t2' }, tr('até {h}', { h: hhmm(Number(ate)) }) + ' · ' + duracao(Number(ate) - agora))));
      }
      kk.push(h('p', { class: 'nota' }, tr('Na Kick o bônus é comprado: cada resgate de recompensa do PokeIdle num canal oficial vale 1 h de +15%, e as horas somam.')));
      if (plataforma === 'kick' && opts.kickCanais && opts.kickCanais.length) {
        kk.push(h('div', { class: 'pk-linha' }, h('b', {}, tr('Pacote por canal (XP + Capture + Lure)'))));
        for (const c of opts.kickCanais) {
          const pct = c.custoPacote ? Math.min(100, Math.round((c.saldo || 0) / c.custoPacote * 100)) : 0;
          const falta = c.custoPacote ? Math.max(0, c.custoPacote - (c.saldo || 0)) : 0;
          kk.push(h('div', { class: 'pk-canal' },
            h('div', { class: 'pk-item' }, h('span', { class: 'pk-nome' }, c.nome || c.slug, c.tocando ? h('span', { class: 'tag t1', title: tr('Tocando agora na sala') }, P.ui.icone('play', 9), tr('tocando')) : null),
              h('span', { class: 'st' }, c.custoPacote ? `${fmt(c.saldo)} / ${fmt(c.custoPacote)}` : tr('sem recompensas do PokeIdle'))),
            c.custoPacote ? h('div', { class: 'barra' }, h('i', { style: `width:${pct}%` })) : null,
            c.custoPacote && falta ? h('small', { class: 'st' }, tr('faltam {n} pts', { n: fmt(falta) }) + (c.tocando ? ' · ~' + tr('{d} tocando', { d: duracao(falta / 10 * 5 * 60000) }) : '')) : null));
        }
      } else {
        const vivos = (pkk.oficiais || []).filter((o) => o.aoVivo && o.ativo);
        kk.push(h('div', { class: 'pk-linha' }, tr('{v}/{n} canais oficiais da Kick ao vivo', { v: vivos.length, n: (pkk.oficiais || []).length })));
      }
      if (opts.resgates && opts.resgates.length) {
        kk.push(h('div', { class: 'pk-linha' }, h('b', {}, tr('Últimos resgates'))));
        for (const r of opts.resgates.slice(0, 6)) {
          kk.push(h('div', { class: 'pk-item' }, h('span', {}, `${hhmm(r.em)} · ${r.slug} · ${NOMES_TIPO[r.tipo] || r.titulo || r.tipo}`),
            r.ok ? h('span', { class: 'tag t2' }, `-${fmt(r.custo)}`) : h('span', { class: 'tag', title: r.erro || '' }, tr('falhou'))));
        }
      }
    }
    blocos.push(h('section', { class: 'pk-sec' },
      h('div', { class: 'pk-tit kk' }, 'Kick', idade(pkk) > 10 ? h('small', {}, ' ' + tr('dados de {m} min atrás', { m: idade(pkk) })) : null),
      ...kk,
      plataforma === 'twitch' ? h('a', { class: 'mini', href: P.URL_SALA_KICK, target: 'plateia-kick', rel: 'noopener' }, tr('Abrir a sala da Kick')) : null));
    return h('div', { class: 'pk-painel' }, ...blocos);
  };

  P.CSS_PAINEL = `
  .pk-painel{display:flex;flex-direction:column;gap:12px}
  .pk-sec{background:var(--elev);border-radius:var(--r-card);padding:12px;display:flex;flex-direction:column;gap:7px}
  .pk-tit{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px}
  .pk-tit::before{content:"";width:8px;height:8px;border-radius:50%}
  .pk-tit.tw::before{background:#9147ff}.pk-tit.kk::before{background:#53fc18}
  .pk-tit small{color:var(--apagado);font-weight:500;font-size:12px}
  .pk-linha{font-size:13px}
  .pk-linha b{font-weight:700}
  .pk-item{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12.5px;min-height:22px}
  .pk-nome{display:inline-flex;align-items:center;gap:6px}
  .pk-canal{display:flex;flex-direction:column;gap:3px;padding:8px 0 2px;border-top:1px solid var(--linha)}
  a.mini{align-self:flex-start;display:inline-flex;align-items:center;text-decoration:none;color:var(--link)}
  `;

})();
