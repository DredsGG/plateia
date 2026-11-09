// Resgate automático do bônus do PokeIdle na Twitch (v0.9.4, jsdom): painel falso igual ao medido em 2026-11-09
// (faturetosl): botão "Saldos de Pontos e Bits" -> .reward-center__content -> recompensa (alt da imagem = nome,
// .reward-icon__cost = custo) -> tela de DETALHE com "Resgatar <custo>" -> 2º clique compra, saldo cai, linha no chat,
// painel fecha. O painel fica dentro dos iframes da sala (vagas que valem). Nenhum ponto real é gasto.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom'); // npm i jsdom
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const manifest = JSON.parse(ler('manifest.json'));
const V = manifest.version;
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? 'OK     ' : 'FALHOU ') + n + (!c && extra ? '\n       ' + extra : '')); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// as 12 recompensas do jogo + 3 que não são dele, como no painel real (nomes e custos medidos)
const RECOMPENSAS = [
  ['Destacar minha mensagem', 99], ['Bônus +15% XP PokeIdle', 300], ['Bônus de +15% Capture Boost', 500],
  ['Enviar uma mensagem somente para inscritos', 699], ['Bônus +15% XP PokeIdle (3h)', 900], ['Bônus de +15% Secret Lure', 1000],
  ['Bônus +15% XP PokeIdle (5h)', 1500], ['Bônus de +15% Capture Boost (3h)', 1500], ['Bônus de +15% Capture Boost (5h)', 2500],
  ['Bônus +15% XP PokeIdle (10h)', 3000], ['Bônus de +15% Secret Lure (3h)', 3000], ['Bônus de +15% Secret Lure (5h)', 5000],
  ['Bônus de +15% Capture Boost (10h)', 5000], ['ESCOLHER SKIN DO HOMEM ', 8000], ['Bônus de +15% Secret Lure (10h)', 10000]
].map(([nome, custo]) => ({ nome, custo }));
const fmtPt = (n) => Number(n).toLocaleString('pt-BR');

function chromeFalso(store, ouvintes) {
  return {
    runtime: { getManifest: () => manifest },
    storage: {
      local: {
        get: async (k) => ({ [k]: store[k] === undefined ? undefined : JSON.parse(JSON.stringify(store[k])) }),
        set: async (o) => {
          const mud = {};
          // como o Chrome: o ouvinte recebe uma CÓPIA (nunca o mesmo objeto que o código gravou)
          for (const [k, v] of Object.entries(o)) { mud[k] = { oldValue: store[k], newValue: JSON.parse(JSON.stringify(v)) }; store[k] = JSON.parse(JSON.stringify(v)); }
          for (const f of ouvintes) f(mud, 'local');
        }
      },
      onChanged: { addListener: (f) => ouvintes.push(f) }
    }
  };
}

