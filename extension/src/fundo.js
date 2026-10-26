// Plateia — service worker: procura atualização no GitHub e se recarrega quando a pasta muda.
// Mesmo modelo do Midas (regra 7, 2026-10-23):
// - Procura versão nova nos Releases do GitHub (DredsGG/plateia): ao abrir o Chrome, a cada 6 h
//   e quando alguém clica em "Procurar atualização" numa sala.
// - Chrome Web Store: "Atualizar" pede a versão nova ao Chrome e recarrega.
// - Por pasta (modo desenvolvedor): o Chrome não deixa a extensão trocar os próprios arquivos.
//   "Atualizar" baixa o zip; quando os arquivos novos chegam na pasta (zip extraído por cima, ou
//   gravados pela IA), a extensão percebe sozinha em até 1 min e se recarrega, sem ↻.
// - Depois de recarregar, as abas da Twitch e da Kick recarregam (as salas reabrem sozinhas).
const REPO = 'DredsGG/plateia';
const PROCURA_MIN = 360;
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
const atual = () => chrome.runtime.getManifest().version;
const tipoInstalacao = async () => { try { return (await chrome.management.getSelf()).installType; } catch (e) { return 'development'; } };
const salvar = async (patch) => {
  const { atualizacao = {} } = await chrome.storage.local.get('atualizacao');
  const novo = Object.assign({}, atualizacao, patch);
  await chrome.storage.local.set({ atualizacao: novo });
  return novo;
};

async function procurar() {
  const cur = atual();
  const base = { procuradoEm: Date.now(), atual: cur, instalacao: await tipoInstalacao() };
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const ultima = String(j.tag_name || '').replace(/^v/i, '');
    const zip = ((j.assets || []).find((a) => /\.zip$/i.test(a.name)) || {}).browser_download_url || null;
    return salvar(Object.assign(base, { ultima, notas: String(j.body || '').slice(0, 4000), pagina: j.html_url || null, zip, disponivel: !!ultima && cmpVer(ultima, cur) > 0, erro: null }));
  } catch (e) {
    return salvar(Object.assign(base, { erro: String((e && e.message) || e) }));
  }
}

async function aplicar() {
  const st = (await chrome.storage.local.get('atualizacao')).atualizacao || {};
  if (await tipoInstalacao() === 'normal') {
    const res = await new Promise((ok) => chrome.runtime.requestUpdateCheck((status) => ok(status)));
    if (res === 'update_available') { setTimeout(() => chrome.runtime.reload(), 1500); return { modo: 'loja', status: 'aplicando' }; }
    return { modo: 'loja', status: res };
  }
  const url = st.zip || st.pagina || `https://github.com/${REPO}/releases/latest`;
  await chrome.tabs.create({ url, active: false });
  await salvar({ baixadoEm: Date.now() });
  return { modo: 'download', status: 'baixado' };
}

// por pasta: versão nova gravada na pasta (o manifest vai por último) → recarrega em 15 s
let recargaPendente = null;
async function vigiarDisco() {
  if (await tipoInstalacao() !== 'development') return;
  try {
    const r = await fetch(chrome.runtime.getURL('manifest.json') + '?t=' + Date.now(), { cache: 'no-store' });
    const noDisco = (await r.json()).version;
    if (noDisco && noDisco !== atual() && recargaPendente !== noDisco) {
      recargaPendente = noDisco;
      setTimeout(() => chrome.runtime.reload(), 15000);
    }
  } catch (e) { /* manifest no meio da gravação: tenta no próximo minuto */ }
}

const agendar = () => {
  chrome.alarms.create('plateia-procura', { delayInMinutes: 1, periodInMinutes: PROCURA_MIN });
  chrome.alarms.create('plateia-disco', { delayInMinutes: DISCO_MIN, periodInMinutes: DISCO_MIN });
};
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'plateia-procura') procurar();
  if (a.name === 'plateia-disco') vigiarDisco();
});
chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg && msg.cmd === 'procurarAtualizacao') { procurar().then(responder); return true; }
  if (msg && msg.cmd === 'aplicarAtualizacao') { aplicar().then(responder, (e) => responder({ status: 'erro', erro: String((e && e.message) || e) })); return true; }
  if (msg && msg.cmd === 'abrirGuia') { chrome.tabs.create({ url: chrome.runtime.getURL('COMO-INSTALAR.html') + (msg.ancora || '') }).then(() => responder({ ok: true })); return true; }
  return false;
});
chrome.runtime.onStartup.addListener(() => { agendar(); procurar(); });
chrome.runtime.onInstalled.addListener(async (d) => {
  agendar();
  if (d.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('COMO-INSTALAR.html#usar') });
  if (d.reason === 'update') {
    await salvar({ acabouDeAtualizar: { de: d.previousVersion || null, para: atual(), em: Date.now() }, disponivel: false, atual: atual() });
    // as salas abertas ainda rodam a versão antiga: recarregar põe a nova (reabrem sozinhas).
    // As outras abas da Twitch/Kick ficam como estão (o baú continua sendo pego); pegam a nova ao recarregar.
    const abas = await chrome.tabs.query({ url: ['https://www.twitch.tv/drops/inventory*', 'https://kick.com/drops/claimed*'] });
    for (const t of abas) chrome.tabs.reload(t.id);
  }
  procurar();
});
