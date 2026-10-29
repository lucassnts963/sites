/* Teste no navegador do build (../rdo): node test/e2e.mjs [pasta-de-capturas]
   Serve a raiz do repositório como o GitHub Pages e percorre PPU (com mapa), extra, pesquisa e histórico.
   Começa com um registro salvo pela versão 0.1 no aparelho para garantir que o histórico antigo continua aparecendo. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const raiz = path.resolve(import.meta.dirname, '../../..');
const capturas = process.argv[2] || '';
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/sites/, '');
  if (p.endsWith('/')) p += 'index.html';
  const arq = path.join(raiz, p);
  if (!arq.startsWith(raiz) || !fs.existsSync(arq)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', tipos[path.extname(arq)] || 'application/octet-stream');
  fs.createReadStream(arq).pipe(res);
}).listen(0);
const URL_APP = `http://127.0.0.1:${srv.address().port}/sites/montisol/rdo/`;

const antigo = { id: 'legado1', modalidade: 'ppu', data: '2026-10-20', turno: 'ADM (07h30–17h24)', encarregado: 'ENCARREGADO PPU EXEMPLO', salvoEm: '2026-10-20T20:00:00Z', enviadoEm: '2026-10-20T20:00:00Z',
  equipamentos: [{ uid: 'a', tag: 'HE 41A-01A', desenho: 'resfriamento-a-vacuo--6-colmeias', aqs: 'sim', aqsRef: 'AQS-9', equipe: [{ nome: 'JATISTA UM', origem: 'equipe' }],
    hor: { dds: '07:30', lib: '', ini: '', fim: '' }, prod: { total: '894', desob: '50' }, paradas: [], ativ: { servico: 'x' }, fotos: {} }], pessoas: [] };

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) falhas++; };

const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
  // efetivo.json não fica no repositório público: o 404 dele é esperado; qualquer outro é erro.
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/dados/efetivo.json')) erros.push(r.status() + ' ' + r.url()); });
  page.on('dialog', (d) => d.accept());
  await page.evaluateOnNewDocument((r) => {
    if (!localStorage.getItem('montisol-rdo:v1:registros')) localStorage.setItem('montisol-rdo:v1:registros', JSON.stringify([r]));
    window.open = (u) => { window.__aberto = u; };
  }, antigo);
  const foto = (n) => capturas && page.screenshot({ path: path.join(capturas, n + '.png'), fullPage: false });
  const clicar = async (texto, sel = 'button') => {
    const h = await page.waitForFunction((s, t) => [...document.querySelectorAll(s)].find((b) => b.textContent.includes(t) && !b.disabled), {}, sel, texto);
    await h.asElement().click();
  };
  const texto = () => page.evaluate(() => document.body.innerText);
  const espera = (t) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: 5000 }, t).then(() => true, () => false);
  /** Define o valor como o navegador faria (o campo de hora do Chromium de teste é 12h). */
  const setValor = (el, val) => el.evaluate((e, x) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, x);
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }, val);

  await page.goto(URL_APP, { waitUntil: 'networkidle0' });
  await page.waitForSelector('select');
  ok((await texto()).includes('dados de exemplo'), 'abre com o aviso de dados de exemplo');

  // PPU
  await page.select('select', 'ENCARREGADO PPU EXEMPLO');
  await page.waitForFunction(() => document.body.innerText.includes('JATISTA DOIS'));
  ok(true, 'PPU: equipe do encarregado entra no equipamento');
  const tag = await page.$('input[list="listaTags"]');
  await tag.type('HE 41A-01A');
  ok(await page.$eval('.card.eq select', (s) => s.value) === 'resfriamento-a-vacuo--6-colmeias', 'TAG cadastrada escolhe o desenho');
  const horas = await page.$$('.card.eq input[type="time"]');
  await setValor(horas[0], '07:30'); await setValor(horas[1], '07:45');
  ok(await espera('Tempo do DDS: 15 min'), 'tempo do DDS calculado');
  await foto('1-ppu');

  await clicar('Mapear espelho');
  await page.waitForSelector('.mapa-main circle[data-id]');
  const n = await page.$$eval('.mapa-main circle[data-id]', (c) => c.length);
  ok(n === 894, `mapa abre com ${n} tubos`);
  for (const i of [0, 1, 2]) { const c = (await page.$$('.mapa-main circle[data-id]'))[i * 40]; await c.click(); }
  const pincel = await page.$eval('.brush', (b) => b.innerText);
  ok(/Desobstru.do\s*3/.test(pincel), `marcar 3 tubos como desobstruídos (${JSON.stringify(pincel)})`);
  await foto('2-mapa');
  await clicar('Fechar');
  await page.waitForFunction(() => !document.querySelector('.mapa'));
  ok((await texto()).includes('🟢 3'), 'contagem do mapa aparece no equipamento');
  await clicar('Usar números do mapa');
  ok(await page.$eval('input[type="number"]', (i) => i.value) === '894', 'produção preenchida pelo mapa');

  await clicar('Ver');
  await page.waitForSelector('dialog[open] pre.msg');
  const msg = await page.$eval('pre.msg', (p) => p.textContent);
  ok(msg.includes('🏷️ *TAG do trocador:* HE 41A-01A') && msg.includes('• Tubos desobstruídos no turno: 3') && msg.includes('• DDS – Tempo: 15 minutos'), 'mensagem do PPU montada');
  await foto('3-mensagem');
  await clicar('Fechar', 'dialog button');
  await clicar('WhatsApp', '.acoes button');
  ok(String(await page.evaluate(() => window.__aberto)).startsWith('https://wa.me/?text='), 'WhatsApp aberto com a mensagem');

  // histórico (o antigo + o novo)
  await clicar('Histórico', '.abas button');
  await page.waitForFunction(() => document.body.innerText.includes('Histórico (2)'));
  ok((await texto()).includes('20/10/2026'), 'registro da versão antiga continua no histórico');
  await foto('4-historico');

  // extra com falta
  await clicar('Lançar', '.abas button');
  await clicar('Novo');
  await page.select('select', 'ENCARREGADO EXTRA EXEMPLO');
  await page.waitForFunction(() => document.body.innerText.includes('MECANICO EXTRA UM'));
  ok((await page.$$('.pessoa')).length === 3, 'extra: equipe toda carregada');
  await page.select('.card select:nth-of-type(1)', 'ENCARREGADO EXTRA EXEMPLO');
  const turno = (await page.$$('.card select'))[1];
  await turno.select('ADM');
  await (await page.$$('.pessoa .st button[data-st="falta"]'))[0].click();
  ok(await page.$eval('.acoes .btn.wa .badge', (b) => b.textContent) === '1', 'falta sem justificativa conta como pendência');
  await page.type('.pessoa .just input', 'Atestado');
  ok(!(await page.$('.acoes .btn.wa .badge')), 'com justificativa não há pendência');
  await foto('5-extra');

  // pesquisa
  await clicar('Pesquisar', '.abas button');
  await page.type('input[type="search"]', 'jatista um');
  await page.waitForFunction(() => document.body.innerText.includes('Apontamentos neste aparelho (2)'));
  ok(true, 'pesquisa acha o colaborador e os 2 apontamentos');

  // recarregar mantém o rascunho
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('MECANICO EXTRA UM'));
  ok(await page.$eval('.pessoa .just input', (i) => i.value) === 'Atestado', 'rascunho volta depois de recarregar');

  ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
} finally {
  await browser.close();
  srv.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
