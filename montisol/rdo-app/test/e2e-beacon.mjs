/* Teste no navegador do alvo interno do BeaconOS (../rdo-beacon): node test/e2e-beacon.mjs [pasta-de-capturas]
   Serve a pasta gerada como mini app e roda três cenários, todos em 360 px:
   A) sandbox (CSP "sandbox allow-scripts allow-forms allow-modals allow-popups"): origem "null", o navegador bloqueia
      localStorage e IndexedDB -> o app usa memória e avisa; área de transferência e janela do WhatsApp bloqueadas;
   B) sandbox com o localStorage que o BeaconOS oferece (simulado: persiste entre recarregamentos, cota de 5 MB);
   C) página comum sem IndexedDB (window.indexedDB removido).
   Webhook do n8n simulado em outra porta (CORS, chave, pendente/atualizado/409, 401/403, fora do ar). */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PASTA = path.resolve(import.meta.dirname, '../../rdo-beacon');
const capturas = process.argv[2] || '';
const CSP = 'sandbox allow-scripts allow-forms allow-modals allow-popups';
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const pedidos = [];
const app = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  pedidos.push({ url: u.pathname, origem: req.headers.origin || '' });
  const m = /^\/(sandbox|normal)\/(.*)$/.exec(decodeURIComponent(u.pathname));
  if (!m) { res.statusCode = 404; return res.end(); }
  const arq = path.join(PASTA, m[2] || 'index.html');
  if (!arq.startsWith(PASTA) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.statusCode = 404; return res.end(); }
  if (m[1] === 'sandbox') res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Content-Type', tipos[path.extname(arq)] || 'application/octet-stream');
  fs.createReadStream(arq).pipe(res);
}).listen(0);
const BASE_APP = `http://127.0.0.1:${app.address().port}`;

// ---- webhook simulado
const CHAVE = 'chave-de-teste-123';
const recebidos = [];
let foraDoAr = false, forcarHttp = 0;
const estados = new Map();
const base = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-RDO-Chave');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  let corpo = '';
  req.on('data', (c) => { corpo += c; });
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    const j = JSON.parse(corpo || '{}');
    const reg = { corpo: j, origem: req.headers.origin || '' };
    if (foraDoAr) { res.statusCode = 503; return res.end('{"ok":false,"erro":"fora do ar"}'); }
    if (forcarHttp || req.headers['x-rdo-chave'] !== CHAVE) { res.statusCode = forcarHttp || 401; recebidos.push({ ...reg, recusado: res.statusCode }); return res.end('{"ok":false,"erro":"chave inválida"}'); }
    recebidos.push(reg);
    if (j.teste) return res.end('{"ok":true,"teste":true}');
    if (!estados.has(j.id)) { estados.set(j.id, 'pendente'); return res.end(JSON.stringify({ ok: true, id: j.id, status: 'pendente' })); }
    if (estados.get(j.id) === 'aprovado') { res.statusCode = 409; return res.end(JSON.stringify({ ok: false, ja_aprovado: true, status: 'aprovado', erro: 'Este lançamento já foi aprovado pelo planejamento. Procure o planejamento para fazer a alteração.' })); }
    res.end(JSON.stringify({ ok: true, id: j.id, status: 'pendente', atualizado: true }));
  });
}).listen(0);
const URL_BASE_TESTE = `http://127.0.0.1:${base.address().port}/webhook/montisol-rdo`;
const lancs = () => recebidos.filter((r) => !r.corpo.teste && !r.recusado);

let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? '✔ ' : '✘ ') + msg); if (!cond) falhas++; };
const espere = (ms) => new Promise((r) => setTimeout(r, ms));
const MSG_APROVADO = 'Já aprovado pelo planejamento. Procure o planejamento para alterar.';

/* Substituto do localStorage do BeaconOS para a origem "null": Map em memória, gravações espelhadas no Node
   (para sobreviver ao recarregamento) e cota de 5 MB (QuotaExceededError). */
