// Roda todos os testes jsdom (teste-*.cjs) e soma os OK / FALHOU.
// Uso: node rodar-todos.cjs [pasta da extensão, padrão ../extension]
// Precisa do jsdom (npm i jsdom): se não estiver ao lado, use NODE_PATH=<pasta>/node_modules.
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const pasta = process.argv[2] || '../extension';
let totalOk = 0, totalFalhou = 0;
for (const f of fs.readdirSync(__dirname).filter((x) => /^teste-.*\.cjs$/.test(x)).sort()) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f), pasta], { encoding: 'utf8', timeout: 300000 });
  const saida = (r.stdout || '') + (r.stderr || '');
  const ok = (saida.match(/^OK\s/gm) || []).length;
  const falhou = (saida.match(/^FALHOU/gm) || []).length;
  totalOk += ok; totalFalhou += falhou;
  console.log(`${f.padEnd(26)} OK=${String(ok).padStart(3)} FALHOU=${falhou}${r.status ? '  (saída ' + r.status + ')' : ''}`);
  if (falhou || r.status) console.log(saida.split('\n').filter((l) => /^FALHOU|Error|^\s{7}/.test(l)).slice(0, 8).join('\n'));
}
console.log(`TOTAL OK=${totalOk} FALHOU=${totalFalhou}`);
process.exit(totalFalhou ? 1 : 0);
