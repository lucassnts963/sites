/* Lista de equipamentos (TAGs): a do site (dados/trocadores.json) somada à importada no aparelho.
   Importa JSON (mesmo formato de trocadores.json) ou CSV/planilha: tag; tipo; area; desenho; tubos (cabeçalho obrigatório). */
import { norm, normTag } from './texto.js';

export const MODELO_CSV = 'tag;tipo;area;desenho;tubos\nHE 41A-01A;Resfriamento a vácuo;Precipitação 41;resfriamento-a-vacuo--6-colmeias;894\n';

const COLUNAS = {
  tag: ['TAG', 'EQUIPAMENTO', 'TROCADOR'],
  tipo: ['TIPO'],
  area: ['AREA', 'LOCAL', 'SETOR'],
  desenho: ['DESENHO', 'ESPELHO'],
  tubos: ['TUBOS', 'TOTAL DE TUBOS', 'QTD TUBOS', 'QTDE TUBOS'],
};

/** Divide uma linha de CSV respeitando aspas. */
function celulas(linha, sep) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (q) {
      if (ch === '"' && linha[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function deCsv(texto) {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const cab = linhas[0];
  const sep = cab.includes('\t') ? '\t' : cab.split(';').length >= cab.split(',').length ? ';' : ',';
  const titulos = celulas(cab, sep).map(norm);
  const idx = {};
  for (const [campo, nomes] of Object.entries(COLUNAS)) idx[campo] = titulos.findIndex((t) => nomes.includes(t));
  if (idx.tag < 0) throw new Error('a primeira linha precisa ter a coluna "tag"');
  return linhas.slice(1).map((l) => {
    const c = celulas(l, sep);
    const pega = (campo) => (idx[campo] >= 0 ? c[idx[campo]] || '' : '');
    return { tag: pega('tag'), tipo: pega('tipo'), area: pega('area'), desenho: pega('desenho'), tubos: pega('tubos') };
  });
}

/** Lê o arquivo importado e devolve a lista limpa (sem TAG vazia nem repetida; a última vence). */
export function lerListaEquipamentos(texto, nome = '') {
  const t = texto.trim();
  let lista;
  if (/\.json$/i.test(nome) || t.startsWith('{') || t.startsWith('[')) {
    const o = JSON.parse(t);
    lista = Array.isArray(o) ? o : o.trocadores || o.equipamentos;
    if (!Array.isArray(lista)) throw new Error('o JSON precisa ter a lista "trocadores"');
  } else lista = deCsv(t);
  const m = new Map();
  for (const x of lista) {
    const tag = String(x.tag || '').trim().toUpperCase();
    if (!tag) continue;
    const tubos = parseInt(String(x.tubos || '').replace(/\D/g, ''), 10);
    m.set(normTag(tag), { tag, tipo: String(x.tipo || '').trim(), area: String(x.area || '').trim(), desenho: String(x.desenho || '').trim(), ...(tubos ? { tubos } : {}) });
  }
  if (!m.size) throw new Error('nenhuma TAG encontrada');
  return [...m.values()];
}

/** Junta a lista do site com a importada (a importada vence na mesma TAG). */
export function mesclarEquipamentos(site, importada) {
  const m = new Map();
  for (const x of [...(site || []), ...(importada || [])]) {
    const k = normTag(x.tag);
    m.set(k, { ...(m.get(k) || {}), ...Object.fromEntries(Object.entries(x).filter(([, val]) => val !== '' && val != null)) });
  }
  return [...m.values()].sort((a, b) => a.tag.localeCompare(b.tag));
}

/** Total de tubos do equipamento: o da lista ou o do desenho no catálogo. */
export function tubosDe(troc, CAT, desenho) {
  if (troc && troc.tubos) return troc.tubos;
  const d = CAT.desenhos.find((x) => x.id === (desenho || (troc && troc.desenho)));
  return d ? d.tubos : '';
}
