/* Teste no navegador do build (../rdo): node test/e2e.mjs [pasta-de-capturas]
   Serve a raiz do repositório como o GitHub Pages e percorre PPU (com mapa), extra, pesquisa e histórico.
   Começa com um registro salvo pela versão 0.1 no aparelho para garantir que o histórico antigo continua aparecendo. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import puppeteer from 'puppeteer-core';

/** PNG 800×600 de teste (gradiente), sem depender de arquivo no repositório. */
function pngTeste(w = 800, h = 600) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const bloco = (tipo, dados) => { const t = Buffer.from(tipo); const len = Buffer.alloc(4); len.writeUInt32BE(dados.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, dados]))); return Buffer.concat([len, t, dados, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const linhas = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; linhas[o] = x % 256; linhas[o + 1] = y % 256; linhas[o + 2] = 128; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr), bloco('IDAT', zlib.deflateSync(linhas)), bloco('IEND', Buffer.alloc(0))]);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rdo-e2e-'));
const FOTO = path.join(tmp, 'foto.png');
fs.writeFileSync(FOTO, pngTeste());
const CSV = path.join(tmp, 'equipamentos.csv');
fs.writeFileSync(CSV, 'TAG;Tipo;Área;Desenho;Tubos\nHE 41A-01A;Resfriamento a vácuo;Precipitação 41;resfriamento-a-vacuo--6-colmeias;\nAP 99X-01;Aquecedor de polpa;Digestão;aquecedor-de-polpa--5-furos;\n');

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
    // Menu de compartilhar do celular simulado: guarda o que seria enviado.
    window.__shares = [];
    navigator.canShare = (d) => !!(d && d.files && d.files.length);
    navigator.share = async (d) => {
      const arquivos = await Promise.all((d.files || []).map(async (f) => ({
        nome: f.name, tipo: f.type, tam: f.size,
        conteudo: f.type.startsWith('text/') ? await f.text() : '',
        dims: f.type.startsWith('image/') ? await createImageBitmap(f).then((b) => [b.width, b.height]) : null,
        dados: f.type.startsWith('image/') ? await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(f); }) : '',
      })));
      window.__shares.push({ text: d.text || '', arquivos });
    };
  }, antigo);
  const ultimoEnvio = async (n) => {
    await page.waitForFunction((k) => window.__shares.length >= k, { timeout: 15000 }, n);
    const env = await page.evaluate((k) => window.__shares[k - 1], n);
    // com pasta de capturas, guarda as imagens que seriam enviadas
    if (capturas) for (const a of env.arquivos) if (a.dados) fs.writeFileSync(path.join(capturas, 'enviado-' + a.nome), Buffer.from(a.dados.split(',')[1], 'base64'));
    return env;
  };
  const escolherArquivo = async (botao, arquivo) => { const [ch] = await Promise.all([page.waitForFileChooser(), clicar(botao)]); await ch.accept([arquivo]); };
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

  // lista de equipamentos importada (CSV do Excel)
  await clicar('Config', '.abas button');
  await escolherArquivo('Importar lista', CSV);
  ok(await espera('2 TAG(s) na lista'), 'lista de equipamentos importada (2 TAGs, 1 nova)');
  await foto('0-config');
  await clicar('Lançar', '.abas button');
  await page.waitForSelector('select');

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
  ok(await page.$eval('.card.eq input[type="number"]', (i) => i.value) === '894', 'TAG preenche o total de tubos');

  // TAG que só existe na lista importada
  await clicar('Adicionar equipamento');
  const tags = await page.$$('input[list="listaTags"]');
  await tags[1].type('AP 99X-01');
  ok(await page.$$eval('.card.eq select', (s) => s[1].value) === 'aquecedor-de-polpa--5-furos', 'TAG importada escolhe o desenho');
  ok(await page.$$eval('.card.eq', (c) => c[1].querySelector('input[type="number"]').value) === '180', 'TAG importada preenche 180 tubos');
  ok((await page.$$eval('.card.eq', (c) => c[1].innerText)).includes('Aquecedor de polpa · Digestão'), 'tipo e área da TAG aparecem');
  await (await page.$$('.card.eq .btn.perigo[title="Remover equipamento"]'))[1].evaluate((b) => b.click());
  await page.waitForFunction(() => document.querySelectorAll('.card.eq').length === 1);

  // presença PPU: falta com onde deveria estar
  ok((await page.$$('.pessoa')).length === 4, 'PPU: lista de presença com a equipe (4)');
  await (await page.$$('.pessoa'))[2].$eval('button[data-st="falta"]', (b) => b.click());
  await page.waitForFunction(() => !document.querySelector('.card.eq .chips').innerText.includes('JATISTA DOIS'));
  ok(true, 'quem falta sai da equipe do equipamento');
  ok(await page.$eval('.pessoa input[list="tagsDoDia"]', (i) => i.value) === 'HE 41A-01A', 'onde deveria estar já vem com a TAG');
  ok((await texto()).includes('1 a completar'), 'falta sem justificativa aparece como pendência');
  await page.type('.pessoa .just input', 'Atestado');
  await foto('1-ppu');

  // fotos com legenda
  await escolherArquivo('Anexar fotos', FOTO);
  await page.waitForSelector('.foto img');
  await page.type('.foto input', 'Colmeia 2 antes da lavagem');
  await clicar('Antes', '.foto .seg button');
  await clicar('Enviar', '.foto button');
  const envFoto = await ultimoEnvio(1);
  const af = envFoto.arquivos[0];
  ok(af && af.tipo === 'image/jpeg' && af.nome.endsWith('-antes.jpg'), `foto enviada como JPEG (${af && af.nome})`);
  ok(af && af.dims[0] === 800 && af.dims[1] > 600, `legenda gravada na foto (faixa embaixo: ${af && af.dims})`);
  ok(envFoto.text.startsWith('Antes: Colmeia 2 antes da lavagem\nHE 41A-01A · '), 'legenda vai como texto no WhatsApp');
  await foto('1b-fotos');

  await clicar('Mapear espelho');
  await page.waitForSelector('.mapa-main circle[data-id]');
  const n = await page.$$eval('.mapa-main circle[data-id]', (c) => c.length);
  ok(n === 894, `mapa abre com ${n} tubos`);
  for (const i of [0, 1, 2]) { const c = (await page.$$('.mapa-main circle[data-id]'))[i * 40]; await c.click(); }
  const pincel = await page.$eval('.brush', (b) => b.innerText);
  ok(/Desobstru.do\s*3/.test(pincel), `marcar 3 tubos como desobstruídos (${JSON.stringify(pincel)})`);
  await foto('2-mapa');
  await clicar('Enviar imagem');
  const envPng = await ultimoEnvio(2);
  ok(envPng.arquivos[0].tipo === 'image/png' && envPng.arquivos[0].dims[0] === 1600, `mapa vai como imagem PNG (${envPng.arquivos[0].nome})`);
  ok(envPng.text.includes('🟢 Desobstruídos: 3 (no turno: 3)'), 'texto do mapa com as contagens');
  await clicar('Enviar arquivo');
  const envHtml = await ultimoEnvio(3);
  const ah = envHtml.arquivos[0];
  ok(ah.tipo === 'text/html' && ah.conteudo.includes('data-beacon-mapeamento="1"') && (ah.conteudo.match(/data-status="desobstruido"/g) || []).length === 3, 'mapa vai como documento com o SVG dentro');
  await clicar('Fechar');
  await page.waitForFunction(() => !document.querySelector('.mapa'));
  ok((await texto()).includes('🟢 3'), 'contagem do mapa aparece no equipamento');
  await clicar('Usar números do mapa');
  ok(await page.$eval('input[type="number"]', (i) => i.value) === '894', 'produção preenchida pelo mapa');

  await clicar('Ver');
  await page.waitForSelector('dialog[open] pre.msg');
  const msg = await page.$eval('pre.msg', (p) => p.textContent);
  ok(msg.includes('🏷️ *TAG do trocador:* HE 41A-01A') && msg.includes('• Tubos desobstruídos no turno: 3') && msg.includes('• DDS – Tempo: 15 minutos'), 'mensagem do PPU montada');
  ok(msg.includes('❌ *Faltas:* JATISTA DOIS (Atestado)') && msg.includes('Deveria estar: HE 41A-01A – Justificativa: Atestado'), 'mensagem com a falta e onde deveria estar');
  ok(msg.includes('• Antes: 1 foto(s)') && msg.includes('1. (antes) Colmeia 2 antes da lavagem'), 'mensagem com a legenda da foto');
  await foto('3-mensagem');
  await clicar('Fechar', 'dialog button');
  await clicar('📷 1', '.acoes button');
  ok((await ultimoEnvio(4)).arquivos.length === 1, 'botão de fotos envia as fotos do lançamento');
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
  ok((await texto()).includes('Anexar fotos'), 'extra também tem fotos');
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
  await page.waitForFunction(() => document.body.innerText.includes('Apontamentos neste aparelho (3)'));
  ok(true, 'pesquisa acha o colaborador e os 3 apontamentos (presença + equipamento + antigo)');

  // recarregar mantém o rascunho
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('MECANICO EXTRA UM'));
  ok(await page.$eval('.pessoa .just input', (i) => i.value) === 'Atestado', 'rascunho volta depois de recarregar');

  ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
} finally {
  await browser.close();
  srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
