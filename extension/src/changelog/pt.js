// Novidades de cada versão, em português: o que muda para quem usa, em frases curtas.
// Atualizar em TODA versão (regra 12). Aparece uma vez por versão, no quadro "Novidades da vX.Y.Z".
(() => {
  const P = window.PLATEIA;
  if (!P) return;
  P.CHANGELOG = P.CHANGELOG || {};
  P.CHANGELOG.pt = {
    '0.7.0': [
      'Visual novo nas duas salas, no estilo da Twitch e da Kick.',
      'A lista de canais agora é separada em "Valendo agora", "Ao vivo, esperando" e "Offline", com o tempo do rodízio no título.',
      'A sala da Twitch ganhou a aba Ajustes, com chaves de ligar e desligar.',
      'Na Kick, um resumo do PokeIdle mostra os bônus ativos e quanto falta para o próximo pacote, e avisa se a Kick não está vinculada no jogo.',
      'A Plateia agora funciona no Chrome, Edge, Brave, Opera GX e Firefox.',
      'Tutorial de primeiro uso: reabra quando quiser no "? Como usar", no topo da sala.'
    ]
  };
})();
