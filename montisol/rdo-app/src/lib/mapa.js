/* Desenho do espelho do trocador (tubo a tubo), adaptado do kit de campo do Beacon.
   Lê um SVG (círculos = tubos, data-tube = número do tubo), conta os status e exporta o SVG com data-status em cada tubo. */
import { esc } from './texto.js';

export const DEFAULT_STATUS = [
  { value: 'desobstruido', label: 'Desobstruído', color: '#16876a' },
  { value: 'obstruido', label: 'Obstruído', color: '#d14343' },
  { value: 'tamponado', label: 'Tamponado', color: '#1b1d24' },
  { value: 'furado', label: 'Furado', color: '#ff9f1c' },
];
const AUTO = /^(ellipse|circle|c[ií]rculo|elipse|path|vector)[\s_-]*\d*$/i;
const nameOf = (el) => {
  for (const a of ['data-tube', 'data-tubo', 'data-name', 'inkscape:label', 'id']) {
    const v = el.getAttribute(a);
    if (v && !AUTO.test(v.trim())) return v.trim();
  }
  return '';
};
const raioMaisComum = (els) => {
  const radii = new Map();
  for (const c of els) { const k = Math.round(c.r.baseVal.value * 10) / 10; radii.set(k, (radii.get(k) || 0) + 1); }
  return ([...radii.entries()].sort((a, b) => b[1] - a[1])[0] || [0])[0];
};

/** Lê o texto de um SVG e devolve { sheet: {viewBox, r, deco, tubes:[[id,x,y,zona]]}, estado:{id:status}, meta }. Precisa do DOM (mede posições). */
export function parseSheet(text) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;width:1000px;height:1000px;visibility:hidden';
  host.innerHTML = text;
  document.body.appendChild(host);
  try {
    const svg = host.querySelector('svg');
    if (!svg) throw new Error('o arquivo não é um SVG');
    const vb = (svg.getAttribute('viewBox') || `0 0 ${svg.getAttribute('width') || 1000} ${svg.getAttribute('height') || 1000}`).split(/[\s,]+/).map(Number);
    const rootM = svg.getScreenCTM().inverse();
    const all = [...svg.querySelectorAll('circle')];
    // Desenhos do catálogo marcam os tubos com data-tube; se houver, só eles são tubos.
    let els = all.filter((c) => c.hasAttribute('data-tube'));
    let r;
    if (els.length) r = raioMaisComum(els);
    else {
      r = raioMaisComum(all);
      els = all.filter((c) => Math.abs(c.r.baseVal.value - r) <= Math.max(0.6, r * 0.2));
    }
    const pts = els.map((c) => {
      const p = new DOMPoint(c.cx.baseVal.value, c.cy.baseVal.value).matrixTransform(rootM.multiply(c.getScreenCTM()));
      const grp = c.closest('g[id]');
      return { x: p.x, y: p.y, name: nameOf(c), st: c.getAttribute('data-status') || '', zone: grp && grp.id !== 'Tubos' ? grp.id : '' };
    });
    const sorted = [...pts].sort((a, b) => a.y - b.y);
    let row = 0, lastY = -Infinity;
    for (const p of sorted) { if (p.y - lastY > r * 1.1) row++; p.row = row; lastY = p.y; }
    const byRow = new Map();
    for (const p of pts) { if (!byRow.has(p.row)) byRow.set(p.row, []); byRow.get(p.row).push(p); }
    const rw = String(row).length, cw = String(Math.max(...[...byRow.values()].map((l) => l.length))).length;
    const own = pts.filter((p) => p.name).length > pts.length * 0.8;
    const tubes = [], estado = {};
    for (const k of [...byRow.keys()].sort((a, b) => a - b)) {
      byRow.get(k).sort((a, b) => a.x - b.x).forEach((p, i) => {
        const id = own && p.name ? p.name : `${String(k).padStart(rw, '0')}-${String(i + 1).padStart(cw, '0')}`;
        tubes.push([id, +p.x.toFixed(2), +p.y.toFixed(2), p.zone]);
        if (p.st) estado[id] = p.st;
      });
    }
    els.forEach((c) => c.remove());
    const keep = [...svg.attributes].filter((a) => !/^(width|height|viewBox|xmlns(:.*)?|version|id|class|style|data-.*)$/i.test(a.name))
      .map((a) => `${a.name}="${a.value.replace(/"/g, '&quot;')}"`).join(' ');
    const meta = {};
    for (const a of ['trocador', 'data', 'resp', 'desenho']) { const v = svg.getAttribute('data-' + a); if (v) meta[a] = v; }
    return { sheet: { viewBox: vb, r, deco: `<g ${keep}>${svg.innerHTML}</g>`, tubes }, estado, meta };
  } finally { host.remove(); }
}

/** Conta os status de um estado {id: status}. */
export function contar(estado, sheet) {
  const c = { desobstruido: 0, obstruido: 0, tamponado: 0, furado: 0 };
  for (const v of Object.values(estado || {})) c[v] = (c[v] || 0) + 1;
  c.total = sheet ? sheet.tubes.length : 0;
  c.semRegistro = c.total - Object.keys(estado || {}).length;
  return c;
}

export function exportSvg(sheet, estado, meta, statuses) {
  const col = new Map((statuses || DEFAULT_STATUS).map((s) => [s.value, s.color]));
  const v = sheet.viewBox;
  const c = contar(estado, sheet);
  const body = sheet.tubes.map(([id, x, y]) => {
    const st = estado[id] || '';
    return `<circle cx="${x}" cy="${y}" r="${sheet.r}" data-tube="${esc(id)}"${st ? ` data-status="${st}"` : ''} fill="${st ? col.get(st) : '#ffffff'}" stroke="${st ? '#00000059' : '#5d6275'}" stroke-width="${+(sheet.r * 0.28).toFixed(2)}"/>`;
  }).join('\n');
  const m = meta || {};
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${v[2]}" height="${v[3]}" viewBox="${v.join(' ')}" data-beacon-mapeamento="1"` +
    ` data-trocador="${esc(m.trocador)}" data-data="${esc(m.data)}" data-resp="${esc(m.resp)}" data-desenho="${esc(m.desenho)}"` +
    ` data-desobstruidos="${c.desobstruido}" data-obstruidos="${c.obstruido}" data-tamponados="${c.tamponado}" data-furados="${c.furado}"` +
    ` data-desobstruidos-turno="${esc(m.desobstruidosTurno)}">\n${sheet.deco}\n<g id="Tubos">\n${body}\n</g>\n</svg>\n`;
}
