/* Regras sobre o efetivo (EF = { colaboradores, frentes }): encarregados, modalidade e equipe de cada um. */
import { turnosDe } from './constantes.js';
import { norm } from './texto.js';

export const modDe = (EF, frente) => EF.frentes[frente] || '';
export const pessoasDoEnc = (EF, enc) => EF.colaboradores.filter((c) => c.encarregado && norm(c.encarregado) === norm(enc));

export function encarregados(EF) {
  const m = new Map();
  for (const c of EF.colaboradores) if (c.encarregado && modDe(EF, c.frente)) m.set(norm(c.encarregado), c.encarregado);
  return [...m.values()].sort();
}

/** Modalidade em que o encarregado tem mais gente. */
export function modalidadeDoEnc(EF, enc) {
  const n = {};
  for (const c of pessoasDoEnc(EF, enc)) { const m = modDe(EF, c.frente); if (m) n[m] = (n[m] || 0) + 1; }
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : '';
}

/** Turno sugerido pelo efetivo (ADM / TARDE / NOITE) dentro da lista da modalidade; turma do 6x4 não define horário. */
export function turnoDoEnc(EF, enc, mod) {
  const eu = EF.colaboradores.find((c) => norm(c.nome) === norm(enc));
  if (!eu) return '';
  const i = ['ADM', 'TARDE', 'NOITE'].indexOf(norm(eu.turno));
  return i < 0 ? '' : turnosDe(mod)[i];
}

export function statusPadrao(c) {
  const s = norm(c.status);
  if (s.includes('FERIAS')) return 'ferias';
  if (s.includes('INSS') || s.includes('AFAST')) return 'afastado';
  return 'presente';
}

export const pessoaDe = (c, origem) => ({ nome: c.nome, funcao: c.funcao || '', frente: c.frente || '', origem, contrato: '', status: statusPadrao(c), just: '' });
export const pessoaManual = (nome, funcao = '', contrato = '') => ({ nome: nome.trim().toUpperCase(), funcao: funcao.trim().toUpperCase(), frente: '', origem: 'manual', contrato: contrato.trim(), status: 'presente', just: '' });
/** "equipe" se a pessoa é do encarregado e da modalidade do lançamento; senão "outra". */
export const origemDe = (EF, D, c) => (norm(c.encarregado) === norm(D.encarregado) && modDe(EF, c.frente) === D.modalidade ? 'equipe' : 'outra');

/** Colaboradores cujo nome contém q, fora os que já estão na lista. */
export function buscarColaboradores(EF, q, jaNaLista, limite = 15) {
  if (norm(q).length < 2) return [];
  const ja = new Set(jaNaLista.map((p) => norm(p.nome)));
  const achados = [];
  EF.colaboradores.forEach((c, i) => { if (achados.length < limite && norm(c.nome).includes(norm(q)) && !ja.has(norm(c.nome))) achados.push({ c, i }); });
  return achados;
}
