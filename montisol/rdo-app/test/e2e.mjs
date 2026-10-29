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

/* Webhook do n8n simulado (outra porta = outra origem: o navegador faz o CORS de verdade).
   Confere a chave e guarda o que recebeu. Como o n8n: id novo = pendente; reenvio enquanto pendente/rejeitado atualiza
   (200 "atualizado"); reenvio depois de aprovado = 409 "ja_aprovado". */
const CHAVE = 'chave-de-teste-123';
const recebidos = [];
let foraDoAr = false; // simula a base fora do ar (503)
let forcarHttp = 0; // força uma resposta (401/403) para testar a fila
const estados = new Map(); // id -> pendente | aprovado (o "planejamento" aprova no teste)
const base = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RDO-Chave');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  let corpo = '';
  req.on('data', (c) => { corpo += c; });
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (foraDoAr) { res.statusCode = 503; return res.end(JSON.stringify({ ok: false, erro: 'fora do ar' })); }
    if (forcarHttp) { res.statusCode = forcarHttp; recebidos.push({ corpo: JSON.parse(corpo), recusado: forcarHttp }); return res.end(JSON.stringify({ ok: false, erro: 'chave inválida' })); }
    if (req.headers['x-rdo-chave'] !== CHAVE) { res.statusCode = 401; return res.end(JSON.stringify({ ok: false, erro: 'chave inválida' })); }
    const j = JSON.parse(corpo);
    recebidos.push({ corpo: j, tipo: req.headers['content-type'] });
    if (j.teste) return res.end(JSON.stringify({ ok: true, teste: true }));
    if (!estados.has(j.id)) { estados.set(j.id, 'pendente'); return res.end(JSON.stringify({ ok: true, id: j.id, status: 'pendente' })); }
    if (estados.get(j.id) === 'aprovado') {
      res.statusCode = 409;
      return res.end(JSON.stringify({ ok: false, ja_aprovado: true, status: 'aprovado', erro: 'Este lançamento já foi aprovado pelo planejamento. Procure o planejamento para fazer a alteração.' }));
    }
    res.end(JSON.stringify({ ok: true, id: j.id, status: 'pendente', atualizado: true }));
  });
}).listen(0);
const URL_BASE_TESTE = `http://127.0.0.1:${base.address().port}/webhook/montisol-rdo`;
const lancamentosNaBase = () => recebidos.filter((r) => !r.corpo.teste && !r.recusado);

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
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/dados/efetivo.json') && !r.url().startsWith(URL_BASE_TESTE)) erros.push(r.status() + ' ' + r.url()); });
  // confirmações: registra o texto; recusarProxima = true faz o "Cancelar" da próxima
  const dialogos = [];
  let recusarProxima = false;
  page.on('dialog', (d) => { dialogos.push(d.message()); if (recusarProxima) { recusarProxima = false; d.dismiss(); } else d.accept(); });
  await page.evaluateOnNewDocument((r, urlBase) => {
    if (!localStorage.getItem('montisol-rdo:v1:registros')) localStorage.setItem('montisol-rdo:v1:registros', JSON.stringify([r]));
    localStorage.setItem('montisol-rdo:v1:base:url-teste', JSON.stringify(urlBase)); // o app aponta para o webhook simulado
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
  }, antigo, URL_BASE_TESTE);
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
  const espera = (t) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: 10000 }, t).then(() => true, () => false);
  /** Define o valor como o navegador faria (o campo de hora do Chromium de teste é 12h). */
  /** Quantos lançamentos estão na fila do aparelho (IndexedDB). */
  const filaNoAparelho = () => page.evaluate(() => new Promise((ok) => {
    const q = indexedDB.open('montisol-rdo', 2);
    q.onsuccess = () => { const g = q.result.transaction('fila').objectStore('fila').getAll(); g.onsuccess = () => { ok(g.result.length); q.result.close(); }; };
  }));
  const MSG_APROVADO = 'Já aprovado pelo planejamento. Procure o planejamento para alterar.';
  const setValor = (el, val) => el.evaluate((e, x) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, x);
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }, val);

  await page.goto(URL_APP, { waitUntil: 'networkidle0' });
  await page.waitForSelector('select');
  ok((await texto()).includes('dados de exemplo'), 'abre com o aviso de dados de exemplo');

  // lista de equipamentos importada (CSV do Excel)
  await clicar('Ajustes', '.abas button');
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
  // ---- modos do mapa: abre em Mover; em Mover nenhum toque marca
  const tubos = () => page.$$('.mapa-main circle[data-id]');
  const centro = async (k) => { const b = await (await tubos())[k].boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const cores = () => page.$$eval('.mapa-main circle[data-id]', (cs) => cs.map((c) => c.getAttribute('fill')).join(','));
  const salvo = () => page.evaluate(() => localStorage.getItem('montisol-rdo:v1:mapa:HE-41A-01A:resfriamento-a-vacuo--6-colmeias'));
  const contagem = async (rot) => (await page.$$eval('.brush', (bs) => bs.map((b) => b.innerText.replace(/\s+/g, ' ')))).find((t) => t.startsWith(rot));
  const espere = (ms) => new Promise((r) => setTimeout(r, ms));
  ok(await page.$eval('[data-modo="move"]', (b) => b.getAttribute('aria-checked')) === 'true', 'mapa abre em Mover');
  ok((await page.$eval('.modo-aviso', (d) => d.textContent)).includes('Mover: toque nos tubos desativado'), 'aviso do modo: "Mover: toque nos tubos desativado"');
  const cores0 = await cores(), salvo0 = await salvo();
  for (const k of [0, 40, 80]) { const q = await centro(k); await page.touchscreen.tap(q.x, q.y); } // toque simples (touch)
  { const q = await centro(120); await page.touchscreen.tap(q.x, q.y); await page.touchscreen.tap(q.x, q.y); } // toque duplo
  { const a = await centro(200), b = await centro(260); await page.touchscreen.touchStart(a.x, a.y); for (let i = 1; i <= 8; i++) await page.touchscreen.touchMove(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8); await page.touchscreen.touchEnd(); } // arrasto (touch)
  { const a = await centro(300), b = await centro(340); await page.mouse.click(a.x, a.y); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up(); } // mouse
  let pincaOk = true;
  try { const a = await centro(400), b = await centro(440); const t1 = await page.touchscreen.touchStart(a.x, a.y); const t2 = await page.touchscreen.touchStart(b.x, b.y); await t2.move(b.x + 40, b.y + 40); await t2.end(); await t1.end(); } // pinça
  catch (_) { pincaOk = false; }
  await espere(300);
  ok(await cores() === cores0 && await salvo() === salvo0, `Mover: toque, toque duplo, arrasto (touch e mouse)${pincaOk ? ' e pinça' : ''} não mudaram nenhum tubo`);
  ok((await contagem('Desobstruído')).endsWith(' 0'), 'Mover: contagem continua 0');
  // Marcar: escolha explícita; o toque marca
  await page.$eval('[data-modo="mark"]', (b) => b.click());
  ok((await page.$eval('.modo-aviso', (d) => d.textContent)).includes('Marcar: o toque marca o tubo') && await page.$eval('[data-modo="mark"]', (b) => b.getAttribute('aria-checked')) === 'true', 'aviso do modo: "Marcar: o toque marca o tubo"');
  await clicar('⤢');
  for (const k of [0, 40, 80]) { const q = await centro(k); await page.touchscreen.tap(q.x, q.y); }
  await espere(200);
  ok((await contagem('Desobstruído')).endsWith(' 3'), 'Marcar: 3 toques marcam 3 tubos');
  if (pincaOk) {
    const k = 500, a = await centro(k), b = await centro(k + 60);
    const t1 = await page.touchscreen.touchStart(a.x, a.y); const t2 = await page.touchscreen.touchStart(b.x, b.y); await t2.end(); await t1.end();
    await espere(200);
    ok((await contagem('Desobstruído')).endsWith(' 3') && (await (await tubos())[k].evaluate((c) => c.getAttribute('fill'))) === '#fff', 'Marcar: pinça (dois dedos) não marca e desfaz a cor do primeiro dedo');
  }
  { const q = await centro(120); await page.touchscreen.tap(q.x, q.y); }
  ok((await contagem('Desobstruído')).endsWith(' 4'), 'Marcar: mais um toque marca o 4º');
  await clicar('↶');
  ok((await contagem('Desobstruído')).endsWith(' 3'), 'desfazer volta para 3');
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
  // ações em massa no mapa pedem confirmação
  const entrada = await page.$('section.mapa input[type="file"]');
  const ARQ_HTML = path.join(tmp, 'passagem-teste.html'); fs.writeFileSync(ARQ_HTML, ah.conteudo);
  const ARQ_SVG = path.join(tmp, 'espelho-tamponado.svg');
  fs.writeFileSync(ARQ_SVG, ah.conteudo.slice(ah.conteudo.indexOf('<svg'), ah.conteudo.lastIndexOf('</svg>') + 6).replace(/data-status="desobstruido"/g, 'data-status="tamponado"'));
  const coresAntes = await cores(), nd = dialogos.length;
  recusarProxima = true; await entrada.uploadFile(ARQ_HTML); await espere(500);
  ok(dialogos.length === nd + 1 && dialogos[nd].startsWith('Juntar a passagem de turno') && await cores() === coresAntes, 'importar passagem no mapa pede confirmação; Cancelar não muda nada');
  recusarProxima = true; await entrada.uploadFile(ARQ_SVG); await espere(500);
  ok(dialogos[dialogos.length - 1].startsWith('Substituir TODAS as marcações') && await cores() === coresAntes, 'importar SVG pede confirmação; Cancelar não muda nada');
  await entrada.uploadFile(ARQ_SVG); await espere(500);
  ok((await contagem('Tamponado')).endsWith(' 3') && (await contagem('Desobstruído')).endsWith(' 0'), 'confirmando, o SVG substitui as marcações');
  await clicar('↶');
  ok((await contagem('Desobstruído')).endsWith(' 3') && (await contagem('Tamponado')).endsWith(' 0') && await cores() === coresAntes, 'desfazer volta ao espelho de antes da importação');
  await clicar('Fechar');
  await page.waitForFunction(() => !document.querySelector('.mapa'));
  ok((await texto()).includes('🟢 3'), 'contagem do mapa aparece no equipamento');
  await clicar('Mapear espelho');
  await page.waitForSelector('.modo-aviso');
  ok(await page.$eval('[data-modo="move"]', (b) => b.getAttribute('aria-checked')) === 'true', 'ao sair e voltar ao mapa, volta para Mover');
  await foto('2b-mapa-mover');
  await clicar('Fechar');
  await page.waitForFunction(() => !document.querySelector('.mapa'));
  ok(await page.$eval('.prod-mapa', (d) => d.innerText.replace(/\s+/g, ' ')).then((t) => /Desobstruídos no turno 3 Acumulado 3/.test(t)), 'produção do turno vem do mapa (3 no turno, 3 acumulados)');
  // dados da manutenção: preenchidos uma vez
  const [inTotal, inObst] = await page.$$('.manut input[type="number"]');
  ok(await inTotal.evaluate((i) => i.value) === '894', 'manutenção: total de tubos já vem da TAG');
  await inObst.type('300');
  ok(await espera('de 300'), 'manutenção: escopo de 300 obstruídos aparece no acumulado');

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
  // ---- envio para a base
  await clicar('Enviar para a base', '.acoes button');
  ok(await espera('Peça a chave de envio ao planejamento'), 'sem chave: avisa para pedir ao planejamento');
  ok(lancamentosNaBase().length === 0, 'sem chave: nada foi enviado');
  await clicar('Ajustes', '.abas button');
  await page.waitForSelector('.chave input');
  await page.type('.chave input', 'chave-errada');
  await clicar('Testar envio');
  await page.waitForSelector('[data-teste="erro"]');
  ok((await page.$eval('.resultado-teste', (d) => d.textContent)).includes('HTTP 401'), 'testar envio com chave errada mostra o 401');
  await page.$eval('.chave input', (i) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ''); i.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.type('.chave input', CHAVE);
  await clicar('Salvar chave');
  ok(await espera('guardada neste aparelho') && !(await texto()).includes(CHAVE), 'chave guardada e mostrada mascarada');
  await clicar('Testar envio');
  await page.waitForSelector('[data-teste="ok"]');
  const t = recebidos[recebidos.length - 1];
  ok(JSON.stringify(t.corpo) === '{"versao":1,"teste":true}' && t.tipo === 'application/json', 'testar envio manda {"versao":1,"teste":true} e mostra o resultado');
  await foto('7-ajustes');
  await clicar('Lançar', '.abas button');
  await page.waitForSelector('.acoes');

  // sem internet: fica na fila (IndexedDB) e vai sozinho quando a conexão volta
  await page.setOfflineMode(true);
  await clicar('Enviar para a base', '.acoes button');
  ok(await espera('ficou na fila'), 'sem internet: avisa que ficou na fila');
  ok(await page.$eval('.status-base', (p) => p.textContent).then((x) => x.includes('na fila')), 'status do lançamento: na fila');
  ok(lancamentosNaBase().length === 0, 'sem internet: nada chegou na base');
  await page.setOfflineMode(false);
  await page.waitForFunction(() => /enviado em/.test(document.querySelector('.status-base').textContent), { timeout: 15000 });
  ok(lancamentosNaBase().length === 1, 'conexão voltou: enviado sozinho, uma vez');
  const env = lancamentosNaBase()[0].corpo;
  ok(/^[0-9a-f-]{36}$/.test(env.id) && env.versao === 1 && env.app_versao === '0.6.0', `corpo v1 com uuid (${env.id})`);
  const eq0 = env.lancamento.equipamentos[0];
  ok(env.lancamento.modalidade === 'ppu' && eq0.tag === 'HE 41A-01A' && eq0.servico === 'desobstrucao' && eq0.prod.desob === 3 && eq0.prod.mapeados === 300, 'equipamento com TAG, serviço e produção numérica');
  const pf = env.lancamento.pessoas.find((x) => x.nome === 'JATISTA DOIS');
  ok(pf && pf.status === 'falta' && pf.deveria === 'HE 41A-01A' && pf.just === 'Atestado' && pf.hn === null, 'falta com onde deveria estar; horas nulas');
  ok(env.lancamento.fotos.length === 1 && env.lancamento.fotos[0].legenda === 'Colmeia 2 antes da lavagem' && !JSON.stringify(env).includes('data:image'), 'fotos só com momento e legenda, sem imagem');
  ok(env.texto_whatsapp.includes('🏷️ *TAG do trocador:* HE 41A-01A'), 'texto do WhatsApp junto');
  // correção enquanto está pendente: mesmo id, o n8n atualiza e responde "atualizado"
  await setValor((await page.$$('.card input[type="time"]'))[0], '07:00');
  await clicar('Enviar para a base', '.acoes button');
  ok(await espera('Correção recebida: aguarda a aprovação do planejamento'), 'correção em pendente: avisa "Correção recebida"');
  const corr = lancamentosNaBase()[1];
  ok(lancamentosNaBase().length === 2 && corr.corpo.id === env.id && corr.corpo.lancamento.inicio === '07:00', 'correção usa o mesmo id e leva o dado corrigido');
  ok((await page.$eval('.status-base', (p) => p.textContent)).includes('correção enviada em') && await filaNoAparelho() === 0, 'correção: marcado como enviado, fora da fila');
  await foto('8-enviado');
  // depois que o planejamento aprova: 409, sai da fila e não tenta de novo
  estados.set(env.id, 'aprovado');
  await clicar('Enviar para a base', '.acoes button');
  ok(await espera(MSG_APROVADO), 'reenvio depois de aprovado: aviso "Já aprovado pelo planejamento…"');
  ok((await page.$eval('.status-base', (p) => p.textContent)).includes(MSG_APROVADO), 'reenvio depois de aprovado: a mensagem aparece no lançamento');
  ok(await filaNoAparelho() === 0, 'reenvio depois de aprovado: saiu da fila');
  const postsAposAprovar = recebidos.length;
  await page.evaluate(() => window.dispatchEvent(new Event('online'))); // um gatilho da fila não pode reenviar
  await new Promise((r) => setTimeout(r, 1500));
  ok(recebidos.length === postsAposAprovar, 'reenvio depois de aprovado: a fila não tenta de novo');
  await foto('8b-aprovado');
  await clicar('WhatsApp', '.acoes button');
  ok(String(await page.evaluate(() => window.__aberto)).startsWith('https://wa.me/?text='), 'WhatsApp aberto com a mensagem');
  ok(decodeURIComponent(await page.evaluate(() => window.__aberto)).includes('• Desobstruídos acumulados na manutenção: 3'), 'mensagem com o acumulado da manutenção');
  ok(await espera('Turno a turno (1)'), 'turno registrado no histórico da TAG ao enviar');

  // passagem de turno: ADM → Tarde (outro aparelho)
  await clicar('Passar turno');
  const envPass = await ultimoEnvio(5);
  const pass = envPass.arquivos[0];
  ok(pass.tipo === 'text/html' && pass.conteudo.includes('id="rdo-passagem"') && envPass.text.includes('Passagem de turno – HE 41A-01A'), `passagem gerada (${pass.nome})`);
  const ARQ_PASS = path.join(tmp, pass.nome);
  fs.writeFileSync(ARQ_PASS, pass.conteudo);
  {
    const ctx = await browser.createBrowserContext();
    const p2 = await ctx.newPage();
    await p2.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    p2.on('dialog', (d) => d.accept());
    p2.on('pageerror', (e) => erros.push('aparelho 2: ' + e.message));
    await p2.goto(URL_APP, { waitUntil: 'networkidle0' });
    await p2.waitForSelector('select');
    const txt2 = () => p2.evaluate(() => document.body.innerText);
    const clicar2 = async (t) => { const h = await p2.waitForFunction((x) => [...document.querySelectorAll('button')].find((b) => b.textContent.includes(x) && !b.disabled), {}, t); await h.asElement().evaluate((b) => b.click()); };
    await p2.select('select', 'ENCARREGADO PPU EXEMPLO');
    await (await p2.$('input[list="listaTags"]')).type('HE 41A-01A');
    const [ch] = await Promise.all([p2.waitForFileChooser(), clicar2('Receber passagem')]);
    await ch.accept([ARQ_PASS]);
    await p2.waitForFunction(() => document.body.innerText.includes('Passagem de ENCARREGADO PPU EXEMPLO'));
    ok(true, 'aparelho 2: passagem recebida');
    const v2 = await p2.$$eval('.manut input[type="number"]', (l) => l.map((i) => i.value));
    ok(v2[0] === '894' && v2[1] === '300', `aparelho 2: total e escopo recuperados (${v2})`);
    const prod2 = await p2.$eval('.prod-mapa', (d) => d.innerText.replace(/\s+/g, ' '));
    ok(/Desobstruídos no turno 0 Acumulado 3 de 300/.test(prod2), `aparelho 2: turno começa em 0 com 3 acumulados (${prod2})`);
    ok((await txt2()).includes('Turno a turno (1)'), 'aparelho 2: histórico traz o turno do ADM');
    await clicar2('Mapear espelho');
    await p2.waitForSelector('.mapa-main circle[data-id]');
    const verdes = await p2.$$eval('.mapa-main circle[data-id]', (cs) => cs.filter((c) => c.getAttribute('fill') === '#16876a').length);
    ok(verdes === 3, `aparelho 2: espelho abre com os 3 tubos do ADM (${verdes})`);
    await p2.$eval('[data-modo="mark"]', (b) => b.click());
    for (const k of [5, 6]) { const c = (await p2.$$('.mapa-main circle[data-id]'))[k * 40]; await c.click(); }
    await clicar2('Fechar');
    await p2.waitForFunction(() => !document.querySelector('.mapa'));
    const prod3 = await p2.$eval('.prod-mapa', (d) => d.innerText.replace(/\s+/g, ' '));
    ok(/Desobstruídos no turno 2 Acumulado 5 de 300/.test(prod3), `aparelho 2: turno da tarde conta só os 2 dele (${prod3})`);
    if (capturas) {
      await p2.$eval('.manut', (el) => { el.scrollIntoView(); window.scrollBy(0, -130); });
      await p2.screenshot({ path: path.join(capturas, '6-aparelho2.png') });
    }
    await ctx.close();
  }

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
  await (await page.$$('.pessoa .st button[data-st="falta"]'))[0].evaluate((b) => b.click());
  await page.waitForSelector('.acoes .btn.wa .badge');
  ok(await page.$eval('.acoes .btn.wa .badge', (b) => b.textContent) === '1', 'falta sem justificativa conta como pendência');
  await page.type('.pessoa .just input', 'Atestado');
  ok(!(await page.$('.acoes .btn.wa .badge')), 'com justificativa não há pendência');
  // chave recusada (403 e 401): continua na fila
  forcarHttp = 403;
  await clicar('Enviar para a base', '.acoes button');
  ok(await espera('chave recusada'), '403: avisa chave recusada');
  ok((await page.$eval('.status-base', (p) => p.textContent)).includes('na fila') && await filaNoAparelho() === 1, '403: continua na fila');
  forcarHttp = 401;
  const antes401 = recebidos.length;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForFunction(() => /HTTP 401: chave recusada/.test(document.querySelector('.status-base').textContent), { timeout: 10000 });
  ok(recebidos.length > antes401 && await filaNoAparelho() === 1, '401: a fila tentou de novo e o lançamento continua na fila');
  forcarHttp = 0;
  // base fora do ar: fica na fila com o erro; quando volta, o app reaberto envia ao abrir
  foraDoAr = true;
  await clicar('Enviar para a base', '.acoes button');
  ok(await espera('Não foi enviado: HTTP 503'), 'base fora do ar: avisa e mantém na fila');
  ok((await page.$eval('.status-base', (p) => p.textContent)).includes('na fila'), 'status: na fila com o erro');
  foraDoAr = false;
  const antesDeAbrir = lancamentosNaBase().length;
  await foto('5-extra');

  // pesquisa
  await clicar('Pesquisar', '.abas button');
  await page.type('input[type="search"]', 'jatista um');
  await page.waitForFunction(() => document.body.innerText.includes('Apontamentos neste aparelho (3)'));
  ok(true, 'pesquisa acha o colaborador e os 3 apontamentos (presença + equipamento + antigo)');

  // recarregar mantém o rascunho (e, com internet, envia o que estava na fila)
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('.status-base') && /enviado em/.test(document.querySelector('.status-base').textContent), { timeout: 15000 });
  const ext = lancamentosNaBase().slice(antesDeAbrir);
  // a fila entrega "pelo menos uma vez": se o envio for interrompido (aqui, o recarregamento), o mesmo id pode chegar de novo e a base responde duplicado
  const idsExtra = new Set(ext.map((x) => x.corpo.id));
  ok(idsExtra.size === 1 && ext[0].corpo.lancamento.modalidade === 'extra' && ext[0].corpo.lancamento.pessoas.some((x) => x.status === 'falta' && x.just === 'Atestado'),
    `ao abrir o app, a fila foi enviada: 1 lançamento extra (${ext.length} POST)`);
  await clicar('Histórico', '.abas button');
  ok(await espera('base: enviado em'), 'histórico mostra o status da base');
  ok(await espera('base: aprovado · ' + MSG_APROVADO), 'histórico marca o PPU como aprovado, com a mensagem');
  await clicar('Lançar', '.abas button');
  await page.waitForFunction(() => document.body.innerText.includes('MECANICO EXTRA UM'));
  ok(await page.$eval('.pessoa .just input', (i) => i.value) === 'Atestado', 'rascunho volta depois de recarregar');

  ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
} finally {
  await browser.close();
  srv.close();
  base.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
