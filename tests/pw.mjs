// Lançador do Playwright para os E2E em Chromium.
// - Linux/CI: igual ao `chromium` do Playwright (abre o navegador sozinho).
// - Windows: o Node não consegue abrir o chrome.exe do Playwright (spawn UNKNOWN), mas o shell consegue. Com a variável
//   CDP=http://127.0.0.1:<porta> (o e2e-cdp.sh abre o Chrome com a extensão e define isso), `launchPersistentContext`
//   conecta nesse Chrome e devolve o contexto dele; `ctx.close()` fecha o navegador.
// Precisa do playwright: PW_DIR=<pasta que tem node_modules/playwright> (ou instalado ao lado).
import { createRequire } from 'module';
import path from 'path';
const req = createRequire(path.join(process.env.PW_DIR || process.cwd(), 'x.js'));
const pw = req('playwright');
export const chromium = process.env.CDP ? {
  launchPersistentContext: async (_pasta, opts = {}) => {
    const browser = await pw.chromium.connectOverCDP(process.env.CDP);
    const ctx = browser.contexts()[0];
    const novaPagina = ctx.newPage.bind(ctx); // o viewport pedido vale para as páginas novas (a janela do CDP é menor)
    ctx.newPage = async () => { const p = await novaPagina(); if (opts.viewport) await p.setViewportSize(opts.viewport).catch(() => {}); return p; };
    ctx.close = async () => { try { const s = await browser.newBrowserCDPSession(); await s.send('Browser.close'); } catch (e) { /* já fechou */ } };
    return ctx;
  }
} : pw.chromium;
