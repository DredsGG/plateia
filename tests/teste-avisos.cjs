// Regra 14: na página da Twitch/Kick (fora da sala), tutorial, novidades e aviso de versão nova
// aparecem sozinhos no meio da tela, sem fundo que bloqueie a página, e fecham no X ou no Esc.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom'); // npm i jsdom
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const manifest = JSON.parse(ler('manifest.json'));
const V = manifest.version;
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? 'OK     ' : 'FALHOU ') + n + (!c && extra ? '\n       ' + extra : '')); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function montar(store, sala = 'twitch') {
  const ouvintes = [], msgs = [];
  if (!store.idioma) store.idioma = 'pt';
  const url = sala === 'kick' ? 'https://kick.com/algumcanal' : 'https://www.twitch.tv/algumcanal';
  const dom = new JSDOM('<!doctype html><html><body><div id="site">site</div></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const abertos = [];
  w.open = (u, n) => { abertos.push(u); return {}; };
  w.chrome = {
    runtime: { getManifest: () => manifest, getURL: (p) => 'chrome-extension://x/' + p,
      sendMessage: async (m) => { msgs.push(m); return m.cmd === 'aplicarAtualizacao' ? { modo: 'download', status: 'baixado' } : null; } },
    storage: { local: {
      get: async (k) => ({ [k]: store[k] === undefined ? undefined : JSON.parse(JSON.stringify(store[k])) }),
      set: async (o) => { const m = {}; for (const [k, v] of Object.entries(o)) { m[k] = { newValue: JSON.parse(JSON.stringify(v)), oldValue: store[k] }; store[k] = JSON.parse(JSON.stringify(v)); } ouvintes.forEach((f) => f(m, 'local')); } },
      onChanged: { addListener: (f) => ouvintes.push(f) } }
  };
  w.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: {} }), text: async () => '{}' });
  w.WebSocket = class { send() {} close() {} };
  for (const f of manifest.content_scripts[sala === 'kick' ? 1 : 0].js) w.eval(ler(f));
  const host = () => w.document.getElementById('plateia-avisos');
  const sr = () => host() && host().shadowRoot;
  const quadro = () => sr() && sr().querySelector('.qd');
  const mudar = (patch) => w.chrome.storage.local.set(patch);
  return { w, store, host, sr, quadro, msgs, abertos, mudar };
}
const esc = (a) => a.w.document.dispatchEvent(new a.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

(async () => {
  // 1) instalação nova: tutorial sozinho na página, sem abrir a sala
  const a = montar({ atualizacao: { instalacaoNova: true } });
  await espera(300);
  ok('instalação nova: tutorial aparece na página da Twitch', !!a.quadro() && /Como usar a sala da Twitch/.test(a.quadro().textContent) && !a.w.document.getElementById('plateia-sala'));
  ok('quadro solto: a página continua clicável (sem fundo escuro)', a.host().style.pointerEvents === 'none' && !!a.sr().querySelector('.app.solto') && a.quadro().getAttribute('aria-modal') === 'false');
  ok('botão Plateia continua na página', !!a.w.document.getElementById('plateia-lancador'));
  for (let i = 0; i < 4; i++) a.sr().querySelector('.qd-prox').click();
  ok('último passo: "Abrir a sala" e "Entendi"', !!a.sr().querySelector('.qd-ok') && /Abrir a sala/.test(a.sr().querySelector('.qd-ok').textContent) && !!a.sr().querySelector('.qd-entendi'));
  a.sr().querySelector('.qd-ok').click(); await espera(50);
  ok('"Abrir a sala" fecha, grava que viu e abre a sala', !a.quadro() && a.store.quadros && a.store.quadros.tutorial === true && a.abertos.some((u) => /#plateia$/.test(u)));

  // 2) Esc fecha e grava
  const b = montar({ atualizacao: { instalacaoNova: true } }, 'kick');
  await espera(300);
  ok('Kick: tutorial aparece na página da Kick', !!b.quadro() && /Como usar a sala da Kick/.test(b.quadro().textContent));
  esc(b); await espera(50);
  ok('Esc fecha e grava que viu', !b.quadro() && b.store.quadros && b.store.quadros.tutorial === true);

  // 3) depois de atualizar: novidades da versão, uma vez
  const c = montar({ quadros: { tutorial: true, novidades: '0.7.0' } });
  await espera(300);
  ok(`atualização: "Novidades da v${V}" na página`, !!c.quadro() && c.quadro().textContent.includes(`Novidades da v${V}`) && c.sr().querySelectorAll('.qd-lista li').length >= 2);
  c.sr().querySelector('.qd-x').click(); await espera(50);
  const c2 = montar({ quadros: c.store.quadros });
  await espera(300);
  ok('novidades não voltam na próxima abertura', !c2.quadro());

  // 4) Release mais novo: "Nova versão" com o que mudou e Atualizar
  const nov = { pt: ['Coisa nova A.', 'Coisa nova B.'], en: ['New thing A.', 'New thing B.'], es: ['Cosa nueva A.', 'Cosa nueva B.'] };
  const st = { disponivel: true, ultima: '9.9.9', novidades: nov, novidadesDe: '9.9.9', notas: '- note' };
  const d = montar({ quadros: { tutorial: true, novidades: V }, atualizacao: st, idioma: 'es' });
  await espera(300);
  ok('versão nova: "Nueva versión v9.9.9" com o resumo no idioma (es)', !!d.quadro() && /Nueva versión v9\.9\.9/.test(d.quadro().textContent) && /Cosa nueva A\./.test(d.quadro().textContent));
  ok('quadro de versão não bloqueia a página', d.host().style.pointerEvents === 'none');
  d.sr().querySelector('.qd-atualizar').click(); await espera(50);
  ok('Atualizar chama a atualização do navegador e mostra o que fazer', d.msgs.some((m) => m.cmd === 'aplicarAtualizacao') && /Zip descargado/.test(d.quadro().textContent));
  const e = montar({ quadros: { tutorial: true, novidades: V }, atualizacao: st });
  await espera(300);
  ok('aparece de novo na próxima abertura (até atualizar)', !!e.quadro() && /Nova versão v9\.9\.9/.test(e.quadro().textContent));
  e.sr().querySelector('.qd-x').click(); await espera(50);
  ok('X esconde e grava a versão dispensada', !e.quadro() && e.store.atualizacao.dispensada === '9.9.9');
  const f = montar({ quadros: { tutorial: true, novidades: V }, atualizacao: e.store.atualizacao });
  await espera(300);
  ok('dispensada: não aparece mais na mesma versão', !f.quadro());
  await f.mudar({ atualizacao: Object.assign({}, f.store.atualizacao, { ultima: '9.9.10', novidadesDe: '9.9.10' }) }); await espera(50);
  ok('saiu outra mais nova (procura de 6 h): aparece sozinho, sem recarregar', !!f.quadro() && /Nova versão v9\.9\.10/.test(f.quadro().textContent));
  esc(f); await espera(50);
  ok('Esc também esconde', !f.quadro() && f.store.atualizacao.dispensada === '9.9.10');
  const g = montar({ quadros: { tutorial: true, novidades: V }, atualizacao: { disponivel: true, ultima: '9.9.9', notas: '### Install\ntexto\n\n- Item do release 1\n- Item do release 2' } });
  await espera(300);
  ok('sem changelog remoto: usa os itens do texto do Release', !!g.quadro() && /Item do release 1/.test(g.quadro().textContent));
  const h = montar({ quadros: { tutorial: true, novidades: V }, atualizacao: { disponivel: true, ultima: '0.0.1' } });
  await espera(300);
  ok('versão "nova" menor que a instalada: nada aparece', !h.quadro());

  // 5) prioridade: instalação nova mostra só o tutorial, mesmo com versão nova
  const i = montar({ atualizacao: Object.assign({ instalacaoNova: true }, st) });
  await espera(300);
  ok('instalação nova com versão nova: só o tutorial primeiro', !!i.quadro() && /Passo 1 de 5/.test(i.quadro().textContent));

  // 6) abrir a sala tira o quadro da página
  const j = montar({ atualizacao: st, quadros: { tutorial: true, novidades: V } }, 'twitch');
  await espera(300);
  j.w.location.hash = '#plateia'; await espera(400);
  ok('ao abrir a sala, o quadro solto da página some', !j.host() && !!j.w.document.getElementById('plateia-sala'));
  const salaQd = j.w.document.getElementById('plateia-sala').shadowRoot.querySelector('.qd-fundo.leve .qd');
  ok('na sala o aviso de versão nova também aparece sozinho, sem fundo escuro', !!salaQd && /Nova versão v9\.9\.9/.test(salaQd.textContent));

  // 7) dentro de iframe (lives da sala): nada
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
  process.exit(falhas ? 1 : 0);
})();
