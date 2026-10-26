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
  try { document.getElementById('versao').textContent = 'v' + chrome.runtime.getManifest().version; } catch (e) {}
})();
