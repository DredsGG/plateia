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
  // ---------- Atualização (regra 7): procura no GitHub, aviso com o que mudou, botão Atualizar ----------
  const enviar = (msg) => new Promise((ok) => { try { chrome.runtime.sendMessage(msg, (r) => { void chrome.runtime.lastError; ok(r || null); }); } catch (e) { ok(null); } });
  const notasEmItens = (txt) => String(txt || '').split(/\r?\n/).map((l) => l.trim())
    .filter((l) => /^[-*•]\s+/.test(l)).map((l) => l.replace(/^[-*•]\s+/, '').replace(/\*\*/g, '').replace(/`/g, '')).slice(0, 6);
  // ---------- Relatar bug (regra 9): relato nos Issues do repo, com versão e diagnóstico sem dado pessoal ----------
  const REPO_ISSUES = 'https://github.com/DredsGG/plateia/issues/new';
  const svgBug = () => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', 13); s.setAttribute('height', 13); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="7" y="7" width="10" height="13" rx="5"/><path d="M9 7.5V6a3 3 0 0 1 6 0v1.5M12 11v9M3 13h4M17 13h4M4 7.5l3 2.5M20 7.5l-3 2.5M4 19.5l3.2-2.5M20 19.5l-3.2-2.5"/></g>';
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
          baixou ? h('p', { class: 'upd-dica' }, 'Zip baixado. Extraia por cima da pasta da Plateia (substituindo os arquivos): ela se recarrega sozinha em até 1 minuto. ',
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
      try { const r = await chrome.storage.local.get('atualizacao'); await chrome.storage.local.set({ atualizacao: Object.assign({}, r.atualizacao || {}, { dispensada: versao }) }); } catch (e) {}
    };
    const procurar = async () => {
      procurando = true; desenhar();
      const r = await enviar({ cmd: 'procurarAtualizacao' });
      procurando = false;
      if (r) st = r;
      desenhar();
    };
    (async () => {
      try { st = (await chrome.storage.local.get('atualizacao')).atualizacao || {}; } catch (e) {}
      desenhar();
      if (!st.procuradoEm || Date.now() - st.procuradoEm > 3600e3) procurar();
    })();
    P.aoMudar((m) => { if (m.atualizacao) { st = m.atualizacao.newValue || {}; desenhar(); } });
    return caixa;
  };
  const CSS_ATUALIZACAO = `
  .upd{display:flex;flex-direction:column;gap:6px;margin-top:auto}
  .upd-linha{display:flex;align-items:center;gap:6px;font-size:11.5px;color:#a8a8b3}
  .upd-proc{display:flex;align-items:center;gap:5px;background:#1f1f23;border:1px solid #303036;border-radius:6px;color:#dedee3;padding:3px 8px;font:600 11.5px Inter,Arial,sans-serif;cursor:pointer}
  .upd-proc:hover{border-color:var(--cor)}
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
  .upd-i{width:20px;height:20px;border-radius:50%;border:1px solid #303036;background:#1f1f23;color:#dedee3;font:700 11px Georgia,serif;cursor:pointer;padding:0}
  .upd-link{color:var(--cor);font-weight:700;text-decoration:none}
  .upd-card{background:linear-gradient(135deg,#3a2c08,#1f1a0b);border:1px solid #c9a227;border-radius:8px;padding:9px;color:#f6e7b0;font-size:12.5px}
  .upd-card b{color:#ffd76a}
  .upd-ver{color:#e8d590}
  .upd-card ul{margin:6px 0 4px;padding-left:18px}
  .upd-card li{margin:2px 0}
  .upd-dica{margin:6px 0 0;font-size:12px}
  .upd-bts{display:flex;gap:6px;margin-top:6px}
  .upd-bt{background:#ffd76a;color:#1b1500;border:0;border-radius:6px;padding:6px 12px;font:700 12px Inter,Arial,sans-serif;cursor:pointer}
  .upd-bt.sec{background:#3a3424;color:#f6e7b0}
  .upd-ok{background:#123d22;border:1px solid #2f9e57;color:#a6f0c0;border-radius:8px;padding:7px 9px;font-size:12.5px;font-weight:600}
  `;
  // bolinha dourada no botão "Plateia" quando tem versão nova
  const marcarNovidade = async (botao) => {
    const aplicar = (st) => {
      const nova = !!(st && st.disponivel && st.ultima && st.dispensada !== st.ultima);
      botao.classList.toggle('nova', nova);
      if (nova) botao.title = `Plateia v${st.ultima} disponível: abra a sala para atualizar`;
    };
    try { aplicar((await chrome.storage.local.get('atualizacao')).atualizacao); } catch (e) {}
    P.aoMudar((m) => { if (m.atualizacao) aplicar(m.atualizacao.newValue); });
  };
  const CSS_BOLINHA = 'button.nova::after{content:"";position:absolute;top:-3px;right:-3px;width:11px;height:11px;border-radius:50%;background:#ffd76a;border:2px solid #0e0e10}';
  P.ui = { h, repor, fmt, mmss, hhmm, duracao, logo, assinatura, atualizacao, CSS_ATUALIZACAO, marcarNovidade, CSS_BOLINHA };
})();