// monta a sala da Twitch com o jogo "vinculado" e canais oficiais; devolve o mundo falso para os testes mexerem
async function montar(o = {}) {
  const mundo = Object.assign({
    saldos: { canala: 20000, canalb: 20000 }, vivos: new Set(['canala', 'canalb', 'canalc']), cliques: [], compras: [],
    semQueda: false, semBotaoResgatar: false, noClique: [], recompensas: RECOMPENSAS.map((r) => Object.assign({}, r)), custoNoDetalhe: {}
  }, o.mundo || {});
  const store = { idioma: o.idioma || 'pt', quadros: { tutorial: true, novidades: V } }, ouvintes = [];
  const agoraMs = Date.now();
  store.pokeidle = Object.assign({
    vinculado: true, login: 'odreds', assistindo: false, pct: 15, lives: [], assistindoEm: [], minutos: 60, em: agoraMs,
    recompensas: [{ tipo: 'xp', custo: 300 }, { tipo: 'captura', custo: 500 }, { tipo: 'shiny', custo: 1000 }],
    oficiais: [{ login: 'canala', nome: 'CanalA', bonus: true, ativo: true, aoVivo: true }, { login: 'canalb', nome: 'CanalB', bonus: true, ativo: true, aoVivo: true },
      { login: 'canalc', nome: 'CanalC', bonus: false, ativo: false, aoVivo: true }]
  }, o.pk || {});
  store.config = Object.assign({ canais: (o.canais || ['canala', 'canalb']).map((login) => ({ login, mostrar: false, modo: 'rodizio' })), seguirPokeidle: false,
    vagas: 2, rodizio: false, presencaChat: false, qualidadeBaixa: false, dropsAuto: false, bauAuto: false, v020: true }, o.config || {});
  if (o.registros) store.twitchResgates = o.registros;
  if (o.bloqueioStorage) store.twitchResgateBloqueio = o.bloqueioStorage;
  if (o.urgente) store.atualizacao = { disponivel: true, ultima: '99.0.0', urgente: true };
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.twitch.tv/drops/inventory#plateia', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.document.cookie = 'auth-token=x'; w.document.cookie = 'login=' + (o.loginSessao || 'odreds');
  w.chrome = chromeFalso(store, ouvintes);
  w.fetch = async (url, opt) => {
    const q = (JSON.parse(opt.body).query) || '';
    if (q.includes('inventory')) return { ok: true, json: async () => ({ data: { currentUser: { inventory: { dropCampaignsInProgress: [] } } } }) };
    const data = {};
    for (const m of q.matchAll(/(c\d+):user\(login:"([^"]+)"\)/g)) {
      const l = m[2];
      data[m[1]] = { login: l, displayName: l, profileImageURL: '', stream: mundo.vivos.has(l) ? { id: '1', viewersCount: 10, game: { displayName: 'Jogo' } } : null,
        channel: { self: { communityPoints: { balance: mundo.saldos[l] === undefined ? null : mundo.saldos[l] } } } };
    }
    return { ok: true, json: async () => ({ data }) };
  };
  const scripts = manifest.content_scripts[0].js;
  for (const f of scripts) w.eval(ler(f));
  const R = w.PLATEIA.twitchResgate;
  R.TEMPOS.original = R.TEMPOS.entreCompras;
  Object.assign(R.TEMPOS, { entreCompras: () => 40, achar: 1500, confirmar: 1200, confirmarPasso: 100, poll: 15, folga: 100, jitterTrava: () => 5 });
  R.canalDoFrame = (fr) => fr.dataset.login; // iframes do jsdom ficam em about:blank
  if (o.antes) o.antes(R, mundo);
  // painel falso dentro de cada iframe da sala (instalado "depois que a página carrega")
  const sr = () => w.document.getElementById('plateia-sala') && w.document.getElementById('plateia-sala').shadowRoot;
  function instalar(fr) {
    const login = fr.dataset.login;
    // jsdom deixa o documento do iframe dentro de shadow DOM sem body (o Chrome carrega a página): dá um documento próprio a cada moldura
    if (!fr.contentDocument || !fr.contentDocument.body) Object.defineProperty(fr, 'contentDocument', { value: new JSDOM('<!doctype html><html><body></body></html>').window.document, configurable: true });
    const d = fr.contentDocument;
    if (!d || !d.body || o.semPainel || d.querySelector('[data-test-selector="community-points-summary"]')) return;
    const msgs = d.createElement('div'); msgs.className = 'chat-scrollable-area__message-container'; d.body.appendChild(msgs);
    if (mundo.linhasAntigas) { // linha velha minha e linha de outra pessoa, de antes do clique: não podem confirmar a compra
      for (const t of ['odreds resgatou ' + XP + ' 3.000', 'outrapessoa resgatou ' + CAP + ' 5.000']) { const l = d.createElement('div'); l.textContent = t; msgs.appendChild(l); }
    }
    const resumo = d.createElement('div'); resumo.setAttribute('data-test-selector', 'community-points-summary');
    const btn = d.createElement('button'); btn.setAttribute('aria-label', 'Saldos de Pontos e Bits'); btn.textContent = String(mundo.saldos[login]);
    resumo.appendChild(btn); d.body.appendChild(resumo);
    let painel = null;
    const fechar = () => { if (painel) { painel.remove(); painel = null; } };
    const cab = (comVoltar) => {
      const f = d.createElement('div');
      if (comVoltar) { const v = d.createElement('button'); v.setAttribute('aria-label', 'Voltar'); v.addEventListener('click', lista); f.appendChild(v); }
      const x = d.createElement('button'); x.setAttribute('aria-label', 'Fechar'); x.addEventListener('click', () => { mundo.cliques.push('fechar ' + login); fechar(); }); f.appendChild(x);
      return f;
    };
    function montarPainel() { fechar(); painel = d.createElement('div'); painel.className = 'reward-center__content'; d.body.appendChild(painel); }
    function lista() {
      montarPainel(); painel.appendChild(cab(false));
      for (const r of mundo.recompensas) {
        const b = d.createElement('button'); const img = d.createElement('img'); img.alt = r.nome; b.appendChild(img);
        const c = d.createElement('span'); c.className = 'reward-icon__cost'; c.textContent = fmtPt(r.custo); b.appendChild(c);
        b.addEventListener('click', () => detalhe(r)); painel.appendChild(b);
      }
    }
    function detalhe(r) {
      mundo.cliques.push('detalhe ' + login + ' ' + r.nome);
      montarPainel(); painel.appendChild(cab(true));
      const t = d.createElement('h4'); t.textContent = r.nome; painel.appendChild(t);
      const p = d.createElement('p'); p.textContent = '10 horas de +15% no PokeIdle. As horas acumulam.'; painel.appendChild(p);
      if (mundo.semBotaoResgatar) return;
      const rb = d.createElement('button');
      if (mundo.semEspacoNoBotao) rb.innerHTML = '<span>Resgatar</span><span>' + fmtPt(mundo.custoNoDetalhe[r.nome] || r.custo) + '</span>'; // textContent = "Resgatar3.000"
      else rb.textContent = 'Resgatar ' + fmtPt(mundo.custoNoDetalhe[r.nome] || r.custo);
      rb.disabled = !!mundo.botaoDesabilitado;
      rb.addEventListener('click', () => {
        mundo.noClique.push((store.twitchResgates || [])[0] || null); // o que já estava gravado NO MOMENTO do 2º clique
        mundo.cliques.push('RESGATAR ' + login + ' ' + r.nome);
        mundo.compras.push({ login, nome: r.nome, custo: r.custo, em: Date.now() });
        if (!mundo.semQueda) {
          mundo.saldos[login] -= r.custo; btn.textContent = String(mundo.saldos[login]);
          const l = d.createElement('div'); l.textContent = 'odreds resgatou ' + r.nome + ' ' + fmtPt(r.custo); msgs.appendChild(l);
        }
        fechar();
      });
      painel.appendChild(rb);
    }
    btn.addEventListener('click', () => { if (painel) fechar(); else { mundo.cliques.push('abrir ' + login); lista(); } });
    fr.dataset.fake = '1';
  }
  const timer = w.setInterval(() => { const s = sr(); if (s) for (const fr of s.querySelectorAll('iframe')) instalar(fr); }, 15);
  // espera a sala criar as lives e o "carregamento" do painel falso; depois dispara o ciclo como o jogo faz (dados novos)
  for (let i = 0; i < 100 && !o.urgente; i++) { const f = sr() ? [...sr().querySelectorAll('iframe')] : []; if (f.length && f.every((x) => x.dataset.fake || o.semPainel)) break; await espera(20); }
  await espera(R.TEMPOS.folga + 60);
  if (!o.semGatilho) ouvintes.forEach((f) => f({ pokeidle: { newValue: store.pokeidle } }, 'local'));
  const resgate = () => w.PLATEIA.salaTwitchResgate;
  const ocioso = async (min = 500) => { // espera o ciclo (ou os ciclos) terminarem
    await espera(min);
    for (let i = 0; i < 400 && resgate().estado().resgatando; i++) await espera(25);
    await espera(120);
  };
  const aba = (rotulo) => { const b = [...sr().querySelectorAll('.abas .aba')].find((x) => x.textContent.startsWith(rotulo)); b.click(); };
  const textoAbaPk = () => { aba('PokeIdle'); return sr().querySelector('.aba-pk').textContent.replace(/\s+/g, ' '); };
  const fim = () => { w.clearInterval(timer); };
  return { w, store, ouvintes, mundo, sr, resgate, ocioso, aba, textoAbaPk, fim, R };
}
const ordem = (m) => m.compras.map((c) => c.nome + '@' + c.login);
const XP = 'Bônus +15% XP PokeIdle (10h)', CAP = 'Bônus de +15% Capture Boost (10h)', LURE = 'Bônus de +15% Secret Lure (10h)';
const hora = (h) => Date.now() + h * 3600e3;

