// Plateia — lives da sala continuam contando com a janela minimizada (mundo da página, antes do site carregar).
// Medido em 2026-10-28 (Chrome do André): com a aba escondida (janela minimizada, coberta ou em segundo plano),
// o player segue tocando, mas o Chrome segura os relógios da página e o aviso de "estou assistindo" da Kick
// (channel_handshake do socket de espectador), que sai a cada 15 s, passa a sair só 1 vez por minuto.
// Aqui, SÓ dentro das lives da sala da Plateia (iframes):
//  1. setTimeout/setInterval de 1 s ou mais passam a ser marcados por um Worker (relógio de Worker não é
//     segurado com a aba escondida); o callback roda na página, no tempo certo, como se ela estivesse aberta;
//  2. a página se vê sempre "visível" (document.hidden = false, visibilityState = "visible", sem
//     visibilitychange), para o site não reduzir nada por estar escondido;
//  3. o vídeo "já teve som" por um instante inaudível, para o Chrome não pausar a live muda escondida.
// A aba normal da Twitch/Kick que a pessoa abre não é tocada.
(() => {
  let naSala = false;
  try {
    naSala = window.top !== window && /^sala/.test(window.top.document.documentElement.dataset.plateia || '');
  } catch (e) { naSala = false; }
  // para medir numa aba comum: kick.com/<canal>#plateia-visivel ou twitch.tv/<canal>#plateia-visivel
  if (!naSala && /plateia-visivel/.test(location.hash)) naSala = true;
  if (!naSala || window.__plateiaVisivel) return;
  window.__plateiaVisivel = true;

  // ---------- 1. relógios marcados por um Worker ----------
  const MIN_MS = 1000; // relógios curtos ficam com o navegador (com a aba escondida eles rodam 1x/s, o que basta)
  try {
    const codigo = 'const t=new Map();onmessage=(e)=>{const d=e.data;' +
      'if(d.c==="set"){const f=()=>postMessage(d.id);t.set(d.id,d.r?setInterval(f,d.ms):setTimeout(()=>{t.delete(d.id);f();},d.ms));}' +
      'else if(d.c==="clr"){const h=t.get(d.id);if(h!==undefined){clearTimeout(h);clearInterval(h);t.delete(d.id);}}};';
    const worker = new Worker(URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' })));
    const nativo = { st: window.setTimeout, si: window.setInterval, ct: window.clearTimeout, ci: window.clearInterval };
    const pendentes = new Map(); // id -> { fn, args, repetir }
    let proximo = 2e9; // ids altos, para não colidir com os do navegador
    worker.onmessage = (e) => {
      const p = pendentes.get(e.data);
      if (!p) return;
      if (!p.repetir) pendentes.delete(e.data);
      try { if (typeof p.fn === 'function') p.fn.apply(window, p.args); } catch (err) { nativo.st.call(window, () => { throw err; }, 0); }
    };
    const agendar = (repetir) => function (fn, ms, ...args) {
      const atraso = Number(ms) || 0;
      // texto em vez de função (raro) e relógios curtos: com o navegador
      if (atraso < MIN_MS || typeof fn !== 'function') return (repetir ? nativo.si : nativo.st).call(window, fn, ms, ...args);
      const id = ++proximo;
      pendentes.set(id, { fn, args, repetir });
      worker.postMessage({ c: 'set', id, ms: atraso, r: repetir });
      return id;
    };
    const limpar = (nat) => function (id) {
      if (pendentes.has(id)) { pendentes.delete(id); worker.postMessage({ c: 'clr', id }); return undefined; }
      return nat.call(window, id);
    };
    window.setTimeout = agendar(false);
    window.setInterval = agendar(true);
    window.clearTimeout = limpar(nativo.ct);
    window.clearInterval = limpar(nativo.ci);
    window.__plateiaRelogio = 'worker'; // usado pelos testes
  } catch (e) { window.__plateiaRelogio = 'nativo'; /* sem Worker (política do site): fica com os relógios do navegador */ }

  // ---------- 3. o vídeo já "teve som" ----------
  // Causa medida em 2026-10-28: o Chrome PAUSA sozinho, quando a página fica escondida, todo vídeo que
  // nunca tocou com som (WebMediaPlayerImpl::ShouldPausePlaybackWhenHidden: sem "HasUnmutedAudio" ele pausa;
  // HTMLMediaElement::was_always_muted_). As lives da sala sempre tocam mudas, então o player da Twitch
  // via a pausa, ia para "Idle" e zerava a live (t=0, sem src) — e a live deixava de contar.
  // Aqui, assim que a live está tocando, ela é desmutada por um instante com volume 0,0001 (inaudível) e
  // volta a ficar muda na mesma hora. Para o Chrome ela "já teve som" e não é mais pausada escondida.
  // Os eventos dessa troca não chegam ao site (o player não salva volume nem acha que alguém mexeu).
  // Se o navegador não deixar tocar com som (política de autoplay), a live volta a tocar muda e tenta de novo depois.
  try {
    const proto = HTMLMediaElement.prototype;
    const dMudo = Object.getOwnPropertyDescriptor(proto, 'muted');
    const dVol = Object.getOwnPropertyDescriptor(proto, 'volume');
    const jaTeveSom = new WeakSet();
    const ultimaTentativa = new WeakMap();
    const silenciarAte = new WeakMap(); // vídeo -> até quando os eventos da troca não chegam ao site
    const engolir = (e) => {
      const ate = silenciarAte.get(e.target);
      if (ate && performance.now() < ate) e.stopImmediatePropagation();
    };
    for (const ev of ['volumechange', 'pause', 'play', 'playing']) window.addEventListener(ev, engolir, true);
    const darSom = (v) => {
      if (jaTeveSom.has(v) || v.paused || v.ended || v.readyState < 2) return;
      const agora = performance.now();
      if (agora - (ultimaTentativa.get(v) || -1e9) < 30000) return;
      ultimaTentativa.set(v, agora);
      const mudo = dMudo.get.call(v), vol = dVol.get.call(v);
      silenciarAte.set(v, agora + 1500);
      let negado = false;
      try {
        dVol.set.call(v, 0.0001);
        dMudo.set.call(v, false);   // aqui o Chrome marca que o vídeo já teve som (ou pausa, se a política negar)
        negado = v.paused;
      } finally {
        dMudo.set.call(v, mudo);
        dVol.set.call(v, vol);
      }
      const estado = negado ? 'negado' : 'ok';
      if (negado) v.play().catch(() => {}); else jaTeveSom.add(v);
      document.documentElement.dataset.plateiaSom = estado;
      try { if (window.top !== window) window.top.postMessage({ plateiaSom: estado }, '*'); } catch (e) {} // a sala avisa "clique na sala"
    };
    const varrer = () => { for (const v of document.getElementsByTagName('video')) { try { darSom(v); } catch (e) {} } };
    document.addEventListener('playing', (e) => { if (e.target && e.target.tagName === 'VIDEO') setTimeout(varrer, 0); }, true);
    // a sala repassa o clique da pessoa: com o clique o navegador passa a deixar, então tenta de novo na hora
    window.addEventListener('message', (e) => {
      if (e.source !== window.top || !e.data || !e.data.plateiaTentarSom) return;
      for (const v of document.getElementsByTagName('video')) ultimaTentativa.delete(v);
      setTimeout(varrer, 0);
    });
    setInterval(varrer, 5000);
  } catch (e) {}

  // ---------- 2. página sempre "visível" ----------
  const fixo = (nome, valor) => {
    try { Object.defineProperty(Document.prototype, nome, { configurable: true, get: () => valor }); } catch (e) {}
  };
  fixo('hidden', false);
  fixo('webkitHidden', false);
  fixo('visibilityState', 'visible');
  fixo('webkitVisibilityState', 'visible');
  try { Document.prototype.hasFocus = () => true; } catch (e) {}
  const barrar = (e) => { if (e.target === document || e.target === window) e.stopImmediatePropagation(); };
  for (const ev of ['visibilitychange', 'webkitvisibilitychange', 'blur', 'freeze']) {
    window.addEventListener(ev, barrar, true);
    document.addEventListener(ev, barrar, true);
  }
  try { document.documentElement.dataset.plateiaVisivel = '1'; } catch (e) {} // usado pelos testes
})();
