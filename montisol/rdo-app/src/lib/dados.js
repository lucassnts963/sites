/* Dados de apoio: efetivo (importado no aparelho, do site ou de exemplo), catálogo de desenhos e TAGs. */
import { DADOS, DESENHOS } from './constantes.js';
import { store } from './store.js';

async function getJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ': ' + r.status);
  return r.json();
}

export async function carregarDados() {
  let EF, fonte;
  const imp = store.get('efetivo', null);
  let site = null;
  try { site = await getJson(DADOS + 'efetivo.json'); } catch (_) { /* o efetivo real não fica no repositório público */ }
  if (imp && (!site || String(imp.atualizado || '') >= String(site.atualizado || ''))) { EF = imp; fonte = 'importado'; }
  else if (site) { EF = site; fonte = 'site'; }
  else { try { EF = await getJson(DADOS + 'efetivo.exemplo.json'); fonte = 'exemplo'; } catch (_) { EF = {}; fonte = 'vazio'; } }
  EF.colaboradores = EF.colaboradores || [];
  EF.frentes = EF.frentes || {};
  let CAT, TROC;
  try { CAT = await getJson(DESENHOS + 'catalogo.json'); } catch (_) { CAT = { desenhos: [], status: null }; }
  try { TROC = (await getJson(DADOS + 'trocadores.json')).trocadores || []; } catch (_) { TROC = []; }
  return { EF, fonte, CAT, TROC };
}
