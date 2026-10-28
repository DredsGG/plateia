// Plateia — service worker: procura atualização no GitHub e se recarrega quando a pasta muda.
// Mesmo modelo do Midas (regra 7, 2026-10-23):
// - Procura versão nova nos Releases do GitHub (DredsGG/plateia): ao abrir o Chrome, a cada 6 h
//   e quando alguém clica em "Procurar atualização" numa sala.
// - Chrome Web Store: "Atualizar" pede a versão nova ao Chrome e recarrega.
// - Por pasta (modo desenvolvedor): o Chrome não deixa a extensão trocar os próprios arquivos.
//   "Atualizar" baixa o zip; quando os arquivos novos chegam na pasta (zip extraído por cima, ou
//   gravados pela IA), a extensão percebe sozinha em até 1 min e se recarrega, sem ↻.
// - Depois de recarregar, as abas da Twitch e da Kick recarregam (as salas reabrem sozinhas).
// Firefox usa `browser` (promessas); Chrome, Edge, Brave e Opera usam `chrome`.
const ext = (typeof browser !== 'undefined' && browser && browser.runtime) ? browser : chrome;
const REPO = 'DredsGG/plateia';
const ehFirefox = () => { try { return ext.runtime.getURL('').startsWith('moz-extension:'); } catch (e) { return false; } };
// sites que a Plateia precisa (no Firefox o usuário pode tirar a permissão em about:addons)
const SITES = ['https://www.twitch.tv/*', 'https://kick.com/*'];
async function conferirPermissoes(abrirGuia) {
  try {
    const ok = await ext.permissions.contains({ origins: SITES });
    await salvar({ semPermissao: !ok });
    if (!ok && abrirGuia) await ext.tabs.create({ url: ext.runtime.getURL('COMO-INSTALAR.html#permissoes') });
    return ok;
  } catch (e) { return true; }
}
const PROCURA_MIN = 30; // regra 14: a cada 30 min (mais ao abrir a página e ao voltar para a aba, no máximo 1x a cada 10 min)
const DISCO_MIN = 1;

const cmpVer = (a, b) => {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
};
const atual = () => ext.runtime.getManifest().version;
const tipoInstalacao = async () => { try { return (await ext.management.getSelf()).installType; } catch (e) { return 'development'; } };
const salvar = async (patch) => {
  const { atualizacao = {} } = await ext.storage.local.get('atualizacao');
  const novo = Object.assign({}, atualizacao, patch);
  await ext.storage.local.set({ atualizacao: novo });
  return novo;
};

// resumo do que mudou na versão nova, nos 3 idiomas, lido dos arquivos de changelog do próprio Release
// (raw.githubusercontent.com responde com CORS liberado; sem permissão nova)
function itensDaVersao(js, v) {
  const i = js.indexOf("'" + v + "'");
  if (i < 0) return [];
  let k = js.indexOf('[', i);
  if (k < 0) return [];
  const out = [];
  for (k++; k < js.length; k++) {
    const c = js[k];
    if (c === ']') break;
    if (c === "'" || c === '"') {
      let txt = '';
      for (k++; k < js.length && js[k] !== c; k++) { if (js[k] === '\\') { k++; txt += js[k]; } else txt += js[k]; }
      out.push(txt);
    }
  }
  return out.slice(0, 8);
}
async function novidadesRemotas(tag, v) {
  const out = {};
  for (const l of ['pt', 'en', 'es']) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${encodeURIComponent(tag)}/extension/src/changelog/${l}.js`, { cache: 'no-store' });
      if (r.ok) { const itens = itensDaVersao(await r.text(), v); if (itens.length) out[l] = itens; }
    } catch (e) {}
  }
  return out;
}

async function procurar() {
  const cur = atual();
  const base = { procuradoEm: Date.now(), atual: cur, instalacao: await tipoInstalacao() };
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const ultima = String(j.tag_name || '').replace(/^v/i, '');
    const zip = ((j.assets || []).find((a) => /\.zip$/i.test(a.name)) || {}).browser_download_url || null;
    const xpi = ((j.assets || []).find((a) => /\.xpi$/i.test(a.name)) || {}).browser_download_url || null;
    const disponivel = !!ultima && cmpVer(ultima, cur) > 0;
    // Release marcado pelo André com "URGENTE" no título: aviso sem X e automação pausada até atualizar
    const urgente = disponivel && /URGENT/i.test(String(j.name || '') + ' ' + String(j.tag_name || ''));
    const antes = (await ext.storage.local.get('atualizacao')).atualizacao || {};
    const novidades = !disponivel ? null
      : antes.novidadesDe === ultima && antes.novidades ? antes.novidades : await novidadesRemotas(j.tag_name, ultima);
    return salvar(Object.assign(base, { ultima, notas: String(j.body || '').slice(0, 4000), pagina: j.html_url || null, zip, xpi, navegador: ehFirefox() ? 'firefox' : 'chromium', disponivel, urgente, novidades, novidadesDe: disponivel ? ultima : null, erro: null }));
  } catch (e) {
    return salvar(Object.assign(base, { erro: String((e && e.message) || e) }));
  }
}

async function aplicar() {
  const st = (await ext.storage.local.get('atualizacao')).atualizacao || {};
  if (await tipoInstalacao() === 'normal') {
    // Chrome: {status, version}; Firefox: {status, details}; versões antigas: [status, details]
    const r = await ext.runtime.requestUpdateCheck();
    const res = Array.isArray(r) ? r[0] : (r && r.status) || r;
    if (res === 'update_available') { setTimeout(() => ext.runtime.reload(), 1500); return { modo: 'loja', status: 'aplicando' }; }
    return { modo: 'loja', status: res };
  }
  // Firefox: o .xpi assinado instala por cima (o próprio Firefox também atualiza pelo update_url).
  // Sem .xpi no Release (temporária), baixa o zip para carregar de novo.
  if (ehFirefox() && st.xpi) { await ext.tabs.create({ url: st.xpi, active: true }); await salvar({ baixadoEm: Date.now() }); return { modo: 'xpi', status: 'abrindo' }; }
  const url = st.zip || st.pagina || `https://github.com/${REPO}/releases/latest`;
  await ext.tabs.create({ url, active: false });
  await salvar({ baixadoEm: Date.now() });
  return { modo: 'download', status: 'baixado', navegador: ehFirefox() ? 'firefox' : 'chromium' };
}

