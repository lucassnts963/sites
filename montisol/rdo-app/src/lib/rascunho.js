/* Forma do lançamento (rascunho D) e transformações sobre ele. As funções que recebem D o alteram no lugar. */
import { modDe, modalidadeDoEnc, pessoaDe, pessoasDoEnc, statusPadrao, turnoDoEnc } from './efetivo.js';
import { clone, hoje, norm, normTag, uid } from './texto.js';

const horVazio = () => ({ ddsIni: '', ddsFim: '', lib: '', ini: '', fim: '' });
const prodVazio = () => ({ total: '', mapeados: '', desob: '', pend: '', tamp: '', acum: '' });
const ativVazio = () => ({ servico: '', situacao: '', pend: '', prox: '' });
const fotosVazio = () => ({ antes: '', depois: '' });
export const paradaVazia = () => ({ resp: '', motivo: '', ini: '', fim: '', impacto: '' });

/** Equipamento novo do PPU; já vem com a equipe PPU presente (a da lista de presença, se já foi apontada). */
export function novoEq(EF, D) {
  let equipe = [];
  if (D && (D.pessoas || []).length) equipe = D.pessoas.filter((p) => p.status === 'presente').map(({ just, deveria, ...p }) => ({ ...p, status: 'presente' }));
  else if (D && D.encarregado) {
    equipe = pessoasDoEnc(EF, D.encarregado).filter((c) => modDe(EF, c.frente) === 'ppu' && statusPadrao(c) === 'presente').map((c) => pessoaDe(c, 'equipe'));
  }
  return { uid: uid(), tag: '', desenho: '', servico: 'desobstrucao', aqs: '', aqsRef: '', equipe, hor: horVazio(), prod: prodVazio(), paradas: [], ativ: ativVazio(), fotos: fotosVazio(), anexos: [] };
}

/** PPU: marca a presença da pessoa j. Quem não está presente sai das equipes dos equipamentos;
    na falta, "deveria estar" já vem com a TAG onde a pessoa estava. Ao voltar a presente, volta para essa TAG. */
export function marcarPresencaPPU(D, j, st) {
  const p = D.pessoas[j];
  const eqs = D.equipamentos || [];
  const ondeEstava = eqs.find((eq) => (eq.equipe || []).some((x) => norm(x.nome) === norm(p.nome)));
  const antes = p.deveria;
  p.status = st;
  if (st === 'presente') {
    const alvo = eqs.find((eq) => antes && normTag(eq.tag) === normTag(antes)) || (eqs.length === 1 ? eqs[0] : null);
    if (alvo && !alvo.equipe.some((x) => norm(x.nome) === norm(p.nome))) { const { just, deveria, ...x } = p; alvo.equipe.push(x); }
    p.just = ''; p.deveria = '';
    return;
  }
  for (const eq of eqs) eq.equipe = (eq.equipe || []).filter((x) => norm(x.nome) !== norm(p.nome));
  if (st === 'falta') { if (!p.deveria) p.deveria = (ondeEstava && ondeEstava.tag) || (eqs.length === 1 ? eqs[0].tag : ''); }
  else { p.just = ''; p.deveria = ''; }
}

/** TAG escolhida: completa desenho e total de tubos com a lista de equipamentos / catálogo. */
export function completarPelaTag(eq, TROC, CAT) {
  const t = TROC.find((y) => normTag(y.tag) === normTag(eq.tag));
  if (t && !eq.desenho && t.desenho) eq.desenho = t.desenho;
  if (!eq.prod.total) {
    const d = CAT.desenhos.find((x) => x.id === eq.desenho);
    const total = (t && t.tubos) || (t && d && d.tubos) || '';
    if (total) eq.prod.total = String(total);
  }
}

export function novoDraft(EF, eu) {
  const mod = (eu && modalidadeDoEnc(EF, eu)) || 'ppu';
  return { id: uid(), modalidade: mod, data: hoje(), turno: eu ? turnoDoEnc(EF, eu, mod) : '', encarregado: eu || '',
    inicio: '', termino: '', equipamentos: [], pessoas: [], anexos: [], atividades: '', osExec: '', osCanc: '', obs: '', criadoEm: new Date().toISOString() };
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
  D.anexos = D.anexos || [];
  if (!D.pessoas.length && D.encarregado) preencherEquipe(EF, D);
  if (D.modalidade === 'ppu' && !D.equipamentos.length) D.equipamentos.push(novoEq(EF, D));
}

/** Registros restaurados de backup ou de versões antigas podem vir sem algum bloco. */
export function migrar(d) {
  if (d && !d.anexos) d.anexos = [];
  for (const eq of (d && d.equipamentos) || []) {
    eq.prod = Object.assign(prodVazio(), eq.prod);
    eq.ativ = Object.assign(ativVazio(), eq.ativ);
    eq.fotos = Object.assign(fotosVazio(), eq.fotos);
    eq.equipe = eq.equipe || []; eq.paradas = eq.paradas || []; eq.anexos = eq.anexos || [];
    if (!eq.servico) eq.servico = 'desobstrucao';
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
  delete D.salvoEm; delete D.enviadoEm; delete D.envioId; // lançamento novo: novo id de envio para a base
  D.anexos = []; D.inicio = ''; D.termino = '';
  for (const eq of D.equipamentos || []) { eq.uid = uid(); eq.hor = horVazio(); eq.paradas = []; eq.fotos = fotosVazio(); eq.anexos = []; eq.prod.desob = ''; eq.prod.acum = ''; }
  return D;
}

/** Aplica no equipamento o último apontamento da mesma TAG (sem horários, paradas e fotos). */
export function copiarApontamento(eq, e) {
  Object.assign(eq, { tag: eq.tag || e.tag, desenho: e.desenho, servico: e.servico || eq.servico, aqs: e.aqs, aqsRef: e.aqsRef, equipe: clone(e.equipe || []),
    prod: { total: e.prod.total, mapeados: e.prod.mapeados, desob: '', pend: e.prod.pend, tamp: e.prod.tamp }, ativ: clone(e.ativ) });
}
