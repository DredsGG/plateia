// Guia da Plateia: idioma (bandeiras) e versão no rodapé. Script externo: página de extensão não aceita script inline.
(() => {
  const escolher = (l) => {
    document.body.className = l;
    document.documentElement.lang = l === 'pt' ? 'pt-BR' : 'en';
    document.querySelectorAll('[data-escolher]').forEach((b) => b.classList.toggle('on', b.dataset.escolher === l));
    try { localStorage.setItem('plateia-guia-lang', l); } catch (e) {}
  };
  let l = 'pt';
  try { l = localStorage.getItem('plateia-guia-lang') || ((navigator.language || 'pt').toLowerCase().startsWith('pt') ? 'pt' : 'en'); } catch (e) {}
  escolher(l);
  document.querySelectorAll('[data-escolher]').forEach((b) => b.addEventListener('click', () => escolher(b.dataset.escolher)));
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
