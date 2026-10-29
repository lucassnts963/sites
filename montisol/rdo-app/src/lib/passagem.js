/* Manutenção, mapa e histórico turno a turno guardados no aparelho, e a passagem de turno (montar e importar).
   As regras de junção estão em turnos.js. */
import { VERSAO } from './constantes.js';
import { store } from './store.js';
import { normTag } from './texto.js';
import { carimbarMudancas, manutAtual, mesclarManutencoes, mesclarMapa, mesclarTurnos, mesmaManut, novaManutencao, TIPO_PASSAGEM } from './turnos.js';

const kMapa = (tag, desenho) => `mapa:${normTag(tag)}:${desenho}`;
const kTs = (tag, desenho) => `mapats:${normTag(tag)}:${desenho}`;
const kManut = (tag) => `manut:${normTag(tag)}`;
const kTurnos = (tag) => `turnos:${normTag(tag)}`;

// ------------------------------------------------------------------ manutenção

export const manutencoes = (tag) => (tag ? store.get(kManut(tag), []) : []);
export const manutDe = (tag) => manutAtual(manutencoes(tag));

/** Manutenção aberta da TAG; cria se não houver (com os valores sugeridos). */
export function garantirManut(tag, desenho, sugestao = {}) {
  const lista = manutencoes(tag);
  const m = manutAtual(lista);
  if (m) return m;
  const nova = novaManutencao(tag, desenho, sugestao);
  store.set(kManut(tag), [nova, ...lista]);
  return nova;
}

export function editarManut(tag, desenho, campos, sugestao) {
  const atual = garantirManut(tag, desenho, sugestao);
  const lista = manutencoes(tag).map((m) => (m.id === atual.id ? { ...m, ...campos, atualizadoEm: new Date().toISOString() } : m));
  store.set(kManut(tag), lista);
}

/** Encerra a manutenção aberta e começa outra com o espelho limpo (o mapa antigo fica arquivado no aparelho). */
export function novaManutDaTag(tag, desenho, sugestao = {}) {
  const agora = new Date().toISOString();
  const atual = manutDe(tag);
  const lista = manutencoes(tag).map((m) => (atual && m.id === atual.id ? { ...m, encerradaEm: agora, atualizadoEm: agora } : m));
  if (atual && desenho) {
    store.set(`mapa-arq:${normTag(tag)}:${atual.id}`, { estado: store.get(kMapa(tag, desenho), {}), ts: (store.get(kTs(tag, desenho), {}) || {}).ts || {} });
    store.del(kMapa(tag, desenho)); store.del(kTs(tag, desenho));
  }
  const nova = novaManutencao(tag, desenho, { total: sugestao.total || (atual && atual.total) || '' });
  store.set(kManut(tag), [nova, ...lista]);
  return nova;
}

// ------------------------------------------------------------------ mapa

export function lerMapa(tag, desenho) {
  if (!tag || !desenho) return { estado: {}, ts: {}, manut: '' };
  const meta = store.get(kTs(tag, desenho), null) || {};
  return { estado: store.get(kMapa(tag, desenho), {}) || {}, ts: meta.ts || {}, manut: meta.manut || '' };
}

/** Grava o mapa marcando quem mudou cada tubo (lançamento + encarregado). */
export function gravarMapa(tag, desenho, estado, { lid, autor }) {
  const antes = lerMapa(tag, desenho);
  const m = garantirManut(tag, desenho);
  store.set(kMapa(tag, desenho), estado);
  store.set(kTs(tag, desenho), { manut: m.id, ts: carimbarMudancas(antes.estado, estado, antes.ts, lid, autor) });
}

// ------------------------------------------------------------------ histórico turno a turno

export const turnosDaTag = (tag) => (tag ? store.get(kTurnos(tag), []) : []);
export const tagsComTurnos = () => store.chaves('turnos:').map((k) => { const l = store.get(k.slice(k.indexOf('turnos:')), []); return l[0] ? l[0].tag : ''; }).filter(Boolean);

/** Ao salvar/enviar o lançamento: grava (ou atualiza) o registro do turno de cada equipamento do PPU. */
export function registrarTurnos(D) {
  if (D.modalidade !== 'ppu') return;
  for (const eq of D.equipamentos || []) {
    if (!eq.tag) continue;
    const m = garantirManut(eq.tag, eq.desenho, { total: eq.prod.total, obstruidos: eq.prod.mapeados });
    const t = { id: `${D.id}:${normTag(eq.tag)}`, tag: eq.tag, manut: m.id, lid: D.id, data: D.data, turno: D.turno, encarregado: D.encarregado,
      desobTurno: eq.prod.desob, acum: eq.prod.acum, pend: eq.prod.pend, tamp: eq.prod.tamp, total: eq.prod.total, obstruidos: eq.prod.mapeados, salvoEm: new Date().toISOString() };
    store.set(kTurnos(eq.tag), mesclarTurnos(turnosDaTag(eq.tag), [t]));
  }
}
export function removerTurnosDoLancamento(r) {
  for (const eq of r.equipamentos || []) if (eq.tag) store.set(kTurnos(eq.tag), turnosDaTag(eq.tag).filter((t) => t.lid !== r.id));
}

// ------------------------------------------------------------------ passagem de turno

export function montarPassagem(tag, desenho, de) {
  const mapa = lerMapa(tag, desenho);
  return { tipo: TIPO_PASSAGEM, versao: VERSAO, geradoEm: new Date().toISOString(), de: de || '', tag, desenho: desenho || '',
    manutencoes: manutencoes(tag), mapa: desenho ? { manut: mapa.manut, estado: mapa.estado, ts: mapa.ts } : null, turnos: turnosDaTag(tag) };
}

/** Junta a passagem recebida com o que há no aparelho. Devolve um resumo para o aviso. */
export function importarPassagem(p) {
  const { tag } = p;
  if (!tag) throw new Error('passagem sem TAG');
  const antesTurnos = turnosDaTag(tag).length;
  const lista = mesclarManutencoes(manutencoes(tag), p.manutencoes || []);
  store.set(kManut(tag), lista);
  const atual = manutAtual(lista);
  let tubos = 0, mapaIgnorado = false;
  if (p.mapa && p.desenho) {
    const local = lerMapa(tag, p.desenho);
    const doAtual = (id) => !id || (atual && mesmaManut(atual, id));
    if (!doAtual(p.mapa.manut)) mapaIgnorado = true; // mapa de uma manutenção já encerrada
    else {
      let base = local;
      if (!doAtual(local.manut)) { // o mapa daqui é de uma manutenção encerrada: arquiva e começa do recebido
        store.set(`mapa-arq:${normTag(tag)}:${local.manut}`, { estado: local.estado, ts: local.ts });
        base = { estado: {}, ts: {} };
      }
      const junto = mesclarMapa(base, p.mapa);
      tubos = Object.keys(junto.estado).filter((id) => junto.estado[id] !== base.estado[id]).length
        + Object.keys(base.estado).filter((id) => !junto.estado[id]).length;
      store.set(kMapa(tag, p.desenho), junto.estado);
      store.set(kTs(tag, p.desenho), { manut: atual ? atual.id : p.mapa.manut, ts: junto.ts });
    }
  }
  store.set(kTurnos(tag), mesclarTurnos(turnosDaTag(tag), p.turnos || []));
  return { tag, desenho: p.desenho, tubos, mapaIgnorado, turnosNovos: turnosDaTag(tag).length - antesTurnos, de: p.de, geradoEm: p.geradoEm };
}
