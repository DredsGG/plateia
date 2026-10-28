// Novidades de cada versão, em espanhol: o que muda para quem usa, em frases curtas.
// Atualizar em TODA versão (regra 12), junto com pt.js e en.js.
(() => {
  const P = window.PLATEIA;
  if (!P) return;
  P.CHANGELOG = P.CHANGELOG || {};
  P.CHANGELOG.es = {
    '0.9.1': [
      'Kick: el canje automático del paquete de PokeIdle (XP + Capture + Lure) vuelve a funcionar. Kick rechazaba el pedido de Plateia.',
      'Si un canje falla, el resumen de la pestaña Canales muestra el error y la hora del próximo intento.'
    ],
    '0.9.0': [
      'Plateia busca versiones nuevas sola mientras Twitch o Kick están abiertos: al abrir, cada 30 minutos y cuando vuelves a la pestaña.',
      'Cuando sale una versión nueva, el aviso aparece al instante en el medio de la página, sin recargar.',
      'La X del aviso solo lo pospone: vuelve después de 1 hora o cuando abras el navegador de nuevo.',
      'Versión urgente (para un bug grave): el aviso no tiene X y Plateia pausa los cofres, los reclamos y los directos hasta que actualices.',
      'Si saltaste versiones, las novedades muestran lo que cambió en cada una.'
    ],
    '0.8.0': [
      'Plateia ahora habla portugués, inglés y español. La primera vez usa el idioma del navegador.',
      'Cambia el idioma cuando quieras con el selector PT · EN · ES, en el pie de la sala.',
      'El tutorial, las novedades y el aviso de versión nueva aparecen solos en la página de Twitch o Kick, sin abrir la sala.',
      'El aviso de versión nueva muestra qué cambió y tiene el botón Actualizar. La X lo oculta hasta que salga una versión más nueva.'
    ],
    '0.7.0': [
      'Nuevo aspecto en las dos salas, al estilo de Twitch y Kick.',
      'La lista de canales ahora se divide en "Sumando ahora", "En vivo, esperando" y "Offline", con el tiempo de la rotación en el título.',
      'La sala de Twitch tiene la pestaña Ajustes, con interruptores para activar y desactivar.',
      'En Kick, un resumen de PokeIdle muestra los bonus activos y cuánto falta para el próximo paquete, y avisa si Kick no está vinculada en el juego.',
      'Plateia ahora funciona en Chrome, Edge, Brave, Opera GX y Firefox.',
      'Tutorial de primer uso: ábrelo de nuevo cuando quieras en "? Cómo usar", arriba de la sala.'
    ]
  };
})();
