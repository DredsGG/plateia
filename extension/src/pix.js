// Plateia — dados do botão "Apoiar ♥" (regra 16) e o código Pix (BR Code estático), feitos aqui, sem internet.
// Dados: vault 02-projetos/extensoes/apoio.md (os únicos válidos). Não mudar aqui sem mudar lá.
(() => {
  const P = window.PLATEIA;
  if (!P || P.pix) return;
  const APOIO = {
    sponsors: 'https://github.com/sponsors/DredsGG',
    chave: 'fa525dad-afca-4683-845d-eee7225a53e3', // chave aleatória
    nome: 'Andre Miller Fleck',                     // sem acento, até 25
    cidade: 'Sao Paulo',                            // sem acento, até 15
    valores: [5, 10, 25],
    minimo: 1,
    maximo: 10000
  };
  // CRC16-CCITT-FALSE: polinômio 0x1021, início 0xFFFF, sem reflexão e sem XOR final
  const crc16 = (txt) => {
    let crc = 0xFFFF;
    for (let i = 0; i < txt.length; i++) {
      crc ^= txt.charCodeAt(i) << 8;
      for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  };
  const campo = (id, valor) => id + String(valor.length).padStart(2, '0') + valor;
  // valor em reais (número) ou null para valor livre (a pessoa digita no banco)
  const codigo = (valor) => {
    const conta = campo('00', 'br.gov.bcb.pix') + campo('01', APOIO.chave);
    const corpo = campo('00', '01') + campo('26', conta) + campo('52', '0000') + campo('53', '986') +
      (valor ? campo('54', Number(valor).toFixed(2)) : '') +
      campo('58', 'BR') + campo('59', APOIO.nome) + campo('60', APOIO.cidade) + campo('62', campo('05', '***')) + '6304';
    return corpo + crc16(corpo);
  };
  // "12,50", "12.50", "R$ 1.234,56" → número com 2 casas; '' → null (livre); fora de R$ 1 a R$ 10.000 → NaN
  const lerValor = (txt) => {
    let s = String(txt || '').replace(/R\$|\s/gi, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); // 1.000 = mil
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    const v = Math.round(Number(s) * 100) / 100;
    return v >= APOIO.minimo && v <= APOIO.maximo ? v : NaN;
  };
  // matriz do QR (correção de erro M) com a biblioteca local qrcode-generator (src/vendor/qrcode.js)
  const matriz = (txt) => {
    const q = qrcode(0, 'M'); // eslint-disable-line no-undef
    q.addData(txt, 'Byte');
    q.make();
    const n = q.getModuleCount();
    const linhas = [];
    for (let r = 0; r < n; r++) { const l = []; for (let c = 0; c < n; c++) l.push(q.isDark(r, c)); linhas.push(l); }
    return linhas;
  };
  P.pix = { APOIO, crc16, codigo, lerValor, matriz };
})();
