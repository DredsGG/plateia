// Botão "Apoiar ♥" (regra 16, v0.9.3): código Pix igual aos de referência (vault apoio.md), "Outro valor",
// CRC, rodapé, quadro (Brasil e outro país), copiar, voltar, escolha salva, Esc/X/fora fecham, foco preso,
// nenhuma chamada de rede, sem permissão nova, nas salas da Twitch e da Kick, em PT e EN.
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom'); // npm i jsdom
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
const manifest = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.json'), 'utf8'));
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? 'OK     ' : 'FALHOU ') + n + (!c && extra ? '\n       ' + extra : '')); if (!c) falhas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// os 4 códigos de referência do vault (02-projetos/extensoes/apoio.md); o de valor livre foi lido pelo banco do André
const REF = {
  livre: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e35204000053039865802BR5918Andre Miller Fleck6009Sao Paulo62070503***63047D61',
  5: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e352040000530398654045.005802BR5918Andre Miller Fleck6009Sao Paulo62070503***6304C8ED',
  10: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e3520400005303986540510.005802BR5918Andre Miller Fleck6009Sao Paulo62070503***6304DCD7',
  25: '00020126580014br.gov.bcb.pix0136fa525dad-afca-4683-845d-eee7225a53e3520400005303986540525.005802BR5918Andre Miller Fleck6009Sao Paulo62070503***63044036'
};

function sala(idioma, qual = 0, salvo = {}) {
  const url = qual === 0 ? 'https://www.twitch.tv/drops/inventory#plateia' : 'https://kick.com/drops/claimed#plateia';
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const store = Object.assign({ idioma, config: { canais: [], v020: true }, quadros: { tutorial: true, novidades: manifest.version } }, salvo);
  const gravacoes = [];
  w.chrome = { runtime: { getManifest: () => manifest, sendMessage: (m, cb) => { const r = Promise.resolve(null); if (cb) cb(null); return r; }, lastError: null, getURL: (x) => x },
    storage: { local: { get: async (k) => (typeof k === 'string' ? { [k]: store[k] } : {}), set: async (o) => { gravacoes.push(Object.keys(o)); Object.assign(store, o); } }, onChanged: { addListener() {} } } };
  const rede = { n: 0 };
  w.fetch = async () => { rede.n++; return { ok: true, status: 200, json: async () => ({ data: {} }), text: async () => '' }; };
  w.XMLHttpRequest = class { constructor() { rede.n++; } open() {} send() {} setRequestHeader() {} };
  w.WebSocket = class { constructor() {} send() {} close() {} };
  const copiado = [];
  Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { copiado.push(t); } } });
  for (const f of manifest.content_scripts[qual].js) w.eval(fs.readFileSync(path.join(raiz, f), 'utf8'));
  const id = qual === 0 ? 'plateia-sala' : 'plateia-sala-kick';
  const sr = () => { const host = w.document.getElementById(id) || [...w.document.querySelectorAll('[id^="plateia-sala"]')][0]; return host && host.shadowRoot; };
  return { w, store, gravacoes, rede, copiado, sr };
}
const clicar = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, composed: true }));
const tecla = (w, alvo, key, shiftKey = false) => alvo.dispatchEvent(new w.KeyboardEvent('keydown', { key, shiftKey, bubbles: true, composed: true, cancelable: true }));

