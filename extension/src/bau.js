// Plateia — baú de pontos e Drops (roda em toda aba e em cada live da sala)
(() => {
  const P = window.PLATEIA;
  if (!P || P.bauIniciado) return;
  P.bauIniciado = true;

  let cfg = Object.assign({}, P.CONFIG_PADRAO);
  P.config().then((c) => (cfg = c));
  P.aoMudar((m) => { if (m.config) cfg = Object.assign({}, P.CONFIG_PADRAO, m.config.newValue || {}); });

  const naSala = P.dentroDaSala();

  // ---------- Baú de pontos ----------
  // O botão do baú é o que tem o ícone .claimable-bonus__icon (independe do idioma).
  let ultimoClique = 0;
  async function contarBau(canal) {
    const baus = await P.ler('baus', {});
    baus[canal] = (baus[canal] || 0) + 1;
    await P.gravar('baus', baus);
    await P.gravar('ultimoBau', { canal, em: Date.now() });
  }
  function tentarBau() {
    if (!cfg.bauAuto) return;
    const icone = document.querySelector('.claimable-bonus__icon');
    if (!icone) return;
    const botao = icone.closest('button');
    if (!botao || botao.disabled) return;
    if (Date.now() - ultimoClique < 4000) return;
    ultimoClique = Date.now();
    const canal = P.canalDaPagina();
    setTimeout(() => {
      if (!document.contains(botao)) return;
      botao.click();
      P.log('baú resgatado em', canal);
      contarBau(canal);
    }, 400 + Math.random() * 1600);
  }

  // ---------- Drops na página de inventário ----------
  const RE_RESGATAR = /^(resgatar|claim|canjear|reclamar|récupérer|abholen|riscatta|odbierz)/i;
  let ultimoDrop = 0;
  function tentarDrops() {
    if (!cfg.dropsAuto) return;
    if (!location.pathname.startsWith('/drops/inventory')) return;
    if (Date.now() - ultimoDrop < 5000) return;
    const main = document.querySelector('main') || document.body;
    const botoes = [...main.querySelectorAll('button')].filter((b) => {
      const t = (b.innerText || '').trim();
      return t && RE_RESGATAR.test(t) && !/resgatad|claimed/i.test(t) && !b.disabled;
    });
    if (!botoes.length) return;
    ultimoDrop = Date.now();
    const b = botoes[0];
    setTimeout(async () => {
      if (!document.contains(b)) return;
      b.click();
      const lista = await P.ler('dropsResgatados', []);
      lista.unshift({ em: Date.now(), via: 'inventario' });
      await P.gravar('dropsResgatados', lista.slice(0, 50));
      P.log('drop resgatado pelo inventário');
    }, 600 + Math.random() * 1200);
  }

  // ---------- Só nas lives da sala ----------
  function cuidarDoPlayer() {
    const v = document.querySelector('video');
    // aviso de conteúdo / "começar a assistir"
    const portao = document.querySelector(
      '[data-a-target="content-classification-gate-overlay-start-watching-button"],' +
      '[data-a-target="player-overlay-mature-accept"]'
    );
    if (portao) portao.click();
    if (!v) return;
    if (!v.muted) v.muted = true;
    if (v.paused && !v.ended) v.play().catch(() => {});
  }
  if (naSala) {
    const css = document.createElement('style');
    css.textContent =
      '[data-a-target="top-nav-container"],[data-a-target="side-nav-bar"]{display:none!important}' +
      '.channel-root__info,.channel-info-content{display:none!important}';
    (document.head || document.documentElement).appendChild(css);
    setInterval(cuidarDoPlayer, 15000);
    setTimeout(cuidarDoPlayer, 4000);
  }

  // ---------- Vigia ----------
  let agendado = false;
  const obs = new MutationObserver(() => {
    if (agendado) return;
    agendado = true;
    setTimeout(() => { agendado = false; tentarBau(); tentarDrops(); }, 700);
  });
  obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
  setInterval(() => { tentarBau(); tentarDrops(); }, 10000);
  tentarBau();
})();
