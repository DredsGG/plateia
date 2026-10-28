// Novidades de cada versão, em português: o que muda para quem usa, em frases curtas.
// Atualizar em TODA versão (regra 12). Aparece uma vez por versão, no quadro "Novidades da vX.Y.Z".
(() => {
  const P = window.PLATEIA;
  if (!P) return;
  P.CHANGELOG = P.CHANGELOG || {};
  P.CHANGELOG.pt = {
    '0.9.0': [
      'A Plateia procura versão nova sozinha enquanto a Twitch ou a Kick estão abertas: ao abrir, a cada 30 minutos e quando você volta para a aba.',
      'Quando sai versão nova, o aviso aparece na hora no meio da página, sem precisar recarregar.',
      'O X do aviso só adia: ele volta depois de 1 hora ou quando você abrir o navegador de novo.',
      'Versão urgente (para bug grave): o aviso não tem X e a Plateia pausa o baú, os resgates e as lives até você atualizar.',
      'Se você pulou versões, as novidades mostram o que mudou em cada uma.'
    ],
    '0.8.0': [
      'A Plateia agora fala português, inglês e espanhol. Na primeira vez ela usa o idioma do navegador.',
      'Troque o idioma quando quiser no seletor PT · EN · ES, no rodapé da sala.',
      'Tutorial, novidades e aviso de versão nova aparecem sozinhos na página da Twitch ou da Kick, sem abrir a sala.',
      'O aviso de versão nova mostra o que mudou e tem o botão Atualizar. O X esconde até sair uma versão mais nova.'
    ],
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
