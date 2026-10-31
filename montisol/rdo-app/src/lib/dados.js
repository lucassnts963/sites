/* Dados de apoio: efetivo (importado no aparelho, do site ou de exemplo), catálogo de desenhos e TAGs (site + importadas).
   De onde vêm os arquivos depende da plataforma (#plataforma): no Pages, do site; no BeaconOS, embutidos no app. */
import { carregarApoio } from '#plataforma';
import { mesclarEquipamentos } from './equipamentos.js';
import { store } from './store.js';

export async function carregarDados() {
  const { efetivoSite: site, efetivoExemplo, catalogo, trocadores } = await carregarApoio();
  let EF, fonte;
  const imp = store.get('efetivo', null);
  if (imp && (!site || String(imp.atualizado || '') >= String(site.atualizado || ''))) { EF = imp; fonte = 'importado'; }
  else if (site) { EF = site; fonte = 'site'; }
  else if (efetivoExemplo) { EF = efetivoExemplo; fonte = 'exemplo'; }
  else { EF = {}; fonte = 'vazio'; }
  EF.colaboradores = EF.colaboradores || [];
  EF.frentes = EF.frentes || {};
  const CAT = catalogo || { desenhos: [], status: null };
  const trocSite = (trocadores && trocadores.trocadores) || [];
  const equipImp = store.get('equipamentos', null);
  const TROC = mesclarEquipamentos(trocSite, equipImp && equipImp.trocadores);
  return { EF, fonte, CAT, TROC, equipImp };
}
