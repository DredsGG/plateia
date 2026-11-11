// Checagem do manifest e dos arquivos da extensão (substitui o web-ext lint, que é validador do Firefox; regra 11).
// Uso: node checar-manifest.cjs [pasta da extensão, padrão ../instalada]
// O que confere:
//  1. manifest.json é JSON válido, Manifest V3, com nome, versão X.Y.Z e default_locale com messages.json;
//  2. o background é só `service_worker` (sem `scripts`) e o arquivo existe;
//  3. nenhum `browser_specific_settings` e nenhuma sobra do Firefox (firefox, gecko, xpi, moz-extension, about:debugging/addons)
//     em nenhum arquivo, exceto src/changelog/ (o histórico das versões antigas fica);
//  4. todo arquivo citado existe: ícones, scripts de conteúdo, service worker, páginas do guia;
//  5. permissões só as esperadas (storage, alarms), hosts e scripts de conteúdo só em https;
//  6. cada __MSG_x__ existe nos messages.json de todos os idiomas;
//  7. todo .js passa em `node --check` (sintaxe).
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const raiz = path.resolve(__dirname, process.argv[2] || '../extension');
let falhas = 0;
const ok = (n, c, extra) => { console.log((c ? 'OK     ' : 'FALHOU ') + n + (!c && extra ? '\n       ' + extra : '')); if (!c) falhas++; };
const existe = (f) => fs.existsSync(path.join(raiz, f));
let m = null;
try { m = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.json'), 'utf8')); } catch (e) { ok('manifest.json é JSON válido', false, e.message); process.exit(1); }
ok('manifest.json é JSON válido, Manifest V3, com nome e versão X.Y.Z', m.manifest_version === 3 && !!m.name && /^\d+\.\d+\.\d+$/.test(m.version), `${m.manifest_version} ${m.name} ${m.version}`);
ok('background só com service_worker (sem "scripts") e o arquivo existe', m.background && Object.keys(m.background).join() === 'service_worker' && existe(m.background.service_worker), JSON.stringify(m.background));
ok('sem browser_specific_settings', !('browser_specific_settings' in m));
const todos = [];
(function varrer(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) varrer(p); else todos.push(p); } })(raiz);
const rel = (p) => path.relative(raiz, p).replace(/\\/g, '/');
const sobras = [];
for (const p of todos) {
  if (/\.(png|jpg|ico)$/i.test(p) || rel(p).startsWith('src/changelog/')) continue;
  const linhas = fs.readFileSync(p, 'utf8').split('\n');
  linhas.forEach((l, i) => { if (/firefox|gecko|\bxpi\b|\.xpi|moz-extension|about:debugging|about:addons|typeof browser|content\.fetch|\bAMO\b/i.test(l)) sobras.push(`${rel(p)}:${i + 1}`); });
}
ok('nenhuma sobra do Firefox nos arquivos (fora de src/changelog/)', !sobras.length, sobras.slice(0, 8).join(' | '));
const citados = [...Object.values(m.icons || {}), m.background.service_worker, 'COMO-INSTALAR.html', 'guia/guia.js'];
for (const cs of m.content_scripts || []) citados.push(...(cs.js || []), ...(cs.css || []));
const faltam = [...new Set(citados)].filter((f) => !existe(f));
ok(`todos os ${new Set(citados).size} arquivos citados existem`, !faltam.length, faltam.join(', '));
const esperadas = ['alarms', 'storage'];
ok('permissões só storage e alarms', JSON.stringify((m.permissions || []).slice().sort()) === JSON.stringify(esperadas), JSON.stringify(m.permissions));
const hosts = m.host_permissions || [];
ok('hosts só https', hosts.every((h) => /^https:\/\//.test(h)), hosts.join(' '));
const matchesRuins = (m.content_scripts || []).flatMap((cs) => cs.matches).filter((x) => !/^https:\/\//.test(x));
ok('scripts de conteúdo só em páginas https (injetar não pede host_permissions)', !matchesRuins.length, matchesRuins.join(' '));
const locales = existe('_locales') ? fs.readdirSync(path.join(raiz, '_locales')) : [];
ok('default_locale tem messages.json', existe(`_locales/${m.default_locale}/messages.json`), m.default_locale);
const faltaMsg = [];
const usadas = JSON.stringify(m).match(/__MSG_(\w+)__/g) || [];
for (const l of locales) { const msgs = JSON.parse(fs.readFileSync(path.join(raiz, '_locales', l, 'messages.json'), 'utf8')); for (const u of usadas) if (!msgs[u.slice(6, -2)]) faltaMsg.push(`${l}:${u}`); }
ok(`os ${usadas.length} __MSG_*__ do manifest existem nos ${locales.length} idiomas de _locales`, !faltaMsg.length, faltaMsg.join(', '));
const ruins = [];
for (const p of todos.filter((x) => x.endsWith('.js'))) { try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); } catch (e) { ruins.push(rel(p)); } }
ok(`os ${todos.filter((x) => x.endsWith('.js')).length} arquivos .js passam em node --check`, !ruins.length, ruins.join(', '));
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO PASSOU');
process.exit(falhas ? 1 : 0);
