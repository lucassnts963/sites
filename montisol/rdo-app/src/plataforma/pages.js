/* Plataforma "pages" (GitHub Pages, PWA): dados e desenhos buscados do site, fila e fotos no IndexedDB, service worker.
   O alvo é escolhido no build (alias #plataforma no vite.config.js); a interface é a mesma de plataforma/beacon.js. */
import { tx } from '../lib/idb.js';

export const ALVO = 'pages';
export const MARCA = '../marca/';
const DADOS = '../dados/', DESENHOS = '../desenhos/';

async function getJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ': ' + r.status);
  return r.json();
}

/** Dados de apoio: efetivo do site (se existir; o real não fica no repositório público), exemplo, catálogo e TAGs. */
export async function carregarApoio() {
  const pega = (u) => getJson(u).catch(() => null);
  const [efetivoSite, efetivoExemplo, catalogo, trocadores] = await Promise.all([
    pega(DADOS + 'efetivo.json'), pega(DADOS + 'efetivo.exemplo.json'), pega(DESENHOS + 'catalogo.json'), pega(DADOS + 'trocadores.json')]);
  return { efetivoSite, efetivoExemplo, catalogo, trocadores };
}

/** Texto do SVG do desenho do catálogo (`arquivo` como em catalogo.json). */
export async function lerDesenho(arquivo) {
  const r = await fetch(DESENHOS + arquivo);
  if (!r.ok) throw new Error('Desenho não encontrado no site: ' + arquivo);
  return r.text();
}

/** Fila de envio para a base (IndexedDB). */
export const fila = {
  listar: () => tx('fila', 'readonly', (s) => s.getAll()).catch(() => []),
  guardar: (item) => tx('fila', 'readwrite', (s) => { s.put(item); }),
  tirar: (id) => tx('fila', 'readwrite', (s) => { s.delete(id); }),
};

/** Imagens das fotos (IndexedDB). */
export const imagens = {
  guardar: (id, blob) => tx('fotos', 'readwrite', (s) => { s.put(blob, id); }),
  ler: (id) => tx('fotos', 'readonly', (s) => s.get(id)),
  apagar: (id) => tx('fotos', 'readwrite', (s) => { s.delete(id); }),
  ids: () => tx('fotos', 'readonly', (s) => s.getAllKeys()),
};

/** Valores do localStorage em JSON puro (formato de sempre: quem atualiza não perde nada). */
export const codec = null;

export function iniciar() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('../sw.js').catch(() => {});
}
