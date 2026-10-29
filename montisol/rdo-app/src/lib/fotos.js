/* Fotos do lançamento: ficam no aparelho (IndexedDB; o localStorage não comporta imagens).
   No rascunho fica só a referência: { id, legenda, momento: 'antes' | 'durante' | 'depois' }.
   Ao enviar, a legenda é gravada na própria foto (faixa embaixo), para não se perder no WhatsApp. */
import { tx as txDb } from './idb.js';
import { uid } from './texto.js';

export const MOMENTOS = [['antes', 'Antes'], ['durante', 'Durante'], ['depois', 'Depois']];
const LADO_MAX = 1600;

const tx = (modo, fn) => txDb('fotos', modo, fn);
export const lerFoto = (id) => tx('readonly', (s) => s.get(id));
export const apagarFoto = (id) => tx('readwrite', (s) => { s.delete(id); });
const idsGuardados = () => tx('readonly', (s) => s.getAllKeys());

/** Reduz a foto (lado maior 1600 px, JPEG) e guarda. Devolve a referência para o rascunho. */
export async function guardarFoto(arquivo) {
  const blob = await reduzir(arquivo);
  const id = 'f' + uid();
  await tx('readwrite', (s) => { s.put(blob, id); });
  return { id, legenda: '', momento: '' };
}

async function bitmap(blob) {
  if (self.createImageBitmap) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (_) { /* cai para <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { URL.revokeObjectURL(url); }
}
const paraBlob = (canvas, tipo = 'image/jpeg', q = 0.82) => new Promise((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error('não foi possível gerar a imagem'))), tipo, q));

async function reduzir(arquivo) {
  const img = await bitmap(arquivo);
  const k = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return paraBlob(c);
}

/** Quebra o texto em linhas que cabem na largura. */
function quebrar(ctx, texto, largura) {
  const linhas = [];
  for (const par of String(texto).split('\n')) {
    let atual = '';
    for (const p of par.split(/\s+/)) {
      const t = atual ? atual + ' ' + p : p;
      if (ctx.measureText(t).width > largura && atual) { linhas.push(atual); atual = p; } else atual = t;
    }
    linhas.push(atual);
  }
  return linhas;
}

/** Desenha uma faixa escura embaixo da imagem com a legenda (1ª linha em destaque) e devolve um JPEG. */
export async function carimbar(blob, legenda, rodape) {
  const img = await bitmap(blob);
  const W = img.width;
  const f = Math.max(18, Math.round(W / 42));
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = `bold ${f}px system-ui, sans-serif`;
  const pad = Math.round(f * 0.8);
  const linhasLeg = legenda ? quebrar(ctx, legenda, W - 2 * pad) : [];
  ctx.font = `${Math.round(f * 0.8)}px system-ui, sans-serif`;
  const linhasRod = rodape ? quebrar(ctx, rodape, W - 2 * pad) : [];
  const faixa = (linhasLeg.length * f * 1.3) + (linhasRod.length * f * 1.05) + (linhasLeg.length || linhasRod.length ? 2 * pad : 0);
  c.width = W; c.height = Math.round(img.height + faixa);
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = '#243185'; // azul marinho da Montisol
  ctx.fillRect(0, img.height, W, faixa);
  ctx.fillStyle = '#758aff';
  ctx.fillRect(0, img.height, W, Math.max(3, Math.round(f / 6)));
  ctx.textBaseline = 'top';
  let y = img.height + pad;
  ctx.font = `bold ${f}px system-ui, sans-serif`; ctx.fillStyle = '#ffffff';
  for (const l of linhasLeg) { ctx.fillText(l, pad, y); y += f * 1.3; }
  ctx.font = `${Math.round(f * 0.8)}px system-ui, sans-serif`; ctx.fillStyle = '#d9defa';
  for (const l of linhasRod) { ctx.fillText(l, pad, y); y += f * 1.05; }
  return paraBlob(c, 'image/jpeg', 0.85);
}

/** Todas as fotos referenciadas por rascunho e histórico. */
export function fotosReferenciadas(...lancamentos) {
  const ids = new Set();
  for (const d of lancamentos.flat()) {
    if (!d) continue;
    for (const a of d.anexos || []) ids.add(a.id);
    for (const eq of d.equipamentos || []) for (const a of eq.anexos || []) ids.add(a.id);
  }
  return ids;
}

/** Apaga do aparelho as fotos que nenhum lançamento usa mais. */
export async function limparFotosOrfas(usadas) {
  try {
    for (const id of await idsGuardados()) if (!usadas.has(id)) await apagarFoto(id);
  } catch (_) { /* sem IndexedDB: nada a limpar */ }
}