// por pasta: versão nova gravada na pasta (o manifest vai por último) → recarrega em 15 s
let recargaPendente = null;
async function vigiarDisco() {
  if (await tipoInstalacao() !== 'development') return;
  try {
    const r = await fetch(ext.runtime.getURL('manifest.json') + '?t=' + Date.now(), { cache: 'no-store' });
    const noDisco = (await r.json()).version;
    if (noDisco && noDisco !== atual() && recargaPendente !== noDisco) {
      recargaPendente = noDisco;
      setTimeout(() => ext.runtime.reload(), 15000);
    }
  } catch (e) { /* manifest no meio da gravação: tenta no próximo minuto */ }
}

const agendar = () => {
  ext.alarms.create('plateia-procura', { delayInMinutes: 1, periodInMinutes: PROCURA_MIN });
  ext.alarms.create('plateia-disco', { delayInMinutes: DISCO_MIN, periodInMinutes: DISCO_MIN });
};
ext.alarms.onAlarm.addListener((a) => {
  if (a.name === 'plateia-procura') procurar();
  if (a.name === 'plateia-disco') vigiarDisco();
});
ext.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg && msg.cmd === 'procurarAtualizacao') {
    // da página (abrir/voltar para a aba): só vai ao GitHub se a última procura for mais velha que o pedido
    const limite = Number(msg.seMaisVelhoQue) || 0;
    ext.storage.local.get('atualizacao').then(({ atualizacao: st = {} }) =>
      (limite && st.procuradoEm && Date.now() - st.procuradoEm < limite && !st.erro ? st : procurar())).then(responder, () => responder(null));
    return true;
  }
  if (msg && msg.cmd === 'aplicarAtualizacao') { aplicar().then(responder, (e) => responder({ status: 'erro', erro: String((e && e.message) || e) })); return true; }
  if (msg && msg.cmd === 'abrirGuia') { ext.tabs.create({ url: ext.runtime.getURL('COMO-INSTALAR.html') + (msg.ancora || '') }).then(() => responder({ ok: true })); return true; }
  return false;
});
// abrir o navegador conta como "próxima abertura": o aviso adiado no X volta (regra 14)
ext.runtime.onStartup.addListener(async () => { agendar(); await salvar({ adiadoAte: 0 }); procurar(); conferirPermissoes(true); });
ext.runtime.onInstalled.addListener(async (d) => {
  agendar();
  if (d.reason === 'install') { await salvar({ instalacaoNova: true }); const ok = await conferirPermissoes(false); ext.tabs.create({ url: ext.runtime.getURL('COMO-INSTALAR.html' + (ok ? '#usar' : '#permissoes')) }); }
  if (d.reason === 'update') {
    await salvar({ acabouDeAtualizar: { de: d.previousVersion || null, para: atual(), em: Date.now() }, disponivel: false, urgente: false, adiadoAte: 0, atual: atual() });
    // as salas abertas ainda rodam a versão antiga: recarregar põe a nova (reabrem sozinhas).
    // As outras abas da Twitch/Kick ficam como estão (o baú continua sendo pego); pegam a nova ao recarregar.
    const abas = await ext.tabs.query({ url: ['https://www.twitch.tv/drops/inventory*', 'https://kick.com/drops/claimed*'] });
    for (const t of abas) ext.tabs.reload(t.id);
  }
  procurar();
});
