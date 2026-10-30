// Botão "Apoiar ♥" no Chromium de verdade, com a extensão real: prints do quadro (Brasil e outro país) em PT, EN e ES
// e print do QR de cada valor para decodificar depois (python decodifica e compara com o código).
// node e2e-apoio.mjs <pasta da extensão> <pasta de saída>
import { chromium } from 'playwright';
import os from 'os';
import path from 'path';
import fs from 'fs';
const [EXT, OUT] = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext(path.join(os.tmpdir(), 'pw-apoio-' + Date.now()), {
  channel: 'chromium', headless: true, viewport: { width: 1440, height: 860 }, locale: 'pt-BR', deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--lang=pt-BR', '--no-proxy-server'],
});
const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
const V = await sw.evaluate(() => chrome.runtime.getManifest().version);
let rede = [];
await ctx.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.protocol === 'chrome-extension:') return route.continue();
  rede.push(url.host + url.pathname);
  if (url.host === 'www.twitch.tv' || url.host === 'kick.com') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>sala</title><body style="margin:0;background:#0e0e10"></body>' });
  if (url.host === 'gql.twitch.tv') return route.fulfill({ headers: { 'access-control-allow-origin': 'https://www.twitch.tv', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*' }, json: { data: {} } });
  return route.fulfill({ status: 404, body: '' });
});
await new Promise((r) => setTimeout(r, 1200));
for (const p of ctx.pages()) if (p.url().includes('COMO-INSTALAR')) await p.close();
const resultado = { versao: V, codigos: {}, prints: [] };
for (const [idioma, sala, url] of [['pt', 'twitch', 'https://www.twitch.tv/drops/inventory#plateia'], ['en', 'kick', 'https://kick.com/drops/claimed#plateia'], ['es', 'twitch', 'https://www.twitch.tv/drops/inventory#plateia']]) {
  await sw.evaluate(([l, v]) => chrome.storage.local.set({ idioma: l, quadros: { tutorial: true, novidades: v }, atualizacao: { procuradoEm: Date.now(), atual: v, ultima: v, disponivel: false }, apoio: null, config: { canais: [], v020: true } }), [idioma, V]);
  const p = await ctx.newPage();
  await p.goto(url); await p.waitForTimeout(2500);
  const bt = p.locator('.rodape-fim .ap-botao');
  await bt.click(); await p.waitForTimeout(400);
  const qd = p.locator('.qd.ap');
  await qd.screenshot({ path: `${OUT}/apoio-${idioma}-${sala}-1-escolha.png` }); resultado.prints.push(`apoio-${idioma}-${sala}-1-escolha.png`);
  await p.locator('.ap-op[data-op="br"]').click(); await p.waitForTimeout(300);
  await qd.screenshot({ path: `${OUT}/apoio-${idioma}-${sala}-2-brasil.png` }); resultado.prints.push(`apoio-${idioma}-${sala}-2-brasil.png`);
  if (idioma === 'pt') {
    for (const v of ['R$ 5', 'R$ 10', 'R$ 25']) {
      await p.locator('.ap-v', { hasText: v }).click(); await p.waitForTimeout(150);
      const nome = v.replace(/\D/g, '');
      await p.locator('svg.ap-qr').screenshot({ path: `${OUT}/qr-${nome}.png` });
      resultado.codigos[nome] = await p.locator('.ap-pix').getAttribute('data-codigo');
    }
    await p.locator('.ap-outro').fill('12,50'); await p.waitForTimeout(150);
    await p.locator('svg.ap-qr').screenshot({ path: `${OUT}/qr-1250.png` }); resultado.codigos['1250'] = await p.locator('.ap-pix').getAttribute('data-codigo');
    await p.locator('.ap-outro').fill(''); await p.waitForTimeout(150);
    await p.locator('svg.ap-qr').screenshot({ path: `${OUT}/qr-livre.png` }); resultado.codigos.livre = await p.locator('.ap-pix').getAttribute('data-codigo');
    await p.locator('.ap-v', { hasText: 'R$ 10' }).click(); await p.waitForTimeout(150);
    await p.locator('.ap-copiar').click(); await p.waitForTimeout(200);
    resultado.copiado = await p.locator('.ap-copiado').textContent();
  }
  await p.locator('.ap-voltar').click(); await p.waitForTimeout(200);
  await p.locator('.ap-op[data-op="fora"]').click(); await p.waitForTimeout(300);
  await qd.screenshot({ path: `${OUT}/apoio-${idioma}-${sala}-3-outro-pais.png` }); resultado.prints.push(`apoio-${idioma}-${sala}-3-outro-pais.png`);
  // o rodapé com o botão
  if (idioma === 'pt') {
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    resultado.fechouNoEsc = !(await p.locator('.qd.ap').count());
    const aside = p.locator('aside'); const b = await aside.boundingBox();
    await p.screenshot({ path: `${OUT}/apoio-pt-rodape.png`, clip: { x: b.x, y: b.y + b.height - 110, width: b.width, height: 110 } });
    // reabre no mesmo lugar (outro país)
    await bt.click(); await p.waitForTimeout(300);
    resultado.reabriuNoMesmoLugar = (await p.locator('a.ap-sponsors').count()) === 1;
    const [aba] = await Promise.all([ctx.waitForEvent('page'), p.locator('a.ap-sponsors').click()]);
    await aba.waitForLoadState('domcontentloaded').catch(() => {});
    resultado.abaSponsors = aba.url();
    await aba.close();
  }
  await p.close();
}
resultado.redeDuranteOQuadro = rede.filter((u) => !/twitch\.tv|kick\.com|github\.com\/sponsors/.test(u)); resultado.abriuSponsors = rede.filter((u) => /github\.com\/sponsors/.test(u));
fs.writeFileSync(`${OUT}/resultado.json`, JSON.stringify(resultado, null, 1));
console.log(JSON.stringify(resultado, null, 1));
await ctx.close();
