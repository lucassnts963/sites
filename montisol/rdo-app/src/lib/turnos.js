/* Manutenção por TAG, produção do turno e passagem de turno entre os encarregados do PPU (um por turno, cada um no seu aparelho).

   Como os aparelhos se juntam sem servidor:
   - Cada tubo guarda QUANDO e EM QUAL LANÇAMENTO foi marcado (ts). Juntar dois mapas = em cada tubo vale a marcação mais
     recente (inclusive "desmarcado"). O resultado é o mesmo em qualquer ordem e importar duas vezes não duplica nada.
   - "Desobstruídos no turno" = tubos verdes marcados neste lançamento. Não depende do momento em que a passagem chegou.
   - Dados da manutenção (total de tubos, total obstruídos): vale o que foi editado por último (atualizadoEm).
   - Histórico turno a turno: cada lançamento grava o seu registro (id fixo); juntar = unir as listas pelo id.

   Chaves no aparelho (prefixo montisol-rdo:v1:):
     mapa:<TAG>:<desenho>     { tubo: status }                      (já existia; segue igual)
     mapats:<TAG>:<desenho>   { manut, ts: { tubo: [quando, lançamento, encarregado] } }
     manut:<TAG>              [ Manutenção ]   { id, tag, desenho, inicio, total, obstruidos, atualizadoEm, encerradaEm?, aliases? }
     turnos:<TAG>             [ Turno ]        { id, manut, lid, data, turno, encarregado, desobTurno, acum, pend, tamp, furado, total, obstruidos, salvoEm } */
import { contar } from './mapa.js';
import { normTag, uid } from './texto.js';

// ------------------------------------------------------------------ mapa com marcação por tubo

/** Marca quem mudou cada tubo entre `antes` e `depois` (estados {tubo: status}). Devolve o novo ts.
    O carimbo é sempre maior que qualquer um já conhecido no mapa: um celular com relógio atrasado não perde para marcações antigas. */
export function carimbarMudancas(antes, depois, ts, lid, autor, agora = Date.now()) {
  const novo = { ...(ts || {}) };
  agora = Math.max(agora, ...Object.values(novo).map((t) => t[0] + 1));
  const ids = new Set([...Object.keys(antes || {}), ...Object.keys(depois || {})]);
  for (const id of ids) if ((antes[id] || '') !== (depois[id] || '')) novo[id] = [agora, lid, autor || ''];
  return novo;
}

/** Junta dois mapas { estado, ts }: em cada tubo vence a marcação mais recente. Sem ts = marcação antiga (vale 0). */
export function mesclarMapa(a, b) {
  const estado = {}, ts = {};
  const ids = new Set([...Object.keys(a.estado || {}), ...Object.keys(a.ts || {}), ...Object.keys(b.estado || {}), ...Object.keys(b.ts || {})]);
  for (const id of ids) {
    const ta = (a.ts || {})[id], tb = (b.ts || {})[id];
    const qa = ta ? ta[0] : (a.estado || {})[id] ? 0 : -1;
    const qb = tb ? tb[0] : (b.estado || {})[id] ? 0 : -1;
    // empate no horário: decide pelo lançamento, igual em qualquer aparelho
    const bVence = qb > qa || (qb === qa && String(tb ? tb[1] : '') > String(ta ? ta[1] : ''));
    const [vence, tv] = bVence ? [b, tb] : [a, ta];
    const st = (vence.estado || {})[id];
    if (st) estado[id] = st;
    if (tv) ts[id] = tv;
  }
  return { estado, ts };
}

/** Tubos desobstruídos neste lançamento. */
export const desobNoTurno = (estado, ts, lid) => Object.entries(estado || {}).filter(([id, st]) => st === 'desobstruido' && ts && ts[id] && ts[id][1] === lid).length;

// ------------------------------------------------------------------ produção do turno

/** Números da seção "Controle de produção". Com mapa: desobstruídos/pendentes/tamponados vêm dele.
    Sem mapa: usa o que foi digitado e soma os turnos anteriores da manutenção para o acumulado. */
export function producao({ manut, estado, ts, lid, manual = {}, turnos = [] }) {
  const total = manut && manut.total !== undefined && manut.total !== '' ? String(manut.total) : String(manual.total || '');
  const mapeados = manut && manut.obstruidos !== undefined && manut.obstruidos !== '' ? String(manut.obstruidos) : String(manual.mapeados || '');
  if (Object.keys(estado || {}).length) {
    const c = contar(estado, null);
    return { modo: 'mapa', total, mapeados, desob: String(desobNoTurno(estado, ts, lid)), pend: String(c.obstruido), tamp: String(c.tamponado), acum: String(c.desobstruido), furado: c.furado };
  }
  const anteriores = turnos.filter((t) => t.lid !== lid && (!manut || mesmaManut(manut, t.manut))).reduce((s, t) => s + (+t.desobTurno || 0), 0);
  const desob = String(manual.desob || '');
  const acum = anteriores + (+desob || 0);
  // sem mapa, pendentes é digitado; a sugestão (escopo − acumulado) aparece na tela
  const sugestaoPend = mapeados ? String(Math.max(0, +mapeados - acum)) : '';
  return { modo: 'manual', total, mapeados, desob, pend: String(manual.pend || ''), tamp: String(manual.tamp || ''), acum: String(acum), furado: 0, sugestaoPend };
}