function shimLocalStorage(snapshot, limite) {
  const m = new Map(Object.entries(snapshot || {}));
  const tam = () => { let b = 0; for (const [k, v] of m) b += (k.length + v.length) * 2; return b; };
  const ls = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      v = String(v);
      const antes = m.has(k) ? (k.length + m.get(k).length) * 2 : 0;
      if (tam() - antes + (k.length + v.length) * 2 > limite) throw new DOMException('cota', 'QuotaExceededError');
      m.set(k, v); window.__lsGravar(k, v);
    },
    removeItem: (k) => { m.delete(k); window.__lsGravar(k, null); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
    clear: () => { for (const k of [...m.keys()]) ls.removeItem(k); },
  };
  Object.defineProperty(window, 'localStorage', { configurable: true, get: () => ls });
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM || '/usr/bin/chromium', args: ['--no-sandbox'] });
const erros = [];
const paraOReal = []; // pedidos que tentaram ir ao webhook real (bloqueados)

/** Abre um "aparelho" (contexto isolado) com as opções do cenário e devolve os ajudantes. */
async function aparelho(nome, { prefixo, shim = null, semIDB = false, areaBloqueada = false, popupBloqueado = false }) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 360, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => erros.push(`${nome}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(`${nome}: ${m.text()}`); });
  page.on('requestfailed', (r) => { if (!r.url().startsWith(URL_BASE_TESTE) && !/n8n\.elucas\.dev/.test(r.url())) erros.push(`${nome}: falhou ${r.url()} ${r.failure() && r.failure().errorText}`); });
  const dialogos = [];
  page.on('dialog', (d) => { dialogos.push(d.message()); d.accept(); });
  // segurança: nada dos testes pode chegar ao webhook real
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (/n8n\.elucas\.dev/.test(r.url())) { paraOReal.push(`${nome}: ${r.method()} ${r.url()}`); return r.abort(); }
    r.continue();
  });
  // com o localStorage do BeaconOS simulado, a URL de teste já vem guardada nele (o substituto é registrado de novo a cada abertura)
  const lsNode = shim ? { ...(shim.snapshot || {}), 'montisol-rdo:v1:base:url-teste': JSON.stringify(URL_BASE_TESTE) } : null;
  if (shim) await page.exposeFunction('__lsGravar', (k, v) => { if (v == null) delete lsNode[k]; else lsNode[k] = v; });
  let idShim = null;
  const prepararShim = async () => {
    if (!shim) return;
    if (idShim) await page.removeScriptToEvaluateOnNewDocument(idShim);
    idShim = (await page.evaluateOnNewDocument(shimLocalStorage, lsNode, shim.limite || 5 * 1024 * 1024)).identifier;
  };
  await prepararShim();
  await page.evaluateOnNewDocument((url, semIDB, areaBloqueada, popupBloqueado) => {
    // o app aponta para o webhook simulado (só nos testes); onde não houver armazenamento, fica na memória
    try { localStorage.setItem('montisol-rdo:v1:base:url-teste', JSON.stringify(url)); } catch (_) { window.__semArmazenamento = true; }
    window.__urlTeste = url;
    if (semIDB) Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined });
    window.__copiado = null;
    if (areaBloqueada) {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new DOMException('bloqueado', 'NotAllowedError')) }) });
      document.execCommand = () => false;
    } else {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => ({ writeText: (t) => { window.__copiado = t; return Promise.resolve(); } }) });
    }
    window.__aberto = null;
    window.open = (u) => { window.__aberto = u; return popupBloqueado ? null : {}; };
  }, URL_BASE_TESTE, semIDB, areaBloqueada, popupBloqueado);

  const h = {
    page, dialogos, lsNode, ctx,
    texto: () => page.evaluate(() => document.body.innerText),
    espera: (t, ms = 10000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms }, t).then(() => true, () => false),
    clicar: async (t, sel = 'button') => {
      const e = await page.waitForFunction((s, x) => [...document.querySelectorAll(s)].find((b) => b.textContent.includes(x) && !b.disabled), { timeout: 10000 }, sel, t);
      await e.asElement().evaluate((b) => b.click());
    },
    setValor: (el, val) => el.evaluate((e, x) => {
      const proto = e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, x); e.dispatchEvent(new Event('input', { bubbles: true }));
    }, val),
    abrir: async () => { await prepararShim(); await page.goto(`${BASE_APP}/${prefixo}/index.html`, { waitUntil: 'networkidle0' }); await page.waitForSelector('nav.abas'); },
    recarregar: async () => { await prepararShim(); await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('nav.abas'); },
    /** Nada pode passar de 360 px: devolve a largura do documento e quem estoura. */
    largura: () => page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      const fora = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.right > w + 1 && getComputedStyle(el).position !== 'fixed'; })
        .slice(0, 3).map((el) => el.tagName + '.' + el.className + ' ' + Math.round(el.getBoundingClientRect().right));
      return { scroll: document.documentElement.scrollWidth, w, fora };
    }),
    foto: (n) => capturas && page.screenshot({ path: path.join(capturas, `beacon-${n}.png`) }),
  };
  /** A chave e o endereço de teste digitados em Ajustes (como o encarregado faz). */
  h.guardarChave = async () => {
    await h.clicar('Ajustes', '.abas button');
    await page.waitForSelector('.chave input');
    await page.type('.chave input', CHAVE);
    await h.clicar('Salvar chave');
    await h.espera('guardada neste aparelho');
  };
  /** Lançamento PPU mínimo e válido com a TAG do catálogo. */
  h.lancarPPU = async () => {
    await h.clicar('Lançar', '.abas button');
    await page.waitForSelector('select');
    await page.select('select', 'ENCARREGADO PPU EXEMPLO');
    await page.waitForFunction(() => document.body.innerText.includes('JATISTA DOIS'));
    const tag = await page.$('input[list="listaTags"]');
    await tag.type('HE 41A-01A');
    const horas = await page.$$('.card.eq input[type="time"]');
    await h.setValor(horas[0], '07:30'); await h.setValor(horas[1], '07:45');
  };
  return h;
}

/** Checa largura em 360 px na tela atual. */
async function checarLargura(h, onde) {
  const l = await h.largura();
  ok(l.scroll <= 360 && !l.fora.length, `360 px sem rolagem lateral: ${onde} (largura ${l.scroll}${l.fora.length ? ' · estoura: ' + l.fora.join(', ') : ''})`);
}

try {
  // ======================================================== A) sandbox sem armazenamento
  console.log('— A) sandbox (origem null), sem armazenamento, área de transferência e janela bloqueadas');
  const A = await aparelho('A', { prefixo: 'sandbox', areaBloqueada: true, popupBloqueado: true });
  await A.abrir();
  ok(await A.page.evaluate(() => self.origin) === 'null', 'abre isolado: origem "null"');
  ok(await A.page.evaluate(() => window.__semArmazenamento === true), 'no sandbox o navegador bloqueia o localStorage');
  ok(await A.espera('Armazenamento do aparelho bloqueado'), 'aviso claro: armazenamento bloqueado, dados só na memória');
  ok(await A.page.evaluate(() => document.fonts.check('16px "Exo 2"') && document.fonts.check('16px Montserrat')), 'fontes da marca carregadas (embutidas no CSS)');
  ok(await A.page.$eval('header .logo', (i) => i.complete && i.naturalWidth > 0), 'logo carregado de marca/ (caminho relativo)');
  await checarLargura(A, 'Lançar');
  ok(await A.page.evaluate(() => {
    const logo = document.querySelector('header .logo').getBoundingClientRect();
    return [...document.querySelectorAll('header .chip-topo, header .aviso-dados')].filter((e) => e.offsetParent).every((e) => e.getBoundingClientRect().left >= logo.right);
  }), 'cabeçalho em 360 px: nada por cima do logo');
  await A.lancarPPU();
  ok(await A.page.$eval('.card.eq select', (s) => s.value) === 'resfriamento-a-vacuo--6-colmeias', 'TAG do catálogo embutido escolhe o desenho');
  await A.clicar('Mapear espelho');
  await A.page.waitForSelector('.mapa-main circle[data-id]');
  ok(await A.page.$$eval('.mapa-main circle[data-id]', (c) => c.length) === 894, 'espelho embutido abre com 894 tubos');
  ok(await A.page.$eval('[data-modo="move"]', (b) => b.getAttribute('aria-checked')) === 'true', 'mapa abre em Mover');
  await checarLargura(A, 'mapa');
  await A.page.$eval('[data-modo="mark"]', (b) => b.click());
  for (const k of [0, 40, 80]) { const b = await (await A.page.$$('.mapa-main circle[data-id]'))[k].boundingBox(); await A.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
  await espere(200);
  await A.clicar('Fechar');
  await A.page.waitForFunction(() => !document.querySelector('.mapa'));
  ok(await A.page.$eval('.prod-mapa', (d) => d.innerText.replace(/\s+/g, ' ')).then((t) => /Desobstruídos no turno 3 Acumulado 3/.test(t)), 'produção do turno vem do mapa (3)');
  // fotos: só legenda
  ok(await A.espera('Registrar foto (legenda)'), 'fotos: registrar só momento e legenda (imagens não ficam no aparelho)');
  await A.clicar('Registrar foto (legenda)');
  await A.page.type('.foto input', 'Colmeia 2 antes');
  await A.clicar('Antes', '.foto .seg button');
  ok(!(await A.page.$('.foto img')) && !(await A.page.$('.foto .btn.wa')), 'foto sem imagem e sem botão de enviar imagem');
  // WhatsApp bloqueado e área de transferência bloqueada: mostra o texto para copiar à mão
  await A.clicar('WhatsApp', '.acoes button');
  ok(await A.espera('Não deu para abrir o WhatsApp nem copiar'), 'WhatsApp bloqueado e sem copiar: avisa');
  ok(await A.page.waitForSelector('dialog[open] pre.msg').then(() => true, () => false), 'mostra a mensagem para copiar à mão');
  const msgA = await A.page.$eval('pre.msg', (p) => p.textContent);
  ok(msgA.includes('🏷️ *TAG do trocador:* HE 41A-01A') && msgA.includes('(antes) Colmeia 2 antes'), 'mensagem do WhatsApp com TAG e legenda da foto');
  await A.clicar('Fechar', 'dialog button');
  // passagem: sem compartilhar arquivo -> janela de opções -> copiar falha -> código à mostra
  await A.clicar('Passar turno');
  ok(await A.page.waitForSelector('dialog.oferta[open]').then(() => true, () => false), 'passar turno: sem compartilhar arquivo, abre as opções');
  await A.foto('oferta');
  await A.clicar('Copiar passagem (texto para o WhatsApp)');
  await A.page.waitForSelector('textarea.copiar-manual');
  const codigoA = await A.page.$eval('textarea.copiar-manual', (t) => t.value);
  ok(/RDOP1:[A-Za-z0-9+/=]{100,}/.test(codigoA), `código da passagem à mostra para copiar à mão (${codigoA.length} caracteres)`);
  await checarLargura(A, 'janela de opções');
  await A.clicar('Fechar', 'dialog.oferta button');
  // Ajustes na origem null (sem armazenamento a URL de teste não fica guardada: o envio é testado no cenário B)
  await A.clicar('Ajustes', '.abas button');
  await A.page.waitForSelector('.chave input');
  await checarLargura(A, 'Ajustes');
  await A.page.type('.chave input', CHAVE);
  await A.clicar('Salvar chave');
  await A.clicar('Lançar', '.abas button');
  await A.foto('lancar');
  A.ctx.close().catch(() => {});

  // ======================================================== B) sandbox com o localStorage do BeaconOS
  console.log('— B) sandbox (origem null) com o localStorage do BeaconOS (simulado), cota de 5 MB');
  const B = await aparelho('B', { prefixo: 'sandbox', shim: { snapshot: {}, limite: 5 * 1024 * 1024 }, semIDB: true });
  await B.abrir();
  ok(await B.page.evaluate(() => self.origin) === 'null' && !(await B.texto()).includes('bloqueado'), 'origem "null" com localStorage: sem aviso de bloqueio');
  await B.guardarChave();
  await B.clicar('Testar envio');
  await B.page.waitForSelector('[data-teste="ok"]');
  const t = recebidos[recebidos.length - 1];
  ok(t.corpo.teste === true && t.origem === 'null', `testar envio a partir da origem "null" (Origin: ${t.origem})`);
  await B.lancarPPU();
  // sem internet -> fila no localStorage (sem IndexedDB)
  await B.page.setOfflineMode(true);
  await B.clicar('Enviar para a base', '.acoes button');
  ok(await B.espera('ficou na fila'), 'sem internet: fica na fila');
  const filaB = B.lsNode['montisol-rdo:v1:fila'];
  ok(!!filaB && B.page && lancs().length === 0, 'fila guardada no localStorage (sem IndexedDB)');
  ok(Object.values(B.lsNode).some((v) => v.startsWith('\u0001z')), 'valores grandes gravados comprimidos (LZ)');
  // reabrir com internet: a fila vai ao abrir
  await B.page.setOfflineMode(false);
  await B.recarregar();
  await B.page.waitForFunction(() => document.querySelector('.status-base') && /enviado em/.test(document.querySelector('.status-base').textContent), { timeout: 15000 }).catch(() => {});
  // entrega "pelo menos uma vez": a volta da conexão e a reabertura podem mandar o mesmo id duas vezes (o n8n deduplica pelo id)
  ok(new Set(lancs().map((r) => r.corpo.id)).size === 1 && lancs().every((r) => r.origem === 'null'), `ao reabrir, a fila do localStorage foi enviada: 1 lançamento (${lancs().length} POST, Origin: null)`);
  const env = lancs()[0].corpo;
  ok(env.app_versao === '0.7.0-beacon', `app_versao identifica o app interno (${env.app_versao})`);
  ok(env.versao === 1 && /^[0-9a-f-]{36}$/.test(env.id) && env.lancamento.equipamentos[0].tag === 'HE 41A-01A' && env.texto_whatsapp.includes('HE 41A-01A'), 'corpo v1 com uuid, TAG e texto do WhatsApp');
  // correção, aprovado, chave recusada
  await B.clicar('Enviar para a base', '.acoes button');
  ok(await B.espera('Correção recebida: aguarda a aprovação do planejamento'), 'reenvio em pendente: correção recebida');
  estados.set(env.id, 'aprovado');
  await B.clicar('Enviar para a base', '.acoes button');
  ok(await B.espera(MSG_APROVADO), 'reenvio depois de aprovado: 409 e a mensagem');
  ok((B.lsNode['montisol-rdo:v1:fila'] || '').length < 10 || JSON.parse(B.lsNode['montisol-rdo:v1:fila']).length === 0, 'depois do 409 a fila fica vazia');
  forcarHttp = 403;
  await B.clicar('Novo');
  await B.lancarPPU();
  await B.clicar('Enviar para a base', '.acoes button');
  ok(await B.espera('chave recusada'), '403: chave recusada, continua na fila');
  forcarHttp = 0;
  // receber passagem colando o código do aparelho A
  await B.clicar('Colar passagem');
  await B.setValor(await B.page.$('.colar-passagem textarea'), '🔁 Passagem de turno …\n\n' + codigoA);
  await B.clicar('Juntar passagem');
  ok(await B.espera('Passagem de ENCARREGADO PPU EXEMPLO'), 'passagem colada (código do aparelho A) recebida');
  ok(await B.page.$eval('.prod-mapa', (d) => d.innerText.replace(/\s+/g, ' ')).then((x) => /Acumulado 3/.test(x)), 'espelho juntado: 3 tubos do aparelho A');
  ok(B.dialogos.some((d) => d.startsWith('Juntar a passagem de turno')), 'juntar passagem pede confirmação');
  // passar turno com área de transferência funcionando: copia o código
  await B.clicar('Copiar passagem');
  ok(await B.page.evaluate(() => (window.__copiado || '').includes('RDOP1:')), 'copiar passagem: código vai para a área de transferência');
  // WhatsApp: janela abre
  await B.clicar('Ver', '.acoes button');
  await B.page.waitForSelector('dialog[open] pre.msg');
  await B.clicar('WhatsApp', 'dialog button');
  ok(String(await B.page.evaluate(() => window.__aberto)).startsWith('https://wa.me/?text='), 'WhatsApp abre com o texto quando a janela é permitida');
  await B.clicar('Fechar', 'dialog button').catch(() => {});
  // localStorage perto do limite e cheio
  B.lsNode['outro-app'] = 'x'.repeat(Math.round(4.2 * 1024 * 1024 / 2));
  await B.recarregar();
  ok(await B.espera('Armazenamento quase cheio'), 'perto de 5 MB: aviso de armazenamento quase cheio');
  await B.foto('quase-cheio');
  // enche até sobrar ~300 bytes na cota de 5 MB e salva um lançamento NOVO (o histórico precisa crescer)
  delete B.lsNode['outro-app'];
  const usado = Object.entries(B.lsNode).reduce((b, [k, v]) => b + (k.length + v.length) * 2, 0);
  B.lsNode['outro-app'] = 'x'.repeat(Math.floor((5 * 1024 * 1024 - usado - 300) / 2) - 'outro-app'.length);
  await B.recarregar();
  await B.clicar('Novo');
  await B.lancarPPU();
  const regsAntes = B.lsNode['montisol-rdo:v1:registros'];
  await B.clicar('Salvar', '.acoes button');
  await espere(300);
  ok(await B.page.$eval('#toast', (t) => t.textContent) === 'Sem espaço no aparelho para salvar.' && B.lsNode['montisol-rdo:v1:registros'] === regsAntes,
    'cheio: avisa "Sem espaço no aparelho para salvar." e não corrompe o histórico');
  await checarLargura(B, 'Lançar com aviso de espaço');
  B.ctx.close().catch(() => {});

  // ======================================================== C) página comum sem IndexedDB
  console.log('— C) página comum sem IndexedDB');
  const C = await aparelho('C', { prefixo: 'normal', semIDB: true });
  await C.abrir();
  ok(await C.page.evaluate(() => typeof indexedDB === 'undefined') && !(await C.texto()).includes('bloqueado'), 'sem IndexedDB e com localStorage: abre sem aviso');
  await C.guardarChave();
  await C.lancarPPU();
  const antes = lancs().length;
  await C.page.setOfflineMode(true);
  await C.clicar('Enviar para a base', '.acoes button');
  ok(await C.espera('ficou na fila'), 'sem internet: na fila');
  await C.page.setOfflineMode(false);
  await C.page.waitForFunction(() => /enviado em/.test(document.querySelector('.status-base').textContent), { timeout: 15000 }).catch(() => {});
  ok(lancs().length === antes + 1, 'conexão voltou: enviado da fila no localStorage');
  C.ctx.close().catch(() => {});

  // ======================================================== geral
  const fora = pedidos.filter((p) => !/^\/(sandbox|normal)\//.test(p.url));
  ok(!fora.length, 'nenhum pedido fora da pasta do app' + (fora.length ? ': ' + fora.map((p) => p.url).join(', ') : ''));
  const recursos = [...new Set(pedidos.map((p) => p.url.replace(/^\/(sandbox|normal)\//, '')))].sort();
  ok(recursos.every((r) => /^(index\.html|app\.js|app\.css|marca\/)/.test(r)), `só arquivos da pasta: ${recursos.join(', ')}`);
  ok(!paraOReal.filter((x) => !x.endsWith('OPTIONS')).length, 'nenhum pedido dos testes chegou ao webhook real' + (paraOReal.length ? ': ' + paraOReal.join(', ') : ''));
  ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
} finally {
  await browser.close();
  app.close(); base.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
