// Plateia — recebe da ponte o bloco "twitch" do PokeIdle e guarda para a sala da Twitch usar
(() => {
  const P = window.PLATEIA;
  if (!P || P.guardaPokeidle) return;
  P.guardaPokeidle = true;
  let ultimo = '', ultimaGravacao = 0;
  // Desde 2026-11-04 o jogo vende o bônus da Twitch por resgate (como a Kick): o bloco traz `bonus` {xp, captura, shiny}
  // com o FIM de cada bônus em ms, `minutos` por resgate, `recompensas` e, em cada canal oficial, `ativo` (o streamer
  // autorizou e as 3 recompensas existem) e `aoVivo`. O formato antigo (`bonus` booleano por canal, `lives`,
  // `assistindoEm`, `pctAtual`) continua aceito.
  const lista = (arr) => (Array.isArray(arr) ? arr : []).slice(0, 200)
    .map((x) => {
      const o = { login: String((x && x.login) || '').toLowerCase(), nome: String((x && (x.nome || x.login)) || ''),
        bonus: !!(x && (x.ativo !== undefined ? x.ativo : x.bonus)) }; // `ativo` (formato novo) manda; `bonus` é o formato antigo
      if (x && x.ativo !== undefined) o.ativo = !!x.ativo;
      if (x && x.aoVivo !== undefined) o.aoVivo = !!x.aoVivo;
      return o;
    })
    .filter((x) => P.loginValido(x.login));
  const mapaBonus = (b) => (b && typeof b === 'object' && !Array.isArray(b)
    ? Object.fromEntries(Object.entries(b).slice(0, 10).map(([k, v]) => [String(k), Number(v) || 0])) : undefined);
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.plateia !== 'pokeidle-twitch') return;
    const tw = e.data.tw;
    const obj = tw ? {
      vinculado: tw.vinculado !== undefined ? !!tw.vinculado : !!tw.login,
      login: String(tw.login || '').toLowerCase(),
      assistindo: !!tw.assistindo,
      pct: Number(tw.pct !== undefined ? tw.pct : tw.pctAtual) || 0,
      lives: lista(tw.lives),
      oficiais: lista(tw.oficiais),
      assistindoEm: (Array.isArray(tw.assistindoEm) ? tw.assistindoEm : []).map((s) => String(s).toLowerCase()).filter(P.loginValido)
    } : { vinculado: false, login: '', assistindo: false, pct: 0, lives: [], oficiais: [], assistindoEm: [] };
    if (tw) {
      const bonus = mapaBonus(tw.bonus);
      if (bonus) obj.bonus = bonus; // sem o campo = o jogo não informou o fim (a sala estima pelas compras)
      if (tw.minutos !== undefined) obj.minutos = Number(tw.minutos) || 0;
      if (Array.isArray(tw.recompensas)) obj.recompensas = tw.recompensas.slice(0, 10).map((r) => ({ tipo: String((r && r.tipo) || ''), custo: Number(r && r.custo) || 0 }));
    }
    const chave = JSON.stringify(obj);
    if (chave === ultimo && Date.now() - ultimaGravacao < 60000) return;
    ultimo = chave; ultimaGravacao = Date.now();
    obj.em = Date.now();
    P.gravar('pokeidle', obj);
  });

  // bloco "kick" do PokeIdle: canais oficiais da Kick, recompensas e horas de bônus
  let ultimoKick = '', gravKick = 0;
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.plateia !== 'pokeidle-kick') return;
    const kk = e.data.kk || {};
    const obj = {
      vinculado: !!kk.vinculado,
      login: String(kk.login || '').toLowerCase(),
      pct: Number(kk.pct) || 0,
      minutos: Number(kk.minutos) || 0,
      bonus: kk.bonus && typeof kk.bonus === 'object' ? Object.fromEntries(Object.entries(kk.bonus).slice(0, 10).map(([k, v]) => [String(k), Number(v) || 0])) : {},
      oficiais: (Array.isArray(kk.oficiais) ? kk.oficiais : []).slice(0, 100)
        .map((o) => ({ slug: String((o && o.slug) || '').toLowerCase(), nome: String((o && (o.nome || o.slug)) || ''), aoVivo: !!(o && o.aoVivo), ativo: !!(o && o.ativo) }))
        .filter((o) => /^[a-z0-9_-]{2,40}$/.test(o.slug)),
      recompensas: (Array.isArray(kk.recompensas) ? kk.recompensas : []).slice(0, 10).map((r) => ({ tipo: String((r && r.tipo) || ''), custo: Number(r && r.custo) || 0 }))
    };
    const chave = JSON.stringify(obj);
    if (chave === ultimoKick && Date.now() - gravKick < 60000) return;
    ultimoKick = chave; gravKick = Date.now();
    obj.em = Date.now();
    P.gravar('pokeidleKick', obj);
  });
})();
