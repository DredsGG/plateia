// Plateia — ponte com o PokeIdle (roda no mundo da página do pokeidle.io, só LÊ)
// Escuta as mensagens do jogo e repassa só os blocos "twitch" e "kick" do estado:
// canais oficiais, quais estão com bônus, quais o jogo já te vê assistindo e o % do bônus.
// Nada é enviado ao jogo.
(() => {
  if (window.__plateiaPonte) return;
  window.__plateiaPonte = true;
  const Nativo = window.WebSocket;
  if (!Nativo) return;
  function ouvir(ws) {
    ws.addEventListener('message', (ev) => {
      const d = ev.data;
      if (typeof d !== 'string' || (d.indexOf('"twitch"') < 0 && d.indexOf('"kick"') < 0)) return;
      try {
        const m = JSON.parse(d);
        if ((m.t === 'welcome' || m.t === 'estado') && m.estado) {
          if ('twitch' in m.estado) window.postMessage({ plateia: 'pokeidle-twitch', tw: m.estado.twitch }, location.origin);
          if ('kick' in m.estado) window.postMessage({ plateia: 'pokeidle-kick', kk: m.estado.kick }, location.origin);
        }
      } catch (e) { /* mensagem que não é JSON */ }
    });
  }
  window.WebSocket = new Proxy(Nativo, {
    construct(alvo, args, novoAlvo) {
      const ws = Reflect.construct(alvo, args, novoAlvo);
      try { ouvir(ws); } catch (e) {}
      return ws;
    }
  });
})();
