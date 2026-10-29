/* Utilidades de texto e data, sem DOM. */

export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
export const normTag = (s) => norm(s).replace(/[\s_]+/g, '-');
export const slug = (s) => norm(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sem-nome';
export const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
export const cap = (s) => String(s || '').toLowerCase().replace(/(^|[\s/(.-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Ii|Iii|Iv)\b/g, (m) => m.toUpperCase());
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clone = (o) => JSON.parse(JSON.stringify(o));
/** Texto aparado; vazio para null/undefined. */
export const v = (x) => (x == null ? '' : String(x).trim());
export const hoje = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

/** Lê/escreve um caminho "a.0.b" dentro de um objeto. */
export const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
export function setPath(o, p, val) {
  const ks = p.split('.');
  let x = o;
  for (let i = 0; i < ks.length - 1; i++) x = x[ks[i]];
  x[ks[ks.length - 1]] = val;
}
