// Guia da Plateia: idioma (bandeiras) e versão no rodapé. Script externo: página de extensão não aceita script inline.
(() => {
  // mesmo idioma das salas (storage.local "idioma", regra 13); sem escolha salva, vem do navegador
  const extI = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  const IDIOMAS = ['pt', 'en', 'es'];
  const doNavegador = () => {
    let l = '';
    try { l = (extI.i18n && extI.i18n.getUILanguage && extI.i18n.getUILanguage()) || ''; } catch (e) {}
    l = String(l || (navigator.languages && navigator.languages[0]) || navigator.language || 'en').toLowerCase();
    return l.startsWith('pt') ? 'pt' : l.startsWith('es') ? 'es' : 'en';
  };
  const escolher = (l, gravar) => {
    document.body.className = l;
    document.documentElement.lang = ({ pt: 'pt-BR', en: 'en', es: 'es' })[l];
    document.querySelectorAll('[data-escolher]').forEach((b) => b.classList.toggle('on', b.dataset.escolher === l));
    if (gravar) { try { extI.storage.local.set({ idioma: l }); } catch (e) {} }
  };
  escolher(doNavegador(), false);
  try {
    Promise.resolve(extI.storage.local.get('idioma')).then((r) => { if (r && IDIOMAS.includes(r.idioma)) escolher(r.idioma, false); }, () => {});
  } catch (e) {}
  document.querySelectorAll('[data-escolher]').forEach((b) => b.addEventListener('click', () => escolher(b.dataset.escolher, true)));
  // navegador: detecta o atual e deixa trocar
  const nav = (n) => {
    document.body.dataset.nav = n;
    document.querySelectorAll('[data-nav-bt]').forEach((b) => b.classList.toggle('on', b.dataset.navBt === n));
  };
  const ua = navigator.userAgent || '';
  nav(/Firefox\//.test(ua) ? 'firefox' : /Edg\//.test(ua) ? 'edge' : /OPR\//.test(ua) ? 'opera' : (navigator.brave ? 'brave' : 'chrome'));
  document.querySelectorAll('[data-nav-bt]').forEach((b) => b.addEventListener('click', () => nav(b.dataset.navBt)));
  // permissão de site (Firefox deixa tirar): mostra o aviso e o botão para pedir de novo
  const ext = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  const SITES = { origins: ['https://www.twitch.tv/*', 'https://kick.com/*'] };
  const conferir = async () => {
    let ok = true;
    try { ok = await ext.permissions.contains(SITES); } catch (e) {}
    const caixa = document.getElementById('permissoes');
    if (caixa) caixa.hidden = ok;
    if (!ok && location.hash === '#permissoes' && caixa) caixa.scrollIntoView();
  };
  const bt = document.getElementById('permitir');
  if (bt) bt.addEventListener('click', async () => { try { await ext.permissions.request(SITES); } catch (e) {} conferir(); });
  conferir();
  try { document.getElementById('versao').textContent = 'v' + ((typeof browser !== 'undefined' && browser.runtime) ? browser : chrome).runtime.getManifest().version; } catch (e) {}
})();
