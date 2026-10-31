/* Plataforma "beacon" (mini app interno do BeaconOS): roda isolado, com origem "null".
   - Sem fetch de arquivos do próprio app: catálogo, TAGs, efetivo de EXEMPLO e desenhos vão embutidos no script.
     O efetivo real continua sendo importado em Ajustes (nunca entra no build nem no repositório).
   - Sem IndexedDB: a fila de envio fica no localStorage (lib/base.js cai para o store quando fila = null)
     e as fotos guardam só momento e legenda (imagens = null).
   - localStorage comprimido (LZ) para caber mais; sem service worker nem manifest. */
import LZString from 'lz-string';
import catalogo from '../../../desenhos/catalogo.json';
import trocadores from '../../../dados/trocadores.json';
import efetivoExemplo from '../../../dados/efetivo.exemplo.json';

export const ALVO = 'beacon';
export const MARCA = 'marca/';

// todos os SVG de desenhos/<tipo>/<arquivo>.svg, como texto, dentro do script
const SVGS = import.meta.glob('../../../desenhos/*/*.svg', { query: '?raw', import: 'default', eager: true });

const copia = (o) => JSON.parse(JSON.stringify(o));
export async function carregarApoio() {
  return { efetivoSite: null, efetivoExemplo: copia(efetivoExemplo), catalogo: copia(catalogo), trocadores: copia(trocadores) };
}

export async function lerDesenho(arquivo) {
  const t = SVGS['../../../desenhos/' + arquivo];
  if (!t) throw new Error('Desenho não está no app: ' + arquivo);
  return t;
}

export const fila = null;    // fila no localStorage (via store)
export const imagens = null; // imagens das fotos não são guardadas

/** Valores grandes vão comprimidos (marcador \u0001z + LZ em UTF-16); valores antigos em JSON continuam legíveis. */
const MARCADOR = '\u0001z';
export const codec = {
  gravar(obj) {
    const json = JSON.stringify(obj);
    return json.length > 512 ? MARCADOR + LZString.compressToUTF16(json) : json;
  },
  ler(txt) {
    return JSON.parse(txt.startsWith(MARCADOR) ? LZString.decompressFromUTF16(txt.slice(MARCADOR.length)) : txt);
  },
};

export function iniciar() { /* sem service worker no BeaconOS */ }