// ------------------------------------------------------------------ manutenções

export const novaManutencao = (tag, desenho, dados = {}) => ({
  id: `${normTag(tag)}@${new Date().toISOString().slice(0, 10)}-${uid().slice(-5)}`,
  tag, desenho: desenho || '', inicio: new Date().toISOString(), total: '', obstruidos: '', atualizadoEm: new Date().toISOString(), ...dados,
});
export const mesmaManut = (m, id) => !!m && (m.id === id || (m.aliases || []).includes(id));
const maisNova = (a, b) => (String(b.atualizadoEm || '') > String(a.atualizadoEm || '') ? b : a);

/** Junta as listas de manutenções de uma TAG. Duas manutenções abertas da mesma TAG são a mesma
    (aberta em aparelhos diferentes antes da primeira passagem): ficam com o id da mais antiga. */
export function mesclarManutencoes(a, b) {
  const porId = new Map();
  for (const m of [...(a || []), ...(b || [])]) {
    const x = porId.get(m.id);
    porId.set(m.id, x ? { ...maisNova(x, m), aliases: [...new Set([...(x.aliases || []), ...(m.aliases || [])])], encerradaEm: x.encerradaEm || m.encerradaEm } : m);
  }
  let lista = [...porId.values()];
  // um id que virou apelido de outro some da lista
  const apelidos = new Set(lista.flatMap((m) => m.aliases || []));
  lista = lista.filter((m) => !apelidos.has(m.id));
  const abertas = lista.filter((m) => !m.encerradaEm).sort((x, y) => String(x.inicio).localeCompare(String(y.inicio)));
  if (abertas.length > 1) {
    const [base, ...outras] = abertas;
    const campos = outras.reduce(maisNova, base);
    const unida = { ...base, total: campos.total, obstruidos: campos.obstruidos, desenho: campos.desenho || base.desenho, atualizadoEm: campos.atualizadoEm,
      aliases: [...new Set([...(base.aliases || []), ...outras.flatMap((m) => [m.id, ...(m.aliases || [])])])] };
    lista = [unida, ...lista.filter((m) => m.encerradaEm)];
  }
  return lista.sort((x, y) => String(y.inicio).localeCompare(String(x.inicio)));
}
export const manutAtual = (lista) => (lista || []).find((m) => !m.encerradaEm) || null;

/** Junta históricos turno a turno (pelo id; vale o salvo por último). */
export function mesclarTurnos(a, b) {
  const m = new Map();
  for (const t of [...(a || []), ...(b || [])]) { const x = m.get(t.id); m.set(t.id, x && String(x.salvoEm) > String(t.salvoEm) ? x : t); }
  return [...m.values()].sort((x, y) => String(y.data + y.salvoEm).localeCompare(String(x.data + x.salvoEm)));
}

// ------------------------------------------------------------------ arquivo de passagem de turno

export const TIPO_PASSAGEM = 'montisol-rdo-passagem';
/** JSON da passagem embutido no .html do mapa (o mesmo arquivo serve para ver e para importar). */
export const scriptPassagem = (p) => `<script type="application/json" id="rdo-passagem">${JSON.stringify(p).replace(/</g, '\\u003c')}</script>`;
export function lerPassagem(texto) {
  const t = String(texto || '').trim();
  let o = null;
  const m = /<script type="application\/json" id="rdo-passagem">([\s\S]*?)<\/script>/.exec(t);
  if (m) o = JSON.parse(m[1]);
  else if (t.startsWith('{')) o = JSON.parse(t);
  return o && o.tipo === TIPO_PASSAGEM ? o : null;
}

/** Texto da confirmação antes de juntar uma passagem (ação em massa no espelho). */
export function confirmacaoPassagem(p) {
  const d = p.geradoEm ? new Date(p.geradoEm) : null;
  const quando = d ? ` em ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
  const tubos = p.mapa ? Object.keys(p.mapa.estado || {}).length : 0;
  return `Juntar a passagem de turno de ${p.de || 'outro aparelho'}${quando} (${p.tag}: ${tubos} tubo(s) marcados, ${(p.turnos || []).length} turno(s)) com o espelho deste aparelho? Em cada tubo vale a marcação mais recente.`;
}