(async () => {
  // ---------- 1) código Pix (sem tela) ----------
  {
    const s = sala('pt');
    await espera(50);
    const pix = s.w.PLATEIA.pix;
    ok('livre igual à referência, caractere por caractere', pix.codigo(null) === REF.livre, pix.codigo(null));
    ok('R$ 5 igual à referência', pix.codigo(5) === REF[5]);
    ok('R$ 10 igual à referência', pix.codigo(10) === REF[10]);
    ok('R$ 25 igual à referência', pix.codigo(25) === REF[25]);
    ok('CRC16-CCITT-FALSE do vetor padrão "123456789" = 29B1', pix.crc16('123456789') === '29B1');
    const c1250 = pix.codigo(pix.lerValor('12,50'));
    ok('"Outro valor" 12,50 → campo 54 05 12.50 e CRC certo', c1250.includes('540512.50') && pix.crc16(c1250.slice(0, -4)) === c1250.slice(-4) && c1250.slice(-8, -4) === '6304');
    ok('"Outro valor": aceita vírgula, ponto e milhar', pix.lerValor('7,5') === 7.5 && pix.lerValor('7.50') === 7.5 && pix.lerValor('R$ 1.234,56') === 1234.56 && pix.lerValor('1.000') === 1000);
    ok('"Outro valor": vazio = livre; fora de R$ 1 a R$ 10.000 ou texto = inválido',
      pix.lerValor('') === null && Number.isNaN(pix.lerValor('0,99')) && Number.isNaN(pix.lerValor('10000,01')) && Number.isNaN(pix.lerValor('abc')) && pix.lerValor('10.000') === 10000 && pix.lerValor('1') === 1);
    ok('dados só de apoio.md (Sponsors, chave, nome, cidade)', pix.APOIO.sponsors === 'https://github.com/sponsors/DredsGG' && pix.APOIO.chave === 'fa525dad-afca-4683-845d-eee7225a53e3' && pix.APOIO.nome === 'Andre Miller Fleck' && pix.APOIO.cidade === 'Sao Paulo');
    // 141 bytes: com L caberia na versão 7 (45 módulos), com Q/H precisaria de 10+; com M é a versão 8 = 49 módulos
    ok('QR com correção de erro M (código de R$ 10 → versão 8, 49 módulos)', pix.matriz(REF[10]).length === 49, String(pix.matriz(REF[10]).length));
  }

  // ---------- 2) rodapé e quadro em português ----------
  {
    const s = sala('pt');
    await espera(700);
    const sr = s.sr();
    const proc = [...sr.querySelectorAll('.upd-linha button')].find((b) => /Procurar atualização/.test(b.textContent));
    const bug = [...sr.querySelectorAll('.upd-linha button')].find((b) => /Relatar bug/.test(b.textContent));
    const bt = sr.querySelector('.rodape-fim .ap-botao');
    const assina = sr.querySelector('.rodape-fim .assina');
    const antes = (a, b) => !!(a && b && (a.compareDocumentPosition(b) & 4));
    ok('rodapé: "Apoiar ♥" depois de "Procurar atualização" e "Relatar bug", antes de "feito por Dreds"',
      !!bt && /^Apoiar ♥$/.test(bt.textContent.trim()) && antes(proc, bt) && antes(bug, bt) && antes(bt, assina));
    ok('não abre sozinho e não grava nada ao carregar', !sr.querySelector('.ap') && !s.gravacoes.flat().includes('apoio'));
    const redeAntes = s.rede.n;
    clicar(s.w, bt);
    await espera(50);
    const q = () => sr.querySelector('.qd.ap');
    ok('abre o quadro (diálogo) no meio da sala', !!q() && q().getAttribute('role') === 'dialog' && q().getAttribute('aria-modal') === 'true' && q().closest('.qd-fundo') && q().closest('.app'));
    const ops = [...q().querySelectorAll('.ap-op')];
    ok('passo 1 "De onde você é?" com os dois cartões, Brasil destacado em PT, os dois clicáveis',
      /De onde você é\?/.test(q().textContent) && ops.length === 2 && ops[0].classList.contains('destaque') && !ops[1].classList.contains('destaque') && ops.every((o) => !o.disabled) &&
      /Brasil/.test(ops[0].textContent) && /Pix, em reais, na hora/.test(ops[0].textContent) && /Outro país/.test(ops[1].textContent) && /Cartão, em dólar, pelo GitHub Sponsors/.test(ops[1].textContent));
    ok('linha "É opcional e não muda nada na Plateia. Obrigado por usar!"', /É opcional e não muda nada na Plateia\. Obrigado por usar!/.test(q().textContent));
    // Brasil
    clicar(s.w, ops[0]); await espera(30);
    const cod = () => (q().querySelector('.ap-pix') || {}).dataset ? q().querySelector('.ap-pix').dataset.codigo : '';
    const qr = () => q().querySelector('svg.ap-qr');
    ok('Brasil: abre com R$ 10, QR com texto alternativo "QR Code Pix de R$ 10"', cod() === REF[10] && qr() && qr().getAttribute('aria-label') === 'QR Code Pix de R$ 10' && qr().getAttribute('role') === 'img');
    ok('QR em fundo branco (borda branca)', qr().querySelector('rect').getAttribute('fill') === '#fff' && /^M\d/.test(qr().querySelector('path').getAttribute('d')));
    const vbt = (txt) => [...q().querySelectorAll('.ap-v')].find((b) => b.textContent === txt);
    clicar(s.w, vbt('R$ 5')); await espera(10);
    ok('botão R$ 5 → código de referência', cod() === REF[5] && vbt('R$ 5').getAttribute('aria-pressed') === 'true');
    clicar(s.w, vbt('R$ 25')); await espera(10);
    ok('botão R$ 25 → código de referência', cod() === REF[25]);
    const campo = q().querySelector('.ap-outro');
    campo.value = '12,50'; campo.dispatchEvent(new s.w.Event('input')); await espera(10);
    ok('Outro valor 12,50 → código com 54 05 12.50 e QR "R$ 12,50"', cod().includes('540512.50') && qr().getAttribute('aria-label') === 'QR Code Pix de R$ 12,50');
    campo.value = '0,50'; campo.dispatchEvent(new s.w.Event('input')); await espera(10);
    ok('Outro valor fora do limite: aviso e o código não muda', /de R\$ 1 a R\$ 10\.000/.test(q().querySelector('.ap-erro').textContent) && cod().includes('540512.50'));
    campo.value = ''; campo.dispatchEvent(new s.w.Event('input')); await espera(10);
    ok('Outro valor vazio → valor livre (código de referência)', cod() === REF.livre && /Valor livre/.test(q().textContent));
    clicar(s.w, q().querySelector('.ap-copiar')); await espera(30);
    ok('"Copiar código Pix" copia o código e mostra "Copiado!"', s.copiado[s.copiado.length - 1] === REF.livre && q().querySelector('.ap-copiado').textContent === 'Copiado!');
    clicar(s.w, q().querySelector('.ap-copiar-chave')); await espera(30);
    ok('chave aleatória à vista e com botão de copiar', q().querySelector('.ap-chave code').textContent === 'fa525dad-afca-4683-845d-eee7225a53e3' && s.copiado[s.copiado.length - 1] === 'fa525dad-afca-4683-845d-eee7225a53e3');
    ok('linha do banco com o nome Andre Miller Fleck', /Abra o app do seu banco, escolha Pix → Ler QR Code ou Pix Copia e Cola\. O nome que aparece é Andre Miller Fleck\./.test(q().textContent));
    // copiar sem clipboard: alternativa (execCommand)
    Object.defineProperty(s.w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('negado'); } } });
    let execOk = 0; s.w.document.execCommand = (c) => { if (c === 'copy') execOk++; return true; };
    clicar(s.w, q().querySelector('.ap-copiar')); await espera(30);
    ok('sem navigator.clipboard: copia pela alternativa', execOk === 1 && q().querySelector('.ap-copiado').textContent === 'Copiado!');
    // voltar e outro país
    clicar(s.w, q().querySelector('.ap-voltar')); await espera(30);
    ok('"← Voltar" volta para a escolha', /De onde você é\?/.test(q().textContent) && q().querySelectorAll('.ap-op').length === 2);
    clicar(s.w, q().querySelectorAll('.ap-op')[1]); await espera(30);
    const link = q().querySelector('a.ap-sponsors');
    ok('Outro país: texto e "Abrir o GitHub Sponsors" em aba nova', link && link.getAttribute('href') === 'https://github.com/sponsors/DredsGG' && link.getAttribute('target') === '_blank' && /noopener/.test(link.getAttribute('rel')) && /a partir de US\$ 1/.test(q().textContent));
    // foco preso
    const foc = [...q().querySelectorAll('button,a[href],input')];
    foc[foc.length - 1].focus();
    tecla(s.w, foc[foc.length - 1], 'Tab');
    ok('foco preso: Tab no último volta para o primeiro', sr.activeElement === foc[0], String(sr.activeElement && sr.activeElement.className));
    foc[0].focus(); tecla(s.w, foc[0], 'Tab', true);
    ok('foco preso: Shift+Tab no primeiro vai para o último', sr.activeElement === foc[foc.length - 1]);
    // fechar
    tecla(s.w, foc[0], 'Escape'); await espera(10);
    ok('Esc fecha', !sr.querySelector('.ap'));
    ok('escolha salva só a opção (nenhum dado de quem doa)', JSON.stringify(s.store.apoio) === JSON.stringify({ opcao: 'fora' }));
    clicar(s.w, bt); await espera(50);
    ok('reabre no mesmo lugar (outro país)', !!q() && !!q().querySelector('a.ap-sponsors'));
    clicar(s.w, sr.querySelector('.ap-fundo')); await espera(10);
    ok('clicar fora fecha', !sr.querySelector('.ap'));
    clicar(s.w, bt); await espera(50);
    clicar(s.w, q().querySelector('.qd-x')); await espera(10);
    ok('X fecha', !sr.querySelector('.ap'));
    ok('nenhuma chamada de rede no quadro', s.rede.n === redeAntes, `${redeAntes} → ${s.rede.n}`);
  }

  // ---------- 3) inglês: destaca "outro país"; textos traduzidos ----------
  {
    const s = sala('en');
    await espera(700);
    const sr = s.sr();
    const bt = [...sr.querySelectorAll('.rodape-fim .ap-botao')].find((b) => /^Support ♥$/.test(b.textContent.trim()));
    ok('EN: botão "Support ♥" no rodapé', !!bt);
    clicar(s.w, bt); await espera(50);
    const q = sr.querySelector('.qd.ap');
    const ops = [...q.querySelectorAll('.ap-op')];
    ok('EN: "Where are you from?", outro país destacado, Brasil clicável', /Where are you from\?/.test(q.textContent) && ops[1].classList.contains('destaque') && !ops[0].classList.contains('destaque') && !ops[0].disabled);
    clicar(s.w, ops[1]); await espera(30);
    ok('EN: texto do Sponsors e botão "Open GitHub Sponsors"', /One-time or monthly, from US\$ 1\. Card payments through GitHub, no fee for me\./.test(q.textContent) && q.querySelector('a.ap-sponsors').textContent === 'Open GitHub Sponsors');
    clicar(s.w, q.querySelector('.ap-voltar')); await espera(20);
    clicar(s.w, q.querySelectorAll('.ap-op')[0]); await espera(30);
    ok('EN: Brasil com QR "Pix QR code for R$ 10" e o mesmo código', q.querySelector('svg.ap-qr').getAttribute('aria-label') === 'Pix QR code for R$ 10' && q.querySelector('.ap-pix').dataset.codigo === REF[10]);
  }

  // ---------- 4) sala da Kick também ----------
  {
    const s = sala('es', 1);
    await espera(900);
    const sr = s.sr();
    const bt = sr && [...sr.querySelectorAll('.rodape-fim .ap-botao')].find((b) => /^Apoyar ♥$/.test(b.textContent.trim()));
    ok('Kick (ES): botão "Apoyar ♥" no rodapé', !!bt);
    if (bt) { clicar(s.w, bt); await espera(50); }
    const q = sr && sr.querySelector('.qd.ap');
    ok('Kick (ES): "¿De dónde eres?" com os dois cartões', !!q && /¿De dónde eres\?/.test(q.textContent) && q.querySelectorAll('.ap-op').length === 2);
  }

  // ---------- 5) manifest ----------
  ok('sem permissão nova (só storage e alarms) e QR local no pacote', JSON.stringify(manifest.permissions) === JSON.stringify(['storage', 'alarms']) && !manifest.optional_permissions &&
    manifest.content_scripts[0].js.includes('src/vendor/qrcode.js') && manifest.content_scripts[1].js.includes('src/pix.js') && fs.existsSync(path.join(raiz, 'src/vendor/LICENSE-qrcode-generator.txt')));
  const fonte = fs.readFileSync(path.join(raiz, 'src/pix.js'), 'utf8') + fs.readFileSync(path.join(raiz, 'src/vendor/qrcode.js'), 'utf8');
  ok('nada remoto no código do QR/Pix (sem fetch, sem script de fora)', !/fetch\(|XMLHttpRequest|<script|https?:\/\/(?!github\.com\/sponsors\/DredsGG|www\.(?:d-project|opensource|denso-wave|w3)\.|stackoverflow\.com\/questions)/.test(fonte));

  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
