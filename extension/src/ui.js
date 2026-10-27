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
  // desenha SVG a partir de texto fixo sem innerHTML (o validador do Firefox reclama de innerHTML)
  const svgDe = (alvo, conteudo) => {
    const doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + conteudo + '</svg>', 'image/svg+xml');
    for (const n of [...doc.documentElement.childNodes]) alvo.appendChild(document.importNode(n, true));
    return alvo;
  };
  // logo da Plateia: tela roxa (Twitch) + tela verde (Kick) + plateia
  const logo = (tam = 20) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 128 128'); s.setAttribute('width', tam); s.setAttribute('height', tam);
    svgDe(s, '<rect x="4" y="4" width="120" height="120" rx="28" fill="#141417" stroke="#34343c" stroke-width="3"/>' +
      '<rect x="15" y="17" width="62" height="45" rx="11" fill="#9146FF"/>' +
      '<rect x="47" y="31" width="66" height="48" rx="11" fill="#53FC18" stroke="#141417" stroke-width="5"/>' +
      '<path d="M73 44 L90 55 L73 66 Z" fill="#141417"/>' +
      '<g fill="#fff"><circle cx="33" cy="93" r="8.5"/><circle cx="95" cy="93" r="8.5"/><circle cx="64" cy="90" r="10.5"/>' +
      '<path d="M17 116c0-8.5 7-14.5 16-14.5s16 6 16 14.5z"/><path d="M79 116c0-8.5 7-14.5 16-14.5s16 6 16 14.5z"/>' +
      '<path d="M44 118c0-11.5 9-18.5 20-18.5s20 7 20 18.5z"/></g>');
    return s;
  };
  const assinatura = () => h('div', { class: 'assina' }, 'feito por ',
    h('a', { href: 'https://github.com/DredsGG', target: '_blank', rel: 'noopener noreferrer', title: 'github.com/DredsGG' }, 'Dreds'),
    P.versao() ? ' · v' + P.versao() : null);

  // ---------- Ícones (SVG: emoji muda de cara em cada sistema) ----------
  const ICONES = {
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
    olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    olhoFechado: '<path d="M4 4l16 16M9.9 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.9 3.7M6.3 7.6C3.9 9.3 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    x: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    mais: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    janela: '<rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 9.5h18" stroke="currentColor" stroke-width="2"/>',
    sair: '<path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10M15 8l4 4-4 4M19 12H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    pessoas: '<circle cx="9" cy="8.5" r="3.2" fill="currentColor"/><path d="M2.8 19c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6z" fill="currentColor"/><circle cx="17" cy="9" r="2.6" fill="currentColor" opacity=".6"/><path d="M16.2 13.6c3 .1 5 2.1 5 5.4h-4.3" fill="currentColor" opacity=".6"/>',
    presente: '<rect x="3.5" y="8.5" width="17" height="4" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 12.5V20h14v-7.5M12 8.5V20M12 8.5C10 5 6.5 5 7 7.5c.3 1.3 3 1 5 1zM12 8.5c2-3.5 5.5-3.5 5-1-.3 1.3-3 1-5 1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    tela: '<rect x="2.5" y="4.5" width="19" height="12.5" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 20.5h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  };
  const icone = (nome, tam = 16) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', tam); s.setAttribute('height', tam);
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'svg');
    svgDe(s, ICONES[nome] || '');
    return s;
  };

  // ---------- Estilo das salas: mesma estrutura, tema de cada plataforma ----------
  // Tokens lidos dos próprios sites em 2026-10-26 (vault: twitch/pesquisa/2026-10-26-visual-twitch-kick).
  const TEMAS = {
    twitch: `--bg:#0e0e10;--painel:#18181b;--elev:#1f1f23;--elev2:#26262c;--linha:rgba(83,83,95,.48);--sec:rgba(83,83,95,.38);--sec2:rgba(83,83,95,.55);
      --texto:#efeff1;--suave:#adadb8;--apagado:#848494;--cor:#9147ff;--cor2:#772ce8;--cor-texto:#fff;--cor-tinta:rgba(145,71,255,.16);--link:#bf94ff;
      --ok:#00f593;--ok-tinta:rgba(0,245,147,.12);--vivo:#eb0400;--alerta:#ff6b6b;--alerta-tinta:rgba(235,4,0,.14);--ouro:#ffd37a;--ouro-tinta:rgba(255,179,26,.14);
      --r-bt:9999px;--r-card:8px;--r-tag:9999px;--titulo:Roobert,Inter,"Helvetica Neue",Arial,sans-serif`,
    kick: `--bg:#090b0f;--painel:#0f1216;--elev:#171a1f;--elev2:#23272b;--linha:#24282d;--sec:#3a3d43;--sec2:#454950;
      --texto:#ffffff;--suave:#a9adb5;--apagado:#7b808a;--cor:#53fc18;--cor2:#46d914;--cor-texto:#090b0f;--cor-tinta:rgba(83,252,24,.075);--link:#53fc18;
      --ok:#53fc18;--ok-tinta:rgba(83,252,24,.12);--vivo:#eb0400;--alerta:#ff6b6b;--alerta-tinta:rgba(235,4,0,.14);--ouro:#ffd37a;--ouro-tinta:rgba(255,179,26,.13);
      --r-bt:4px;--r-card:6px;--r-tag:9999px;--titulo:Inter,"Helvetica Neue",Arial,sans-serif`
  };
  const cssSala = (tema) => `
  :host{all:initial}
  *{box-sizing:border-box}
  .app{${TEMAS[tema]};position:fixed;inset:0;display:flex;flex-direction:column;background:var(--bg);color:var(--texto);font:13px/1.45 Inter,Roobert,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}
  button{font-family:inherit}
  button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid var(--cor);outline-offset:2px}
  .svg{display:block;flex:none}
  /* topo */
  header{display:flex;align-items:center;gap:16px;height:56px;padding:0 12px 0 16px;background:var(--painel);border-bottom:1px solid var(--linha);flex:none}
  .marca{display:flex;align-items:center;gap:10px;white-space:nowrap}
  .marca b{font:700 17px var(--titulo);color:var(--texto);letter-spacing:-.01em}
  .marca .sub{color:var(--suave);font-weight:500;padding-left:10px;border-left:1px solid var(--linha)}
  .chips{display:flex;flex-wrap:wrap;align-items:center;gap:2px;flex:1;min-width:0;max-height:48px;overflow:hidden}
  .chip{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 10px;border-radius:var(--r-tag);color:var(--texto);font-weight:600;font-size:12.5px;white-space:nowrap;cursor:default}
  .chip:hover{background:var(--sec)}
  .chip::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--apagado);flex:none}
  .chip.ok::before{background:var(--ok)}
  .chip.alerta{color:var(--alerta)}
  .chip.alerta::before{background:var(--vivo);box-shadow:0 0 0 3px var(--alerta-tinta)}
  .chip.off{color:var(--apagado)}
  .chip.relogio{font-variant-numeric:tabular-nums;min-width:118px}
  .chip.relogio::before{background:var(--cor)}
  .acoes{display:flex;gap:6px;flex:none}
  .bt{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 14px;border:0;border-radius:var(--r-bt);background:var(--cor);color:var(--cor-texto);font:600 13px Inter,Arial,sans-serif;cursor:pointer;white-space:nowrap}
  .bt:hover{background:var(--cor2)}
  .bt.sec{background:var(--sec);color:var(--texto)}
  .bt.sec:hover{background:var(--sec2)}
  .bt.fantasma{background:transparent;color:var(--suave)}
  .bt.fantasma:hover{background:var(--sec);color:var(--texto)}
  /* lateral */
  .corpo{flex:1;display:flex;min-height:0}
  aside{width:400px;flex:none;display:flex;flex-direction:column;padding:0 16px 14px;background:var(--painel);border-right:1px solid var(--linha);overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:var(--sec) transparent}
  .abas{position:sticky;top:0;z-index:2;display:flex;gap:22px;height:46px;margin:0 -16px 14px;padding:0 16px;background:var(--painel);border-bottom:1px solid var(--linha);flex:none}
  .aba{position:relative;display:flex;align-items:center;gap:6px;background:none;border:0;padding:0;color:var(--suave);font:600 14px Inter,Arial,sans-serif;cursor:pointer}
  .aba:hover{color:var(--texto)}
  .aba.on{color:var(--texto)}
  .aba.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;border-radius:2px;background:var(--cor)}
  .aba .cont{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--sec);color:var(--texto);font-size:11px;display:inline-flex;align-items:center;justify-content:center}
  .conteudo,.aba-canais,.aba-pk,.aba-aj{display:flex;flex-direction:column;gap:12px}
  .add{display:flex;gap:6px}
  .add input{flex:1;min-width:0;height:36px;padding:0 14px;background:var(--elev);border:2px solid transparent;border-radius:var(--r-bt);color:var(--texto);font:14px Inter,Arial,sans-serif;outline:none}
  .add input::placeholder{color:var(--apagado)}
  .add input:hover{border-color:var(--linha)}
  .add input:focus{border-color:var(--cor);background:var(--bg)}
  .add .bt{height:36px}
  .atalhos{display:flex;flex-wrap:wrap;gap:6px;margin-top:-4px}
  .lk{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 12px 0 9px;border:0;border-radius:var(--r-tag);background:var(--sec);color:var(--texto);font:600 12.5px Inter,Arial,sans-serif;cursor:pointer}
  .lk:hover{background:var(--sec2)}
  .lk:disabled{opacity:.4;cursor:default;background:var(--sec)}
  .lk .svg{width:13px;height:13px}
  .pk{border-radius:var(--r-card);padding:9px 12px;background:var(--ouro-tinta);border-left:3px solid var(--ouro)}
  .pk .st{white-space:normal;color:var(--texto)}
  .pk b{color:var(--ouro)}
  .pk b.tw{color:#bf94ff}
  .pk b.kk{color:#53fc18}
  .pk .aviso{margin:0 0 6px}
  .pk .st + .st{margin-top:2px}
  .pk .nota{color:var(--suave)}
  /* lista de canais */
  .secao{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:14px 8px 4px;color:var(--suave);font:600 12.5px Inter,Arial,sans-serif}
  .secao:first-child{margin-top:2px}
  .secao .n{color:var(--apagado);font-weight:500;margin-left:5px}
  .secao .tempo{font-variant-numeric:tabular-nums;color:var(--texto)}
  .lista{display:flex;flex-direction:column;gap:2px;margin:0 -8px}
  .card{display:grid;grid-template-columns:38px minmax(0,1fr) auto;column-gap:12px;align-items:start;padding:10px 8px;border-radius:var(--r-card);position:relative}
  .card > img,.card > .ph{grid-row:1 / span 2}
  .meio{grid-column:2;grid-row:1}
  .lado{display:contents}
  .bts{grid-column:3;grid-row:1}
  .modos{grid-column:2 / span 2;grid-row:2;justify-self:start;margin-top:9px}
  .card:hover{background:var(--elev)}
  .card.tocando{background:var(--cor-tinta)}
  .card:not(.vivo){color:var(--suave)}
  .card img,.card .ph{width:38px;height:38px;border-radius:50%;background:var(--elev2);object-fit:cover;margin-top:1px}
  .card:not(.vivo) img{filter:grayscale(1);opacity:.55}
  .card.vivo img{box-shadow:0 0 0 2px var(--painel),0 0 0 4px var(--vivo)}
  .card.tocando img{box-shadow:0 0 0 2px var(--painel),0 0 0 4px var(--cor)}
  .meio{min-width:0;display:flex;flex-direction:column;gap:1px}
  .nome{font-weight:700;font-size:14px;display:flex;align-items:center;gap:6px;min-width:0;line-height:1.3}
  .st{color:var(--suave);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ganho{color:var(--ok);font-weight:600}
  .tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
  .tags:empty{display:none}
  .tag{display:inline-flex;align-items:center;gap:4px;height:19px;padding:0 7px;border-radius:var(--r-tag);background:var(--sec);color:var(--texto);font-size:11px;font-weight:600;white-space:nowrap;line-height:1}
  .tag.t1{background:var(--cor);color:var(--cor-texto)}
  .tag.t2{background:var(--ok-tinta);color:var(--ok)}
  .tag.t3{background:var(--ouro-tinta);color:var(--ouro)}
  .tag .svg{width:9px;height:9px}
  .bts{display:flex;gap:2px}
  .bts .ic{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:var(--r-bt);background:transparent;color:var(--apagado);cursor:pointer}
  .bts .ic:hover{background:var(--sec);color:var(--texto)}
  .bts .ic.on{color:var(--texto)}
  .bts .ic.x:hover{color:var(--alerta);background:var(--alerta-tinta)}
  .bts .ic.agora{background:var(--cor);color:var(--cor-texto)}
  .bts .ic.agora:hover{background:var(--cor2)}
  .modos{display:flex;gap:2px;padding:2px;border-radius:var(--r-bt);background:var(--elev2)}
  .modo{height:22px;padding:0 9px;border:0;border-radius:var(--r-bt);background:transparent;color:var(--suave);font:600 11.5px Inter,Arial,sans-serif;cursor:pointer;white-space:nowrap}
  .modo:hover{color:var(--texto)}
  .modo.on{background:var(--cor);color:var(--cor-texto)}
  .barra-lista{display:flex;justify-content:flex-end;gap:2px;margin-top:-6px}
  .mini{height:26px;padding:0 10px;border:0;border-radius:var(--r-bt);background:transparent;color:var(--suave);font:600 12px Inter,Arial,sans-serif;cursor:pointer}
  .mini:hover{background:var(--sec);color:var(--texto)}
  .mini:disabled{opacity:.4;cursor:default;background:transparent;color:var(--suave)}
  .mini.perigo,.mini.perigo:hover{background:var(--alerta-tinta);color:var(--alerta)}
  .drops{background:var(--elev);border-radius:var(--r-card);padding:12px}
  .tit{display:flex;align-items:center;gap:7px;font-weight:700;font-size:13.5px;margin-bottom:2px}
  .tit .svg{color:var(--cor)}
  .drop{margin-top:8px}
  .barra{height:4px;background:var(--sec);border-radius:2px;overflow:hidden;margin-top:5px}
  .barra i{display:block;height:100%;border-radius:2px;background:var(--cor)}
  /* ajustes */
  .grupo{display:flex;flex-direction:column}
  .grupo-tit{font:600 12.5px Inter,Arial,sans-serif;color:var(--suave);margin:6px 0 2px}
  .aj{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:11px 0;border-bottom:1px solid var(--linha);cursor:pointer}
  .grupo .aj:last-child{border-bottom:0}
  .aj span{flex:1;font-weight:600;font-size:13.5px}
  .aj small{display:block;color:var(--suave);font-size:12px;font-weight:400;margin-top:2px;line-height:1.4}
  .aj input[type=checkbox]{appearance:none;-webkit-appearance:none;flex:none;position:relative;width:36px;height:20px;margin:0;border-radius:10px;background:var(--sec2);cursor:pointer;transition:background .15s}
  .aj input[type=checkbox]::after{content:"";position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s}
  .aj input[type=checkbox]:checked{background:var(--cor)}
  .aj input[type=checkbox]:checked::after{transform:translateX(16px);background:var(--cor-texto)}
  .aj input[type=number]{flex:none;width:64px;height:32px;padding:0 6px;background:var(--elev);border:2px solid transparent;border-radius:var(--r-bt);color:var(--texto);font:600 14px Inter,Arial,sans-serif;text-align:center;outline:none}
  .aj input[type=number]:focus{border-color:var(--cor)}
  .aviso{margin:0;padding:8px 11px;border-radius:var(--r-card);background:var(--alerta-tinta);color:var(--alerta);font-size:12.5px}
  .nota{color:var(--apagado);font-size:12px;margin:0;line-height:1.5}
  .assina{color:var(--apagado);font-size:11.5px;margin-top:auto;padding-top:10px;align-self:flex-end}
  .assina a{color:var(--link);font-weight:700;text-decoration:none}
  .assina a:hover{text-decoration:underline}
  .upd{margin-top:auto;padding-top:16px}
  .upd + .assina{margin-top:0;padding-top:6px}
  /* palco */
  .palco{flex:1;display:grid;gap:6px;padding:6px;min-width:0;background:#000;position:relative;grid-auto-rows:1fr}
  .palco iframe{width:100%;height:100%;border:0;background:#000;border-radius:var(--r-card);min-height:0}
  iframe.oculto{position:fixed!important;left:0;bottom:0;width:2px!important;height:2px!important;opacity:0;pointer-events:none;border:0}
  .vazio{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--suave);text-align:center;padding:40px;font-size:14px}
  .vazio .svg{width:44px;height:44px;color:var(--sec2)}
  /* tutorial e novidades */
  .qd-fundo{position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.6)}
  .qd{position:relative;width:min(460px,100%);max-height:calc(100% - 40px);overflow:auto;padding:20px 22px 18px;background:var(--painel);border:1px solid var(--linha);border-radius:12px;box-shadow:0 24px 64px rgba(0,0,0,.55);color:var(--texto)}
  .qd-x{position:absolute;top:10px;right:10px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:var(--r-bt);background:transparent;color:var(--suave);cursor:pointer}
  .qd-x:hover{background:var(--sec);color:var(--texto)}
  .qd-tit{display:flex;align-items:center;gap:10px;margin:0 30px 14px 0;font:700 15px var(--titulo);color:var(--suave)}
  .qd-passo{color:var(--cor);font-weight:700;font-size:12px}
  .qd h3{margin:4px 0 8px;font:700 19px var(--titulo);letter-spacing:-.01em}
  .qd p{margin:0;color:var(--suave);font-size:14px;line-height:1.6}
  .qd-pontos{display:flex;gap:5px;margin:18px 0 0}
  .qd-pontos i{width:7px;height:7px;border-radius:4px;background:var(--sec2);transition:width .15s}
  .qd-pontos i.on{width:20px;background:var(--cor)}
  .qd-lista{margin:0;padding-left:20px;font-size:14px;line-height:1.55}
  .qd-lista li{margin:7px 0}
  .qd-bts{display:flex;align-items:center;gap:6px;margin-top:18px}
  .qd-esp{flex:1}
  .qd-bt{height:34px;padding:0 16px;border:0;border-radius:var(--r-bt);background:var(--cor);color:var(--cor-texto);font:600 13.5px Inter,Arial,sans-serif;cursor:pointer}
  .qd-bt:hover{background:var(--cor2)}
  .qd-bt.sec{background:var(--sec);color:var(--texto)}
  .qd-bt.sec:hover{background:var(--sec2)}
  .qd-q{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:1.5px solid currentColor;font-weight:800;font-size:11px}
  @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
  `;

  // ---------- Tutorial de primeiro uso e Novidades (regra 12) ----------
  const TUTORIAL = {
    twitch: [
      ['Bem-vindo à sala da Twitch', 'Aqui você fica presente em várias lives de uma vez. A Twitch só paga pontos e baú em 2 lives por vez: essas 2 tocam de verdade, e nas outras você fica no chat.'],
      ['Seus canais', 'Adicione canais pelo nome ou link, pelos que você segue ao vivo ou pelas lives do PokeIdle. Cada canal tem um modo: Fixo (sempre tem vaga), Rodízio (reveza as vagas) ou Só chat.'],
      ['Valendo agora', 'As lives que ganham pontos ficam no topo, com o tempo até o próximo rodízio. O ▶ põe uma live na vaga na hora, o olho esconde o vídeo sem parar de contar e o × tira da lista.'],
      ['PokeIdle', 'Com o jogo aberto numa aba, a Plateia lê os canais com bônus e põe na lista. A aba PokeIdle mostra o seu bônus e em quais lives o jogo já te vê.'],
      ['Ajustes e rodapé', 'Em Ajustes você muda vagas, rodízio, baú e Drops automáticos. No rodapé: Procurar atualização e Relatar bug. Este tutorial volta no "? Como usar", no topo.']
    ],
    kick: [
      ['Bem-vindo à sala da Kick', 'A Kick só paga pontos em 2 lives por vez. A sala toca essas 2 e acompanha o saldo dos outros canais da lista.'],
      ['Seus canais', 'Adicione canais pelo nome ou link, pelos que você segue ao vivo ou pelos canais do PokeIdle. Modos: Fixo (sempre tem vaga), Fila (entra quando sobra vaga) ou Fora (só acompanha o saldo).'],
      ['Pacote do PokeIdle', 'Quando o saldo de um canal cobre XP + Capture Boost + Secret Lure, a Plateia compra os três. Só com a Kick vinculada no jogo. O resumo dourado mostra o próximo pacote.'],
      ['Daily Reward e Drops', 'A recompensa diária e os Drops que chegam a 100% são pegos sozinhos. Dá para desligar cada um em Ajustes.'],
      ['Ajustes e rodapé', 'Em Ajustes você muda as vagas e o que é automático. No rodapé: Procurar atualização e Relatar bug. Este tutorial volta no "? Como usar", no topo.']
    ]
  };
  const quadros = (opts) => {
    let aberto = null;
    const esc = (e) => { if (e.key === 'Escape' && aberto) { e.stopPropagation(); e.preventDefault(); aberto.fechar(); } };
    const fechar = async (marcar) => {
      if (!aberto) return;
      aberto.el.remove(); aberto = null;
      document.removeEventListener('keydown', esc, true);
      if (marcar) await marcar();
    };
    const marcarVisto = async () => { const q = (await P.ler('quadros', null)) || {}; q.tutorial = true; q.novidades = P.versao(); await P.gravar('quadros', q); };
    const montar = (conteudo, fecharFn) => {
      const fundo = h('div', { class: 'qd-fundo', onclick: (e) => { if (e.target === fundo) fecharFn(); } },
        h('div', { class: 'qd', role: 'dialog', 'aria-modal': 'true' },
          h('button', { class: 'qd-x', title: 'Fechar (Esc)', 'aria-label': 'Fechar', onclick: fecharFn }, icone('x', 14)),
          ...conteudo));
      opts.app.appendChild(fundo);
      aberto = { el: fundo, fechar: fecharFn };
      document.addEventListener('keydown', esc, true);
    };
    const abrirTutorial = async () => {
      await fechar();
      const passos = TUTORIAL[opts.sala] || TUTORIAL.twitch;
      let i = 0;
      const corpo = h('div', { class: 'qd-corpo' });
      const fim = () => fechar(marcarVisto);
      const desenhar = () => {
        const [t, x] = passos[i];
        repor(corpo,
          h('div', { class: 'qd-passo' }, `Passo ${i + 1} de ${passos.length}`),
          h('h3', {}, t), h('p', {}, x),
          h('div', { class: 'qd-pontos' }, ...passos.map((_, k) => h('i', { class: k === i ? 'on' : '' }))),
          h('div', { class: 'qd-bts' },
            i < passos.length - 1 ? h('button', { class: 'qd-bt sec qd-pular', onclick: fim }, 'Pular') : null,
            h('span', { class: 'qd-esp' }),
            i > 0 ? h('button', { class: 'qd-bt sec', onclick: () => { i--; desenhar(); } }, 'Voltar') : null,
            i < passos.length - 1 ? h('button', { class: 'qd-bt qd-prox', onclick: () => { i++; desenhar(); } }, 'Próximo')
              : h('button', { class: 'qd-bt qd-ok', onclick: fim }, 'Entendi')));
      };
      desenhar();
      montar([h('div', { class: 'qd-tit' }, logo(22), h('b', {}, opts.sala === 'kick' ? 'Como usar a sala da Kick' : 'Como usar a sala da Twitch')), corpo], fim);
    };
    const abrirNovidades = (v) => {
      const itens = (P.CHANGELOG && P.CHANGELOG.pt && P.CHANGELOG.pt[v]) || [];
      if (!itens.length) return false;
      fechar();
      const fim = () => fechar(marcarVisto);
      montar([
        h('div', { class: 'qd-tit' }, logo(22), h('b', {}, `Novidades da v${v}`)),
        h('ul', { class: 'qd-lista' }, ...itens.map((t) => h('li', {}, t))),
        h('div', { class: 'qd-bts' },
          h('button', { class: 'qd-bt sec', onclick: () => fechar(marcarVisto).then(abrirTutorial) }, 'Ver o tutorial'),
          h('span', { class: 'qd-esp' }),
          h('button', { class: 'qd-bt qd-ok', onclick: fim }, 'Entendi'))], fim);
      return true;
    };
    // instalação nova: só o tutorial; atualização: só as novidades (uma vez por versão)
    const checar = async () => {
      const v = P.versao();
      const q = await P.ler('quadros', null);
      if (q && q.tutorial) { if (q.novidades !== v && !abrirNovidades(v)) await marcarVisto(); return; }
      const at = (await P.ler('atualizacao', null)) || {};
      if (at.instalacaoNova || !abrirNovidades(v)) abrirTutorial();
    };
    const botao = h('button', { class: 'bt fantasma qd-ajuda', title: 'Como usar a sala', 'aria-label': 'Como usar', onclick: abrirTutorial }, h('span', { class: 'qd-q' }, '?'), 'Como usar');
    return { botao, abrirTutorial, abrirNovidades, checar };
  };
  // ---------- Atualização (regra 7): procura no GitHub, aviso com o que mudou, botão Atualizar ----------
  const enviar = (msg) => Promise.resolve().then(() => P.ext.runtime.sendMessage(msg)).then((r) => r || null, () => null);
  const notasEmItens = (txt) => String(txt || '').split(/\r?\n/).map((l) => l.trim())
    .filter((l) => /^[-*•]\s+/.test(l)).map((l) => l.replace(/^[-*•]\s+/, '').replace(/\*\*/g, '').replace(/`/g, '')).slice(0, 6);
  // ---------- Relatar bug (regra 9): relato nos Issues do repo, com versão e diagnóstico sem dado pessoal ----------
  const REPO_ISSUES = 'https://github.com/DredsGG/plateia/issues/new';
  const svgBug = () => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', 13); s.setAttribute('height', 13); s.setAttribute('aria-hidden', 'true');
    svgDe(s, '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="7" width="10" height="13" rx="5"/><path d="M9 7.5V6a3 3 0 0 1 6 0v1.5M12 11v9M3 13h4M17 13h4M4 7.5l3 2.5M20 7.5l-3 2.5M4 19.5l3.2-2.5M20 19.5l-3.2-2.5"/></g>');
    return s;
  };
  const navegador = () => {
    const ua = navigator.userAgent || '';
    const m = ua.match(/(Edg|OPR|Chrome)\/(\d+)/);
    const nome = m ? ({ Edg: 'Edge', OPR: 'Opera', Chrome: 'Chrome' })[m[1]] + ' ' + m[2] : 'navegador desconhecido';
    const so = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'outro sistema';
    return `${nome} · ${so} · ${navigator.language || '?'}`;
  };
  const relatarBug = (opts, lerSt) => {
    let aberto = false;
    const caixa = h('div', { class: 'upd-bug', style: 'display:none' });
    const campo = h('textarea', { class: 'upd-bug-txt', rows: '3', placeholder: 'O que aconteceu? O que você esperava? (ex.: a live entrou e saiu, o baú não foi pego)' });
    // as teclas digitadas aqui não vão para os atalhos da Twitch/Kick
    for (const ev of ['keydown', 'keyup', 'keypress']) campo.addEventListener(ev, (e) => e.stopPropagation());
    const previa = h('pre', { class: 'upd-bug-pre' });
    const aviso = h('span', { class: 'upd-bug-ok' });
    const diagnostico = () => {
      const st = lerSt() || {};
      const linhas = [
        ['Plateia', `v${P.versao()}${st.instalacao ? ' (' + (st.instalacao === 'development' ? 'pasta' : st.instalacao) + ')' : ''}`],
        ['Sala', opts.sala || '?'],
        ['Navegador', navegador()],
        ['Página', location.host + location.pathname],
        ['Atualização', st.erro && !st.ultima ? 'não deu para procurar (' + st.erro + ')' : st.ultima ? `última no GitHub: v${st.ultima}` : 'ainda não procurou'],
      ];
      try { for (const l of (opts.diagnostico ? opts.diagnostico() : [])) if (l && l.length === 2) linhas.push(l); } catch (e) { linhas.push(['Diagnóstico da sala', 'falhou: ' + e.message]); }
      linhas.push(['Hora', new Date().toISOString()]);
      return linhas.map(([k, v]) => `- ${k}: ${v}`).join('\n');
    };
    const corpo = () => {
      const t = (campo.value || '').trim().slice(0, 3000);
      return `**O que aconteceu?**\n${t || '(não descrito)'}\n\n**Diagnóstico** (gerado pela Plateia, sem dados da conta)\n${diagnostico()}\n`;
    };
    const atualizarPrevia = () => { previa.textContent = diagnostico(); };
    const abrirNoGithub = () => {
      const t = (campo.value || '').trim().split('\n')[0].slice(0, 70);
      const url = REPO_ISSUES + '?title=' + encodeURIComponent('[Bug] ' + (t || 'relato pela sala ' + (opts.sala || ''))) + '&body=' + encodeURIComponent(corpo());
      window.open(url.length > 7900 ? url.slice(0, 7900) : url, '_blank', 'noopener');
      aviso.textContent = 'Abri o relato no GitHub. Confira e clique em Create.';
    };
    const copiar = async () => {
      const txt = corpo();
      try { await navigator.clipboard.writeText(txt); aviso.textContent = 'Relatório copiado.'; }
      catch (e) {
        const ta = h('textarea', { style: 'position:fixed;left:-9999px' }); ta.value = txt; caixa.appendChild(ta); ta.select();
        try { document.execCommand('copy'); aviso.textContent = 'Relatório copiado.'; } catch (e2) { aviso.textContent = 'Não deu para copiar.'; }
        ta.remove();
      }
    };
    repor(caixa,
      h('b', {}, 'Relatar bug'),
      h('p', { class: 'upd-bug-dica' }, 'Abre um relato público nos Issues do GitHub (precisa de conta no GitHub). Vai junto só o diagnóstico abaixo, nada da sua conta.'),
      campo,
      h('details', { class: 'upd-bug-det' }, h('summary', {}, 'O que vai junto'), previa),
      h('div', { class: 'upd-bts' },
        h('button', { class: 'upd-bug-bt pri', onclick: abrirNoGithub }, 'Abrir no GitHub'),
        h('button', { class: 'upd-bug-bt', onclick: copiar }, 'Copiar relatório'),
        h('button', { class: 'upd-bug-bt', onclick: () => alternar(false) }, 'Fechar')),
      aviso);
    const alternar = (v) => { aberto = v === undefined ? !aberto : v; caixa.style.display = aberto ? '' : 'none'; if (aberto) { atualizarPrevia(); aviso.textContent = ''; campo.focus(); } };
    const botao = h('button', { class: 'upd-proc upd-bugbt', title: 'Relatar um bug no GitHub da Plateia', onclick: () => alternar() }, svgBug(), 'Relatar bug');
    return { caixa, botao, corpo, diagnostico, abrirNoGithub };
  };
  const atualizacao = (opts = {}) => {
    const caixa = h('div', { class: 'upd' });
    let st = {}, procurando = false, baixou = false;
    const bug = relatarBug(opts, () => st);
    P.relatarBug = bug; // usado pelos testes
    const desenhar = () => {
      const agora = Date.now();
      const v = P.versao();
      const temNova = st.disponivel && st.ultima && st.dispensada !== st.ultima;
      const recente = st.acabouDeAtualizar && agora - st.acabouDeAtualizar.em < 30 * 60000 && st.acabouDeAtualizar.para === v;
      const status = procurando ? 'Procurando…' : st.erro && !st.ultima ? 'Não deu para procurar agora'
        : st.disponivel ? h('a', { href: '#', class: 'upd-link', onclick: (e) => { e.preventDefault(); salvarDispensa(null); } }, `v${st.ultima} disponível`)
        : st.ultima ? 'Você está na versão mais nova' : '';
      repor(caixa,
        recente ? h('div', { class: 'upd-ok' }, `Plateia atualizada: v${st.acabouDeAtualizar.de || '?'} → v${st.acabouDeAtualizar.para}`) : null,
        temNova ? h('div', { class: 'upd-card' },
          h('b', {}, 'Atualização disponível'), h('span', { class: 'upd-ver' }, ` · v${v} → v${st.ultima}`),
          ...(notasEmItens(st.notas).length ? [h('ul', {}, ...notasEmItens(st.notas).map((n) => h('li', {}, n)))] : []),
          baixou ? h('p', { class: 'upd-dica' }, P.ehFirefox && P.ehFirefox()
            ? 'Zip baixado. No Firefox (instalação temporária): extraia e carregue de novo em about:debugging → Carregar extensão temporária. '
            : 'Zip baixado. Extraia por cima da pasta da Plateia (substituindo os arquivos): ela se recarrega sozinha em até 1 minuto. ',
            h('a', { href: '#', class: 'upd-link', onclick: (e) => { e.preventDefault(); enviar({ cmd: 'abrirGuia', ancora: '#atualizar' }); } }, 'Como fazer')) : null,
          h('div', { class: 'upd-bts' },
            h('button', { class: 'upd-bt', onclick: async () => { const r = await enviar({ cmd: 'aplicarAtualizacao' }); baixou = !!(r && r.modo === 'download'); desenhar(); } }, 'Atualizar'),
            h('button', { class: 'upd-bt sec', onclick: () => salvarDispensa(st.ultima) }, 'Depois'))) : null,
        bug.caixa,
        h('div', { class: 'upd-linha' },
          h('button', { class: 'upd-proc' + (procurando ? ' girando' : ''), title: 'Procurar versão nova no GitHub', onclick: procurar }, h('span', { class: 'upd-ic' }, '↻'), 'Procurar atualização'),
          bug.botao,
          h('span', { class: 'upd-esp' }),
          h('button', { class: 'upd-i', title: 'Como instalar e atualizar', onclick: () => enviar({ cmd: 'abrirGuia', ancora: '#atualizar' }) }, 'i')),
        status ? h('div', { class: 'upd-st' }, status) : null);
    };
    const salvarDispensa = async (versao) => {
      try { const r = await P.ext.storage.local.get('atualizacao'); await P.ext.storage.local.set({ atualizacao: Object.assign({}, r.atualizacao || {}, { dispensada: versao }) }); } catch (e) {}
    };
    const procurar = async () => {
      procurando = true; desenhar();
      const r = await enviar({ cmd: 'procurarAtualizacao' });
      procurando = false;
      if (r) st = r;
      desenhar();
    };
    (async () => {
      try { st = (await P.ext.storage.local.get('atualizacao')).atualizacao || {}; } catch (e) {}
      desenhar();
      if (!st.procuradoEm || Date.now() - st.procuradoEm > 3600e3) procurar();
    })();
    P.aoMudar((m) => { if (m.atualizacao) { st = m.atualizacao.newValue || {}; desenhar(); } });
    return caixa;
  };
  const CSS_ATUALIZACAO = `
  .upd{display:flex;flex-direction:column;gap:8px;margin-top:auto}
  .upd-linha{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--apagado,#a8a8b3)}
  .upd-proc{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;background:var(--sec,#1f1f23);border:0;border-radius:var(--r-bt,6px);color:var(--texto,#dedee3);font:600 12px Inter,Arial,sans-serif;cursor:pointer}
  .upd-proc:hover{background:var(--sec2,#2a2a30)}
  .upd-ic{display:inline-block}
  .upd-proc.girando .upd-ic{animation:girar 1s linear infinite}
  @keyframes girar{to{transform:rotate(360deg)}}
  .upd-st{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;color:var(--apagado,#a8a8b3)}
  .upd-esp{flex:1}
  .upd-proc svg{display:block;flex:none}
  .upd-bug{background:var(--elev,#18181b);border:1px solid var(--linha,#2f2f35);border-radius:var(--r-card,8px);padding:12px;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--texto,#efeff1)}
  .upd-bug-dica{margin:0;color:var(--suave,#adadb8);font-size:12px;line-height:1.45}
  .upd-bug-txt{width:100%;box-sizing:border-box;resize:vertical;min-height:58px;background:var(--bg,#0e0e10);color:var(--texto,#efeff1);border:2px solid var(--linha,#2f2f35);border-radius:var(--r-card,6px);padding:7px 9px;font:13px Inter,Arial,sans-serif;outline:none}
  .upd-bug-txt:focus{border-color:var(--cor,#9147ff)}
  .upd-bug-det summary{cursor:pointer;color:var(--suave,#adadb8);font-size:12px}
  .upd-bug-pre{margin:6px 0 0;max-height:150px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:var(--bg,#0e0e10);border-radius:6px;padding:8px;font:11px/1.45 Consolas,Menlo,monospace;color:var(--suave,#adadb8)}
  .upd-bug-bt{height:28px;padding:0 12px;border:1px solid var(--linha,#35353b);border-radius:var(--r-bt,6px);background:var(--sec,#26262c);color:var(--texto,#efeff1);font:600 12px Inter,Arial,sans-serif;cursor:pointer}
  .upd-bug-bt:hover{background:var(--sec2,#35353b)}
  .upd-bug-bt.pri{border-color:var(--cor,#9147ff)}
  .upd-bug-ok{font-size:12px;color:var(--ok,#7ee2b8)}
  .upd-i{width:24px;height:24px;flex:none;border-radius:50%;border:0;background:var(--sec,#1f1f23);color:var(--texto,#dedee3);font:700 12px Georgia,serif;cursor:pointer;padding:0}
  .upd-i:hover{background:var(--sec2,#2a2a30)}
  .upd-link{color:var(--link,#bf94ff);font-weight:700;text-decoration:none}
  .upd-card{background:rgba(255,215,106,.09);border:1px solid rgba(255,215,106,.45);border-radius:var(--r-card,8px);padding:12px;color:#f6e7b0;font-size:12.5px}
  .upd-card b{color:#ffd76a}
  .upd-ver{color:#e8d590}
  .upd-card ul{margin:8px 0 4px;padding-left:18px}
  .upd-card li{margin:3px 0}
  .upd-dica{margin:8px 0 0;font-size:12px}
  .upd-bts{display:flex;gap:6px;margin-top:10px}
  .upd-bt{height:30px;background:#ffd76a;color:#1b1500;border:0;border-radius:var(--r-bt,6px);padding:0 14px;font:700 12.5px Inter,Arial,sans-serif;cursor:pointer}
  .upd-bt:hover{background:#ffe08a}
  .upd-bt.sec{background:rgba(255,215,106,.14);color:#f6e7b0}
  .upd-ok{background:var(--ok-tinta,#123d22);color:var(--ok,#a6f0c0);border-radius:var(--r-card,8px);padding:9px 12px;font-size:12.5px;font-weight:600}
  `;
  // bolinha dourada no botão "Plateia" quando tem versão nova
  const marcarNovidade = async (botao) => {
    const aplicar = (st) => {
      const nova = !!(st && st.disponivel && st.ultima && st.dispensada !== st.ultima);
      botao.classList.toggle('nova', nova);
      if (nova) botao.title = `Plateia v${st.ultima} disponível: abra a sala para atualizar`;
    };
    try { aplicar((await P.ext.storage.local.get('atualizacao')).atualizacao); } catch (e) {}
    P.aoMudar((m) => { if (m.atualizacao) aplicar(m.atualizacao.newValue); });
  };
  const CSS_BOLINHA = 'button.nova::after{content:"";position:absolute;top:-3px;right:-3px;width:11px;height:11px;border-radius:50%;background:#ffd76a;border:2px solid #0e0e10}';
  P.ui = { svgDe, h, repor, fmt, mmss, hhmm, duracao, logo, assinatura, atualizacao, CSS_ATUALIZACAO, marcarNovidade, CSS_BOLINHA, icone, cssSala, quadros };
})();
