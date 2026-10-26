// Plateia — peças de interface usadas pelas salas da Twitch e da Kick
(() => {
  const P = window.PLATEIA;
  if (!P || P.ui) return;
  const h = (tag, attrs, ...filhos) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.style.cssText = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat()) {
      if (f === null || f === undefined || f === false) continue;
      el.appendChild(typeof f === 'string' || typeof f === 'number' ? document.createTextNode(String(f)) : f);
    }
    return el;
  };
  const repor = (el, ...filhos) => el.replaceChildren(...filhos.flat().filter((f) => f !== null && f !== undefined && f !== false));
  const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('pt-BR'));
  const mmss = (ms) => { ms = Math.max(0, ms); const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const hhmm = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const duracao = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`; };
  // logo da Plateia: tela roxa (Twitch) + tela verde (Kick) + plateia
  const logo = (tam = 20) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 128 128'); s.setAttribute('width', tam); s.setAttribute('height', tam);
    s.innerHTML = '<rect x="4" y="4" width="120" height="120" rx="28" fill="#141417" stroke="#34343c" stroke-width="3"/>' +
      '<rect x="15" y="17" width="62" height="45" rx="11" fill="#9146FF"/>' +
      '<rect x="47" y="31" width="66" height="48" rx="11" fill="#53FC18" stroke="#141417" stroke-width="5"/>' +
      '<path d="M73 44 L90 55 L73 66 Z" fill="#141417"/>' +
      '<g fill="#fff"><circle cx="33" cy="93" r="8.5"/><circle cx="95" cy="93" r="8.5"/><circle cx="64" cy="90" r="10.5"/>' +
      '<path d="M17 116c0-8.5 7-14.5 16-14.5s16 6 16 14.5z"/><path d="M79 116c0-8.5 7-14.5 16-14.5s16 6 16 14.5z"/>' +
      '<path d="M44 118c0-11.5 9-18.5 20-18.5s20 7 20 18.5z"/></g>';
    return s;
  };
  const assinatura = () => h('div', { class: 'assina' }, 'feito por ',
    h('a', { href: 'https://github.com/DredsGG', target: '_blank', rel: 'noopener noreferrer', title: 'github.com/DredsGG' }, 'Dreds'),
    P.versao() ? ' · v' + P.versao() : null);
  P.ui = { h, repor, fmt, mmss, hhmm, duracao, logo, assinatura };
})();
