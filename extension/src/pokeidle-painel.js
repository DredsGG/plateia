// Plateia — aba "PokeIdle" (igual nas salas da Twitch e da Kick)
// Mostra o que o próprio jogo diz: bônus da Twitch (presença no chat) e horas de bônus da Kick (resgates).
(() => {
  const P = window.PLATEIA;
  if (!P || P.painelPokeidle) return;
  const NOMES_TIPO = { xp: 'XP', captura: 'Capture Boost', shiny: 'Secret Lure (shiny)' };
  P.NOMES_TIPO_KICK = NOMES_TIPO;
  P.URL_SALA_TWITCH = 'https://www.twitch.tv/drops/inventory#plateia';
  P.URL_SALA_KICK = 'https://kick.com/drops/claimed#plateia';

  P.pkPct = (v) => {
    v = Number(v) || 0;
    if (!v) return '';
    const p = v <= 1 ? v * 100 : v;
    return '+' + (Math.round(p * 10) / 10).toLocaleString('pt-BR') + '%';
  };

  // opts: { pk, pkk, plataforma: 'twitch'|'kick', kickCanais?: [{slug, nome, saldo, custoPacote, aoVivo, tocando}], resgates?: [] }
  P.painelPokeidle = (opts) => {
    const { h, hhmm, duracao, fmt } = P.ui;
    const { pk, pkk, plataforma } = opts;
    const agora = Date.now();
    const idade = (o) => (o && o.em ? Math.round((agora - o.em) / 60000) : null);
    const blocos = [];

    // ---------- Twitch ----------
    const tw = [];
    if (!pk) {
      tw.push(h('p', { class: 'nota' }, 'Sem dados do jogo ainda. Com o PokeIdle aberto numa aba, recarregue a aba do jogo (F5) uma vez.'));
    } else if (!pk.vinculado) {
      tw.push(h('p', { class: 'aviso' }, 'Twitch não vinculada no PokeIdle. Vincule no jogo (Bônus Twitch).'));
    } else {
      const comBonus = new Set((pk.oficiais || []).filter((o) => o.bonus).map((o) => o.login));
      const vivas = (pk.lives || []).filter((l) => comBonus.has(l.login));
      const ve = new Set(pk.assistindoEm || []);
      tw.push(h('div', { class: 'pk-linha' }, h('b', {}, 'Bônus agora: ' + (P.pkPct(pk.pct) || '0%')),
        ` · te vê em ${vivas.filter((l) => ve.has(l.login)).length}/${vivas.length} lives com bônus`));
      tw.push(h('p', { class: 'nota' }, 'Conta presença no chat: 15% + 2,5% por live extra. A lista do chat chega com atraso de alguns minutos.'));
      for (const l of vivas) {
        tw.push(h('div', { class: 'pk-item' }, h('span', {}, l.nome || l.login),
          ve.has(l.login) ? h('span', { class: 'tag t2' }, 'te vê ✓') : h('span', { class: 'tag' }, 'ainda não viu')));
      }
      if (!vivas.length) tw.push(h('p', { class: 'nota' }, 'Nenhuma live oficial com bônus no ar agora.'));
    }
    blocos.push(h('section', { class: 'pk-sec' },
      h('div', { class: 'pk-tit tw' }, 'Twitch', idade(pk) > 10 ? h('small', {}, ` dados de ${idade(pk)} min atrás`) : null),
      ...tw,
      plataforma === 'kick' ? h('a', { class: 'mini', href: P.URL_SALA_TWITCH, target: 'plateia', rel: 'noopener' }, 'Abrir a sala da Twitch') : null));

    // ---------- Kick ----------
    const kk = [];
    if (!pkk) {
      kk.push(h('p', { class: 'nota' }, 'Sem dados da Kick do jogo ainda. Recarregue a aba do PokeIdle (F5) uma vez com a Plateia atualizada.'));
    } else {
      if (!pkk.vinculado) kk.push(h('p', { class: 'aviso' }, 'Kick não vinculada no PokeIdle. Sem vínculo, os pontos gastos são perdidos: a Plateia NÃO resgata nada até você vincular no jogo (Bônus na Kick).'));
      const ativos = Object.entries(pkk.bonus || {}).filter(([, ate]) => Number(ate) > agora);
      kk.push(h('div', { class: 'pk-linha' }, h('b', {}, ativos.length ? 'Bônus ativos:' : 'Nenhum bônus da Kick ativo agora')));
      for (const [tipo, ate] of ativos) {
        kk.push(h('div', { class: 'pk-item' }, h('span', {}, `+15% ${NOMES_TIPO[tipo] || tipo}`),
          h('span', { class: 'tag t2' }, `até ${hhmm(Number(ate))} · ${duracao(Number(ate) - agora)}`)));
      }
      kk.push(h('p', { class: 'nota' }, 'Na Kick o bônus é comprado: cada resgate de recompensa do PokeIdle num canal oficial vale 1 h de +15%, e as horas somam.'));
      if (plataforma === 'kick' && opts.kickCanais && opts.kickCanais.length) {
        kk.push(h('div', { class: 'pk-linha' }, h('b', {}, 'Pacote por canal (XP + Capture + Lure)')));
        for (const c of opts.kickCanais) {
          const pct = c.custoPacote ? Math.min(100, Math.round((c.saldo || 0) / c.custoPacote * 100)) : 0;
          const falta = c.custoPacote ? Math.max(0, c.custoPacote - (c.saldo || 0)) : 0;
          kk.push(h('div', { class: 'pk-canal' },
            h('div', { class: 'pk-item' }, h('span', {}, c.nome || c.slug, c.tocando ? h('span', { class: 'tag t1' }, '▶') : null),
              h('span', { class: 'st' }, c.custoPacote ? `${fmt(c.saldo)} / ${fmt(c.custoPacote)}` : 'sem recompensas do PokeIdle')),
            c.custoPacote ? h('div', { class: 'barra' }, h('i', { style: `width:${pct}%` })) : null,
            c.custoPacote && falta ? h('small', { class: 'st' }, `faltam ${fmt(falta)} pts${c.tocando ? ` · ~${duracao(falta / 10 * 5 * 60000)} tocando` : ''}`) : null));
        }
      } else {
        const vivos = (pkk.oficiais || []).filter((o) => o.aoVivo && o.ativo);
        kk.push(h('div', { class: 'pk-linha' }, `${vivos.length}/${(pkk.oficiais || []).length} canais oficiais da Kick ao vivo`));
      }
      if (opts.resgates && opts.resgates.length) {
        kk.push(h('div', { class: 'pk-linha' }, h('b', {}, 'Últimos resgates')));
        for (const r of opts.resgates.slice(0, 6)) {
          kk.push(h('div', { class: 'pk-item' }, h('span', {}, `${hhmm(r.em)} · ${r.slug} · ${NOMES_TIPO[r.tipo] || r.titulo || r.tipo}`),
            r.ok ? h('span', { class: 'tag t2' }, `-${fmt(r.custo)}`) : h('span', { class: 'tag', title: r.erro || '' }, 'falhou')));
        }
      }
    }
    blocos.push(h('section', { class: 'pk-sec' },
      h('div', { class: 'pk-tit kk' }, 'Kick', idade(pkk) > 10 ? h('small', {}, ` dados de ${idade(pkk)} min atrás`) : null),
      ...kk,
      plataforma === 'twitch' ? h('a', { class: 'mini', href: P.URL_SALA_KICK, target: 'plateia-kick', rel: 'noopener' }, 'Abrir a sala da Kick') : null));
    return h('div', { class: 'pk-painel' }, ...blocos);
  };

  P.CSS_PAINEL = `
  .abas{display:flex;gap:4px;border-bottom:1px solid #2f2f35}
  .aba{background:none;border:0;border-bottom:2px solid transparent;color:#adadb8;padding:6px 10px;font:700 12.5px Inter,Arial,sans-serif;cursor:pointer}
  .aba.on{color:#fff;border-bottom-color:var(--cor)}
  .pk-painel{display:flex;flex-direction:column;gap:10px}
  .pk-sec{background:#18181b;border:1px solid #26262c;border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:5px}
  .pk-tit{font-weight:800;font-size:13px}
  .pk-tit.tw{color:#bf94ff}.pk-tit.kk{color:#53fc18}
  .pk-tit small{color:#8d8d97;font-weight:400}
  .pk-linha{font-size:12.5px}
  .pk-item{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:12px}
  .pk-canal{display:flex;flex-direction:column;gap:2px;padding:3px 0;border-top:1px solid #222227}
  a.mini{align-self:flex-start;text-decoration:none}
  `;
})();