(async () => {
  // ---------- 0) o guarda do jogo: formato novo (04/11/2026) e antigo ----------
  {
    const store = {}, ouv = [];
    const pkdom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://pokeidle.io/app', runScripts: 'outside-only' });
    const pw = pkdom.window;
    pw.postMessage = (data, origem) => setTimeout(() => pw.dispatchEvent(new pw.MessageEvent('message', { data, origin: origem, source: pw })), 0);
    pw.chrome = chromeFalso(store, ouv);
    pw.eval(ler('src/comum.js')); pw.eval(ler('src/pokeidle-guarda.js'));
    const fimXp = Date.now() + 7 * 3600e3;
    pw.postMessage({ plateia: 'pokeidle-twitch', tw: { vinculado: true, login: 'ODreds', pct: 15, minutos: 60, bonus: { xp: fimXp, captura: 0, shiny: 0 },
      recompensas: [{ tipo: 'xp', custo: 300 }], pacotes: [3, 5, 10], oficiais: [{ login: 'FaturetoSL', nome: 'FaturetoSL', ativo: true, aoVivo: true, espectadores: 9 }, { login: 'rodil', nome: 'Rodil', ativo: false, aoVivo: false }] } }, '*');
    await espera(60);
    const b = store.pokeidle || {};
    ok('guarda (formato novo): grava o fim de cada bônus, minutos e recompensas', b.bonus && b.bonus.xp === fimXp && b.bonus.captura === 0 && b.minutos === 60 && b.recompensas && b.recompensas[0].custo === 300);
    ok('guarda (formato novo): oficiais com ativo/aoVivo e "bonus" vindo de ativo; pct do campo novo', b.oficiais && b.oficiais[0].login === 'faturetosl' && b.oficiais[0].ativo === true && b.oficiais[0].bonus === true && b.oficiais[1].bonus === false && b.pct === 15 && b.vinculado === true && b.login === 'odreds');
    const store2 = {}; const pw2 = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://pokeidle.io/app', runScripts: 'outside-only' }).window;
    pw2.postMessage = (data, origem) => setTimeout(() => pw2.dispatchEvent(new pw2.MessageEvent('message', { data, origin: origem, source: pw2 })), 0);
    pw2.chrome = chromeFalso(store2, []);
    pw2.eval(ler('src/comum.js')); pw2.eval(ler('src/pokeidle-guarda.js'));
    pw2.postMessage({ plateia: 'pokeidle-twitch', tw: { login: 'odreds', pctAtual: 0.2, oficiais: [{ login: 'matta', bonus: true }], assistindoEm: ['matta'] } }, '*');
    await espera(60);
    const c = store2.pokeidle || {};
    ok('guarda (formato antigo): continua aceito e, sem o campo, não inventa o fim do bônus', c.oficiais && c.oficiais[0].bonus === true && c.vinculado === true && c.pct === 0.2 && !('bonus' in c));
  }

  // ---------- 1) contas puras ----------
  {
    const a = await montar({ canais: [] });
    const R = a.R;
    ok('tabela de compra: 10 h de XP 3.000, Capture 5.000, Lure 10.000, nessa ordem; nenhuma acima de 10.000',
      R.TIPOS.map((t) => t.tipo + ':' + t.custo).join() === 'xp:3000,captura:5000,shiny:10000' && R.TIPOS.every((t) => /\(10h\)$/.test(t.nome) && t.custo <= R.CUSTO_MAX) && R.CUSTO_MAX === 10000);
    const sorteios = Array.from({ length: 200 }, () => R.TEMPOS.original());
    ok('espera entre compras: de 3 a 5 s (aleatória)', sorteios.every((x) => x >= 3000 && x < 5000) && new Set(sorteios.map((x) => Math.round(x))).size > 50);
    const agora = Date.now();
    ok('fim estimado: 10 h por compra e as horas somam (relógio corrido)', R.fimEstimado('xp', [{ tipo: 'xp', ok: true, em: agora - 3600e3 }, { tipo: 'xp', ok: true, em: agora - 1000 }]) === agora - 3600e3 + 20 * 3600e3);
    ok('fim estimado conta a compra não confirmada, mas não a que falhou antes do clique', R.fimEstimado('xp', [{ tipo: 'xp', incerta: true, em: agora }]) === agora + 10 * 3600e3 && R.fimEstimado('xp', [{ tipo: 'xp', ok: false, em: agora }]) === 0);
    ok('fim valendo = o maior entre o do jogo e o das compras (o jogo demora a creditar)', R.fim('xp', { bonus: { xp: agora + 3600e3 } }, [{ tipo: 'xp', ok: true, em: agora }]).ate === agora + 10 * 3600e3 && R.fim('xp', { bonus: { xp: agora + 3600e3 } }, []).fonte === 'jogo' && R.fim('xp', {}, []).fonte === 'estimado');
    a.fim();
  }

  // ---------- 2) compra na ordem XP -> Capture -> Lure (dois cliques por item, na live da sala) ----------
  {
    const a = await montar({ mundo: { saldos: { canala: 20000, canalb: 500 } } });
    await a.ocioso(700);
    ok('compra na ordem XP -> Capture Boost -> Secret Lure, todos de 10 h', ordem(a.mundo).join() === [XP, CAP, LURE].map((n) => n + '@canala').join(), ordem(a.mundo).join(' | '));
    const sequencia = a.mundo.cliques.filter((c) => !/^fechar/.test(c));
    ok('cada item = abrir o painel, 1º clique abre o detalhe, 2º clique compra', sequencia.join('|') === ['abrir canala', 'detalhe canala ' + XP, 'RESGATAR canala ' + XP, 'abrir canala', 'detalhe canala ' + CAP, 'RESGATAR canala ' + CAP, 'abrir canala', 'detalhe canala ' + LURE, 'RESGATAR canala ' + LURE].join('|'), sequencia.join(' | '));
    ok('saldo do canal caiu 18.000 (3.000 + 5.000 + 10.000) e o painel ficou fechado', a.mundo.saldos.canala === 2000 && !a.sr().querySelectorAll('iframe')[0].contentDocument.querySelector('.reward-center__content'));
    const reg = a.store.twitchResgates || [];
    ok('twitchResgates gravou as 3 compras (canal, bônus, hora, custo, saldo antes/depois)', reg.length === 3 && reg.every((r) => r.ok && r.canal === 'canala' && r.em > 0 && r.custo > 0 && typeof r.saldoAntes === 'number' && typeof r.saldoDepois === 'number') && reg.map((r) => r.tipo).reverse().join() === 'xp,captura,shiny', JSON.stringify(reg.map((r) => r.tipo)));
    const t = a.textoAbaPk();
    ok('aba PokeIdle: 3 bônus ativos com hora de fim (estimado) e últimos resgates; sem "te vê" nem "+X%"', /Bônus ativos/.test(t) && (t.match(/até \d{2}:\d{2}/g) || []).length === 3 && /\+15% XP/.test(t) && /\+15% Capture Boost/.test(t) && /Secret Lure/.test(t) && /Últimos resgates/.test(t) && !/te vê|ainda não viu|seu bônus/.test(t), t);
    const chip = [...a.sr().querySelectorAll('.chip')].map((c) => c.textContent).join(' | ');
    ok('chip do topo: "PokeIdle: 3 bônus · ..." (não mais "te vê a/b" nem "+X%")', /PokeIdle: 3 bônus · 9h5\d|PokeIdle: 3 bônus · 10h00/.test(chip) && !/te vê/.test(chip), chip);
    a.fim();
  }

  // ---------- 3) saldo: não compra sem cobrir; escolhe o canal certo ----------
  {
    const a = await montar({ mundo: { saldos: { canala: 2999, canalb: 100 } } });
    await a.ocioso(600);
    ok('não compra sem saldo (2.999 < 3.000): nenhum clique em Resgatar', a.mundo.compras.length === 0 && !a.mundo.cliques.some((c) => /detalhe|RESGATAR/.test(c)));
    a.fim();
    const b = await montar({ mundo: { saldos: { canala: 3000, canalb: 100 } } });
    await b.ocioso(600);
    ok('saldo exato de 3.000: compra só o XP (o resto não cobre)', ordem(b.mundo).join() === XP + '@canala', ordem(b.mundo).join());
    b.fim();
    const c = await montar({ mundo: { saldos: { canala: 4000, canalb: 6000 } } });
    await c.ocioso(700);
    ok('saldo por canal: XP no canal de menor saldo que cobre, Capture no que cobre, Lure ninguém (um item por vez)', ordem(c.mundo).join() === `${XP}@canala,${CAP}@canalb`, ordem(c.mundo).join());
    c.fim();
  }

  // ---------- 4) não compra com nome ou custo diferente ----------
  {
    const a = await montar({ mundo: { recompensas: RECOMPENSAS.filter((r) => r.nome !== XP) } });
    await a.ocioso(500);
    const e = (a.store.twitchResgates || [])[0] || {};
    ok('nome da recompensa não encontrado: NÃO clica na recompensa, registra o motivo e para', a.mundo.compras.length === 0 && !a.mundo.cliques.some((c) => /detalhe|RESGATAR/.test(c)) && e.ok === false && /não encontrada/.test(e.erro || ''), JSON.stringify(e));
    ok('...e o painel foi fechado depois da conferência', !a.sr().querySelectorAll('iframe')[0].contentDocument.querySelector('.reward-center__content'));
    ok('...e a aba mostra o erro e a hora da próxima tentativa; chip "resgate parado até"', /Resgate parado: .*não encontrada/.test(a.textoAbaPk()) && /Tenta de novo às \d{2}:\d{2}/.test(a.textoAbaPk()) && [...a.sr().querySelectorAll('.chip')].some((c) => /resgate parado até/.test(c.textContent)));
    a.fim();
    const b = await montar({ mundo: { recompensas: RECOMPENSAS.map((r) => (r.nome === XP ? { nome: XP, custo: 3100 } : r)) } });
    await b.ocioso(500);
    const eb = (b.store.twitchResgates || [])[0] || {};
    ok('custo diferente na lista (3.100 em vez de 3.000): não clica e registra', b.mundo.compras.length === 0 && !b.mundo.cliques.some((c) => /detalhe|RESGATAR/.test(c)) && /custo diferente/.test(eb.erro || ''), JSON.stringify(eb));
    b.fim();
    const c = await montar({ mundo: { custoNoDetalhe: { [XP]: 3100 } } });
    await c.ocioso(500);
    const ec = (c.store.twitchResgates || [])[0] || {};
    ok('botão Resgatar com custo diferente do esperado: não compra', c.mundo.compras.length === 0 && c.mundo.cliques.some((x) => /detalhe/.test(x)) && !c.mundo.cliques.some((x) => /RESGATAR/.test(x)) && /Resgatar mostra 3100, esperado 3000/.test(ec.erro || ''), JSON.stringify(ec));
    c.fim();
    const d = await montar({ mundo: { semBotaoResgatar: true } });
    await d.ocioso(500);
    const ed = (d.store.twitchResgates || [])[0] || {};
    ok('botão Resgatar sumiu: para e registra', d.mundo.compras.length === 0 && /Resgatar não apareceu/.test(ed.erro || ''), JSON.stringify(ed));
    d.fim();
  }

  // ---------- 5) não empilha ----------
  {
    const a = await montar({ pk: { bonus: { xp: hora(5), captura: hora(2), shiny: hora(1.5) } } });
    await a.ocioso(600);
    ok('não empilha: os três com mais de 1 h (pelo fim do jogo) = nenhuma compra', a.mundo.compras.length === 0 && !a.mundo.cliques.length);
    ok('...e a aba explica', /não empilha/.test(a.textoAbaPk()));
    a.fim();
    const b = await montar({ pk: { bonus: { xp: Date.now() + 50 * 60000, captura: hora(5), shiny: hora(5) } } });
    await b.ocioso(700);
    ok('restante de 50 min (< 1 h): compra o XP uma vez e só ele (depois da compra já passa de 10 h)', ordem(b.mundo).join() === XP + '@canala', ordem(b.mundo).join());
    b.fim();
    const c = await montar({ registros: [{ em: Date.now() - 2 * 3600e3, canal: 'canala', tipo: 'xp', nome: XP, custo: 3000, ok: true }] });
    await c.ocioso(700);
    ok('jogo sem o campo do fim: usa o registro local (XP comprado há 2 h = 8 h restantes), compra só Capture e Lure', ordem(c.mundo).join() === `${CAP}@canala,${LURE}@canala`, ordem(c.mundo).join());
    c.fim();
    const d = await montar({ pk: { bonus: { xp: 0, captura: 0, shiny: 0 } }, registros: [{ em: Date.now() - 60000, canal: 'canala', tipo: 'xp', nome: XP, custo: 3000, ok: true }] });
    await d.ocioso(700);
    ok('o jogo ainda não creditou (fim 0) mas acabamos de comprar: não compra o XP em dobro', !ordem(d.mundo).some((x) => x.startsWith(XP)) && ordem(d.mundo).length === 2, ordem(d.mundo).join());
    d.fim();
  }

  // ---------- 6) erro: para e espera 15 min ----------
  {
    const a = await montar({ mundo: { semQueda: true } });
    await a.ocioso(900);
    const reg0 = (a.store.twitchResgates || [])[0] || {};
    ok('saldo não caiu depois do clique: erro, registra como não confirmado e NÃO tenta Capture/Lure no mesmo ciclo', a.mundo.compras.length === 1 && /saldo não caiu/.test(reg0.erro || '') && reg0.incerta === true && a.mundo.cliques.filter((c) => /^abrir/.test(c)).length === 1, JSON.stringify(reg0) + ' ' + a.mundo.cliques.join('|'));
    const cliquesAntes = a.mundo.cliques.length;
    const r1 = await a.resgate().tentar(), r2 = await a.resgate().tentar();
    ok('nos 15 min seguintes nenhuma tentativa clica em nada', cliquesAntes === a.mundo.cliques.length && /parado após um erro/.test(r1.pulou || '') && /parado após um erro/.test(r2.pulou || ''), JSON.stringify([r1, r2]));
    const st = a.resgate().estado();
    ok('a espera é de 15 min', st.bloqueadoAte > Date.now() + 14.5 * 60000 && st.bloqueadoAte < Date.now() + 15.1 * 60000);
    // passam 16 min; o erro some; compra a compra não confirmada conta como feita (não paga o XP de novo)
    const real = a.w.Date.now; a.w.Date.now = () => real() + 16 * 60000; a.mundo.semQueda = false; a.mundo.saldos.canala = 20000;
    a.ouvintes.forEach((f) => f({ pokeidle: { newValue: Object.assign({}, a.store.pokeidle, { em: a.w.Date.now() }) } }, 'local'));
    await a.ocioso(700);
    ok('depois dos 15 min volta a comprar (sem repetir o XP não confirmado): Capture e Lure', ordem(a.mundo).slice(1).join() === `${CAP}@canala,${LURE}@canala` && ordem(a.mundo).length === 3, ordem(a.mundo).join());
    a.fim();
  }

  // ---------- 7) trava de concorrência: duas chamadas = uma compra ----------
  {
    const a = await montar({ mundo: { saldos: { canala: 3000, canalb: 0 } }, pk: { bonus: { xp: 0, captura: hora(5), shiny: hora(5) } }, config: { resgateAuto: false } });
    await a.ocioso(300);
    const antes = a.mundo.compras.length;
    // liga pelo ajuste (UI) e chama três vezes ao mesmo tempo
    a.aba('Ajustes');
    const lin = [...a.sr().querySelectorAll('.aba-aj .aj')].find((l) => /Resgate automático do bônus/.test(l.textContent));
    const chk = lin.querySelector('input[type=checkbox]');
    ok('ajuste "Resgate automático do bônus" existe, desligado = nenhuma compra', !!chk && chk.checked === false && antes === 0);
    chk.checked = true; chk.dispatchEvent(new a.w.Event('change', { bubbles: true }));
    const rs = await Promise.all([a.resgate().tentar(), a.resgate().tentar(), a.resgate().tentar()]);
    await a.ocioso(300);
    ok('três chamadas ao mesmo tempo: só uma entra, as outras voltam "ocupado"', rs.filter((r) => r.pulou === 'ocupado').length === 2 && rs.filter((r) => !r.pulou).length === 1, JSON.stringify(rs));
    ok('...e a compra acontece uma vez só (saldo 3.000 = um XP)', ordem(a.mundo).join() === XP + '@canala' && a.mundo.saldos.canala === 0 && (a.store.twitchResgates || []).length === 1, ordem(a.mundo).join());
    a.fim();
  }

  // ---------- 8) duas salas abertas ao mesmo tempo: a trava no storage segura a segunda ----------
  {
    const a = await montar({ mundo: { saldos: { canala: 3000, canalb: 0 } }, pk: { bonus: { xp: 0, captura: hora(5), shiny: hora(5) } }, config: { resgateAuto: false } });
    await a.ocioso(300);
    a.store.twitchResgateTrava = { id: 'outra-sala', ate: Date.now() + 60000 };
    a.aba('Ajustes');
    const chk = [...a.sr().querySelectorAll('.aba-aj .aj')].find((l) => /Resgate automático do bônus/.test(l.textContent)).querySelector('input[type=checkbox]');
    chk.checked = true; chk.dispatchEvent(new a.w.Event('change', { bubbles: true }));
    const r = await a.resgate().tentar();
    ok('outra sala com a trava: não compra', r.pulou === 'outra sala' && a.mundo.compras.length === 0, JSON.stringify(r));
    ok('quem perdeu a trava NÃO apaga a trava de quem está comprando', a.store.twitchResgateTrava.id === 'outra-sala' && a.store.twitchResgateTrava.ate > Date.now(), JSON.stringify(a.store.twitchResgateTrava));
    a.store.twitchResgateTrava = { id: 'outra-sala', ate: Date.now() - 1 };
    const r2 = await a.resgate().tentar();
    ok('trava vencida: compra e solta a trava no fim', r2.compras === 1 && a.store.twitchResgateTrava.ate === 0, JSON.stringify(r2));
    a.fim();
  }

  // ---------- 9) atualização urgente para tudo (antes e no meio) ----------
  {
    const a = await montar({ urgente: true });
    await a.ocioso(500);
    ok('atualização urgente pendente: nenhuma live, nenhum clique, nenhuma compra', a.mundo.compras.length === 0 && a.sr().querySelectorAll('iframe').length === 0 && !a.mundo.cliques.length);
    const r = await a.resgate().tentar();
    ok('...e tentar() devolve o motivo', /urgente/.test(r.pulou || ''), JSON.stringify(r));
    a.fim();
    // no meio do ciclo: depois da 1ª compra chega o Release URGENTE
    const b = await montar({ config: { resgateAuto: false } });
    await b.ocioso(300);
    b.aba('Ajustes');
    const chk = [...b.sr().querySelectorAll('.aba-aj .aj')].find((l) => /Resgate automático do bônus/.test(l.textContent)).querySelector('input[type=checkbox]');
    const iframe = b.sr().querySelectorAll('iframe')[0];
    const antigo = b.mundo.compras.push.bind(b.mundo.compras);
    b.mundo.compras.push = (...x) => { const n = antigo(...x); setTimeout(() => b.ouvintes.forEach((f) => f({ atualizacao: { newValue: { disponivel: true, ultima: '99.0.0', urgente: true } } }, 'local')), 5); return n; };
    chk.checked = true; chk.dispatchEvent(new b.w.Event('change', { bubbles: true }));
    await b.resgate().tentar();
    await b.ocioso(200);
    ok('urgente chega no meio do ciclo: para depois da compra em andamento (1 compra, não 3)', b.mundo.compras.length === 1, ordem(b.mundo).join());
    b.fim();
  }

  // ---------- 10) travas de elegibilidade ----------
  {
    const caso = async (nome, o, esperaMotivo) => {
      const a = await montar(o);
      await a.ocioso(500);
      const r = await a.resgate().tentar();
      ok(nome, a.mundo.compras.length === 0 && !a.mundo.cliques.length && (!esperaMotivo || esperaMotivo.test(r.pulou || '')), JSON.stringify(r) + ' ' + a.mundo.cliques.join('|'));
      const t = a.textoAbaPk();
      a.fim();
      return t;
    };
    const t1 = await caso('login Twitch vinculado no jogo diferente da sessão: não compra', { pk: { login: 'outraconta' } }, /conta do jogo diferente/);
    ok('...e a aba avisa o motivo', /Não comprando agora: conta do jogo diferente/.test(t1), t1);
    await caso('Twitch não vinculada no jogo: não compra', { pk: { vinculado: false, login: '' } }, /não vinculada/);
    await caso('vínculo sem nome de login (não dá para conferir a conta): não compra', { pk: { login: '' } }, /conta do jogo diferente/);
    await caso('dados do jogo velhos (40 min): não compra', { pk: { em: Date.now() - 40 * 60000 } }, /antigos/);
    // só canais oficiais com bônus: canalc é oficial mas sem recompensas ativas (ativo: false); "livre" nem é oficial
    const a = await montar({ canais: ['canalc', 'livre'], mundo: { saldos: { canalc: 50000, livre: 50000 }, vivos: new Set(['canalc', 'livre']) } });
    await a.ocioso(500);
    ok('canal que não é oficial com bônus (ativo:false ou fora da lista do jogo): não compra, nem abre o painel', a.mundo.compras.length === 0 && !a.mundo.cliques.length);
    a.fim();
    // custo máximo por compra: um item acima de 10.000 nunca é comprado
    const b = await montar({ mundo: { saldos: { canala: 90000, canalb: 0 }, recompensas: RECOMPENSAS.map((r) => (r.nome === LURE ? { nome: LURE, custo: 10001 } : r)) },
      antes: (R) => { R.TIPOS[2].custo = 10001; } });
    await b.ocioso(900);
    ok('custo máximo por compra 10.000: item de 10.001 nunca é comprado (XP e Capture sim)', ordem(b.mundo).join() === `${XP}@canala,${CAP}@canala`, ordem(b.mundo).join());
    b.fim();
    // o iframe foi para outro canal (raid, redirecionamento): não compra
    const c = await montar({ antes: (R) => { R.canalDoFrame = () => 'outrocanal'; } });
    await c.ocioso(500);
    ok('iframe que não está mais no canal esperado: não compra (aviso, sem travar 15 min)', c.mundo.compras.length === 0 && !c.mundo.cliques.length && !c.resgate().estado().bloqueadoAte && /não está mais em/.test(c.resgate().estado().aviso || ''), JSON.stringify(c.resgate().estado()));
    c.fim();
    // a página da live ainda não montou o widget de pontos: não é erro (sem painel não há o que clicar)
    const d = await montar({ semPainel: true });
    await d.ocioso(1800);
    ok('live ainda sem o painel de pontos: não compra, não trava 15 min, diz o motivo', d.mundo.compras.length === 0 && !d.resgate().estado().bloqueadoAte && /ainda não apareceu/.test(d.resgate().estado().aviso || ''), JSON.stringify(d.resgate().estado()));
    d.fim();
  }

  // ---------- 11) pausar e ajuste desligado ----------
  {
    const a = await montar({ config: { resgateAuto: false } });
    await a.ocioso(500);
    const t = a.textoAbaPk();
    ok('ajuste desligado: nenhuma compra, aba diz "desligado nos Ajustes" e o botão Pausar some', a.mundo.compras.length === 0 && /desligado nos Ajustes/.test(t) && ![...a.sr().querySelectorAll('.aba-pk button')].some((b) => /^(Pausar|Retomar)$/.test(b.textContent)), t);
    a.fim();
    const b = await montar({ pk: { bonus: { xp: hora(5), captura: hora(5), shiny: hora(5) } } });
    await b.ocioso(300);
    b.textoAbaPk();
    const bt = [...b.sr().querySelectorAll('.aba-pk button')].find((x) => x.textContent === 'Pausar');
    ok('ajuste ligado: botão Pausar aparece', !!bt);
    bt.click();
    const t2 = b.textoAbaPk();
    ok('Pausar: vira Retomar, diz "pausado por você" e nada é comprado', /pausado por você/.test(t2) && [...b.sr().querySelectorAll('.aba-pk button')].some((x) => x.textContent === 'Retomar'), t2);
    b.mundo.saldos.canala = 20000;
    b.store.pokeidle.bonus = { xp: 0, captura: 0, shiny: 0 };
    b.ouvintes.forEach((f) => f({ pokeidle: { newValue: Object.assign({}, b.store.pokeidle, { em: Date.now() }) } }, 'local'));
    await b.ocioso(500);
    ok('pausado: mesmo com bônus acabando e saldo, não compra', b.mundo.compras.length === 0, ordem(b.mundo).join());
    [...b.sr().querySelectorAll('.aba-pk button')].find((x) => x.textContent === 'Retomar').click();
    const r = await b.resgate().tentar();
    ok('Retomar: volta a comprar', r.compras === 3, JSON.stringify(r));
    b.fim();
  }

  // ---------- 12) aba PokeIdle: próxima compra, saldo por canal, erro; idiomas ----------
  {
    const a = await montar({ mundo: { saldos: { canala: 1800, canalb: 900 } }, pk: { bonus: { xp: hora(0.5), captura: hora(4), shiny: hora(4) } } });
    await a.ocioso(500);
    const t = a.textoAbaPk();
    ok('aba: próxima compra (XP 10h 3.000), saldo e quanto falta por canal, bônus ativos com fim do jogo', /Próxima compra · XP \(10h\) 3\.000/.test(t) && /canala.*1\.800 \/ 3\.000/.test(t) && /faltam 1\.200 pts/.test(t) && /canalb.*900 \/ 3\.000/.test(t) && /faltam 2\.100 pts/.test(t) && /\+15% Capture Boost/.test(t), t);
    a.fim();
    for (const [idioma, esperado, proibido] of [['en', /Next purchase · XP \(10h\) 3,000/, /Próxima|bônus|Resgate|faltam/], ['es', /Próxima compra · XP \(10h\) 3\.?000/, /bônus|Resgate|faltam|você/]]) {
      const b = await montar({ idioma, mundo: { saldos: { canala: 1800, canalb: 900 }, recompensas: RECOMPENSAS.filter((r) => r.nome !== XP) }, pk: { bonus: { xp: hora(0.5), captura: hora(4), shiny: hora(4) } }, registros: [{ em: Date.now() - 3600e3, canal: 'canala', tipo: 'captura', nome: CAP, custo: 5000, ok: true }, { em: Date.now() - 600e3, canal: 'canala', tipo: 'xp', nome: XP, custo: 3000, ok: false, erro: 'x' }] });
      b.mundo.saldos.canala = 20000;
      b.store.pokeidle.em = Date.now();
      await b.ocioso(500);
      const tb = b.textoAbaPk();
      ok(`${idioma}: aba PokeIdle traduzida (bônus, resgate automático, erro, últimos resgates)`, !proibido.test(tb) && /Auto claim|Reclamo automático/.test(tb) && /Active bonuses|Bonus activos/.test(tb) && /Latest claims|Últimos reclamos/.test(tb) && /failed|falló/.test(tb), tb);
      b.fim();
    }
  }

  // ---------- 13) Kick e a aba compartilhada continuam inteiras ----------
  {
    const a = await montar({ canais: [] });
    const painel = a.w.PLATEIA.painelPokeidle({ pk: a.store.pokeidle, pkk: null, plataforma: 'kick' });
    ok('aba PokeIdle da sala da Kick: seção Twitch só com os bônus (sem botão Pausar nem compra)', /Twitch/.test(painel.textContent) && !/Pausar|Próxima compra/.test(painel.textContent), painel.textContent.replace(/\s+/g, ' ').slice(0, 200));
    a.fim();
  }

  // ---------- 14) correções da revisão independente ----------
  {
    const a = await montar({});
    await a.ocioso(700);
    ok('o registro da compra é gravado ANTES do 2º clique (como "não confirmado"), sem duplicar depois', a.mundo.noClique.length === 3 && a.mundo.noClique.every((r) => r && r.incerta === true && r.ok === false) && (a.store.twitchResgates || []).length === 3 && a.store.twitchResgates.every((r) => r.ok && !r.incerta), JSON.stringify(a.mundo.noClique.map((r) => r && [r.tipo, r.incerta])));
    a.fim();
    const b = await montar({ mundo: { semQueda: true, linhasAntigas: true } });
    await b.ocioso(900);
    const eb = (b.store.twitchResgates || [])[0] || {};
    ok('linha velha minha e linha de outra pessoa no chat NÃO confirmam a compra (só linha nova)', b.mundo.compras.length === 1 && /saldo não caiu/.test(eb.erro || '') && eb.incerta === true, JSON.stringify(eb));
    b.fim();
    const c = await montar({ mundo: { botaoDesabilitado: true } });
    await c.ocioso(600);
    const ec = (c.store.twitchResgates || [])[0] || {};
    ok('botão Resgatar desabilitado: não conta como compra (sem "não confirmado"), registra e para', /desabilitado/.test(ec.erro || '') && !ec.incerta && !c.mundo.noClique.length && c.resgate().estado().bloqueadoAte > 0, JSON.stringify(ec));
    c.fim();
    const d = await montar({ mundo: { semEspacoNoBotao: true } });
    await d.ocioso(700);
    ok('texto do botão colado ("Resgatar3.000", sem espaço) ainda é reconhecido', ordem(d.mundo).length === 3, ordem(d.mundo).join());
    d.fim();
    // o bloqueio de 15 min também vale depois de reabrir a sala / em outra sala (fica no storage)
    const e = await montar({ mundo: { recompensas: RECOMPENSAS.filter((r) => r.nome !== XP) } });
    await e.ocioso(500);
    const bl = e.store.twitchResgateBloqueio;
    ok('erro grava o bloqueio no storage (15 min)', !!bl && bl.ate > Date.now() + 14.5 * 60000 && bl.ate < Date.now() + 15.1 * 60000 && /não encontrada/.test(bl.erro), JSON.stringify(bl));
    e.fim();
    const f = await montar({ bloqueioStorage: bl });
    await f.ocioso(500);
    const rf = await f.resgate().tentar();
    ok('sala nova (ou reaberta) respeita o bloqueio gravado: não clica em nada', !f.mundo.cliques.length && f.mundo.compras.length === 0 && /parado após um erro/.test(rf.pulou || ''), JSON.stringify(rf));
    f.fim();
    // só compra em canal oficial com recompensas ativas: `lives` do formato antigo não vale
    const g = await montar({ pk: { oficiais: [{ login: 'canala', nome: 'A', bonus: false, ativo: false, aoVivo: true }, { login: 'canalb', nome: 'B', bonus: false, ativo: false, aoVivo: true }], lives: [{ login: 'canala', nome: 'A', bonus: true }] } });
    await g.ocioso(500);
    ok('canal só em `lives` (formato antigo) e sem `ativo`: não compra nem abre o painel', g.mundo.compras.length === 0 && !g.mundo.cliques.length);
    g.fim();
    // guarda: `ativo` manda sobre `bonus` quando os dois vierem
    const store = {}, pw = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://pokeidle.io/app', runScripts: 'outside-only' }).window;
    pw.postMessage = (data, origem) => setTimeout(() => pw.dispatchEvent(new pw.MessageEvent('message', { data, origin: origem, source: pw })), 0);
    pw.chrome = chromeFalso(store, []);
    pw.eval(ler('src/comum.js')); pw.eval(ler('src/pokeidle-guarda.js'));
    pw.postMessage({ plateia: 'pokeidle-twitch', tw: { vinculado: true, login: 'odreds', oficiais: [{ login: 'canalx', bonus: true, ativo: false }, { login: 'canaly', bonus: false, ativo: true }] } }, '*');
    await espera(60);
    ok('guarda: com `ativo` e `bonus` juntos, vale o `ativo`', store.pokeidle && store.pokeidle.oficiais[0].bonus === false && store.pokeidle.oficiais[1].bonus === true, JSON.stringify(store.pokeidle && store.pokeidle.oficiais));
  }

  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
