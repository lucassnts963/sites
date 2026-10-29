/* Forma do lançamento (rascunho D) e transformações sobre ele. As funções que recebem D o alteram no lugar. */
import { modDe, modalidadeDoEnc, pessoaDe, pessoasDoEnc, statusPadrao, turnoDoEnc } from './efetivo.js';
import { clone, hoje, uid } from './texto.js';

const horVazio = () => ({ ddsIni: '', ddsFim: '', lib: '', ini: '', fim: '' });
const prodVazio = () => ({ total: '', mapeados: '', desob: '', pend: '', tamp: '' });
const ativVazio = () => ({ servico: '', situacao: '', pend: '', prox: '' });
const fotosVazio = () => ({ antes: '', depois: '' });
export const paradaVazia = () => ({ resp: '', motivo: '', ini: '', fim: '', impacto: '' });

/** Equipamento novo do PPU; já vem com a equipe PPU presente do encarregado. */
export function novoEq(EF, D) {
  const equipe = D && D.encarregado
    ? pessoasDoEnc(EF, D.encarregado).filter((c) => modDe(EF, c.frente) === 'ppu' && statusPadrao(c) === 'presente').map((c) => pessoaDe(c, 'equipe'))
    : [];
  return { uid: uid(), tag: '', desenho: '', aqs: '', aqsRef: '', equipe, hor: horVazio(), prod: prodVazio(), paradas: [], ativ: ativVazio(), fotos: fotosVazio(), mapaInicio: null };
}

export function novoDraft(EF, eu) {
  const mod = (eu && modalidadeDoEnc(EF, eu)) || 'ppu';
  return { id: uid(), modalidade: mod, data: hoje(), turno: eu ? turnoDoEnc(EF, eu, mod) : '', encarregado: eu || '',
    equipamentos: [], pessoas: [], atividades: '', osExec: '', osCanc: '', obs: '', criadoEm: new Date().toISOString() };
}

export function preencherEquipe(EF, D) {
  let lista = pessoasDoEnc(EF, D.encarregado).filter((c) => modDe(EF, c.frente) === D.modalidade);
  if (!lista.length) lista = pessoasDoEnc(EF, D.encarregado);
  D.pessoas = lista.map((c) => pessoaDe(c, 'equipe'));
}

/** PPU precisa de ao menos um equipamento; extra/6x4 começam com a equipe do encarregado. */
export function garantirConteudo(EF, D) {
  D.equipamentos = D.equipamentos || [];
  D.pessoas = D.pessoas || [];
  if (D.modalidade === 'ppu' && !D.equipamentos.length) D.equipamentos.push(novoEq(EF, D));
  if (D.modalidade !== 'ppu' && !D.pessoas.length && D.encarregado) preencherEquipe(EF, D);
}

/** Registros restaurados de backup ou de versões antigas podem vir sem algum bloco. */
export function migrar(d) {
  for (const eq of (d && d.equipamentos) || []) {
    eq.prod = Object.assign(prodVazio(), eq.prod);
    eq.ativ = Object.assign(ativVazio(), eq.ativ);
    eq.fotos = Object.assign(fotosVazio(), eq.fotos);
    eq.equipe = eq.equipe || []; eq.paradas = eq.paradas || [];
    if (!eq.uid) eq.uid = uid();
    const h = eq.hor || (eq.hor = {});
    if (h.dds && !h.ddsIni) h.ddsIni = h.dds;
    delete h.dds;
    if (h.ddsIni === undefined) h.ddsIni = '';
    if (h.ddsFim === undefined) h.ddsFim = '';
  }
  return d;
}

/** Copia de um registro para um lançamento de hoje, sem horários, paradas, fotos e produção do turno. */
export function duplicarParaHoje(r) {
  const D = clone(r);
  D.id = uid(); D.data = hoje(); D.criadoEm = new Date().toISOString();
  delete D.salvoEm; delete D.enviadoEm;
  for (const eq of D.equipamentos || []) { eq.uid = uid(); eq.hor = horVazio(); eq.paradas = []; eq.fotos = fotosVazio(); eq.prod.desob = ''; eq.mapaInicio = null; }
  return D;
}

/** Aplica no equipamento o último apontamento da mesma TAG (sem horários, paradas e fotos). */
export function copiarApontamento(eq, e) {
  Object.assign(eq, { tag: eq.tag || e.tag, desenho: e.desenho, aqs: e.aqs, aqsRef: e.aqsRef, equipe: clone(e.equipe || []),
    prod: { total: e.prod.total, mapeados: e.prod.mapeados, desob: '', pend: e.prod.pend, tamp: e.prod.tamp }, ativ: clone(e.ativ) });
}

/** Preenche a produção a partir da contagem do mapa; desobstruídos no turno = agora − início do lançamento. */
export function aplicarContagem(eq, c) {
  if (c.total !== '') eq.prod.total = String(c.total);
  eq.prod.mapeados = String(c.obstruido + c.desobstruido);
  eq.prod.desob = String(Math.max(0, c.desobstruido - ((eq.mapaInicio && eq.mapaInicio.desobstruido) || 0)));
  eq.prod.pend = String(c.obstruido);
  eq.prod.tamp = String(c.tamponado);
}
