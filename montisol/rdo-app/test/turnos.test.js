// @vitest-environment jsdom
/* Manutenção por TAG, produção do mapa e passagem de turno entre os 3 encarregados do PPU (um aparelho por turno). */
import { beforeEach, describe, expect, it } from 'vitest';
import { carimbarMudancas, desobNoTurno, lerPassagem, mesclarManutencoes, mesclarMapa, producao, scriptPassagem } from '../src/lib/turnos.js';
import { editarManut, gravarMapa, importarPassagem, lerMapa, manutDe, montarPassagem, novaManutDaTag, registrarTurnos, turnosDaTag } from '../src/lib/passagem.js';
import { mapaHtml } from '../src/lib/mapaImagem.js';

const TAG = 'HE 41A-01A', DES = 'resfriamento-a-vacuo--6-colmeias';

/** Cada aparelho = um localStorage próprio. */
const aparelhos = {};
function usar(nome) {
  for (const k of Object.keys(localStorage)) if (!k.startsWith('__')) localStorage.removeItem(k);
  for (const [k, val] of Object.entries(aparelhos[nome] || {})) localStorage.setItem(k, val);
}
function guardar(nome) { aparelhos[nome] = { ...localStorage }; }
const ppu = (id, turno, enc, prod) => ({ id, modalidade: 'ppu', data: '2026-10-29', turno, encarregado: enc, equipamentos: [{ tag: TAG, desenho: DES, prod }] });
/** O que a tela faz: calcula a produção e grava o turno. */
function salvarTurno(D) {
  const m = lerMapa(TAG, DES);
  const p = producao({ manut: manutDe(TAG), estado: m.estado, ts: m.ts, lid: D.id, manual: D.equipamentos[0].prod, turnos: turnosDaTag(TAG) });
  Object.assign(D.equipamentos[0].prod, p);
  registrarTurnos(D);
  return p;
}
const marcar = (estado, ids, st) => { const n = { ...estado }; for (const id of ids) { if (st) n[id] = st; else delete n[id]; } return n; };
const ids = (a, b) => Array.from({ length: b - a }, (_, k) => 't' + (a + k));

beforeEach(() => { localStorage.clear(); for (const k of Object.keys(aparelhos)) delete aparelhos[k]; });

describe('mapa com marcação por tubo', () => {
  it('carimba só os tubos que mudaram (inclusive desmarcados)', () => {
    const ts = carimbarMudancas({ a: 'obstruido', b: 'obstruido' }, { a: 'desobstruido', b: 'obstruido', c: 'tamponado' }, {}, 'L1', 'ENC', 100);
    expect(ts).toEqual({ a: [100, 'L1', 'ENC'], c: [100, 'L1', 'ENC'] });
    expect(carimbarMudancas({ a: 'x' }, {}, ts, 'L2', 'B', 200).a).toEqual([200, 'L2', 'B']);
  });
  it('junta pela marcação mais recente, em qualquer ordem, e reimportar não muda nada', () => {
    const A = { estado: { 1: 'desobstruido', 2: 'obstruido' }, ts: { 1: [10, 'A'], 2: [5, 'A'] } };
    const B = { estado: { 2: 'desobstruido', 3: 'tamponado' }, ts: { 2: [20, 'B'], 3: [20, 'B'], 1: [1, 'B'] } };
    const ab = mesclarMapa(A, B), ba = mesclarMapa(B, A);
    expect(ab).toEqual(ba);
    expect(ab.estado).toEqual({ 1: 'desobstruido', 2: 'desobstruido', 3: 'tamponado' });
    expect(mesclarMapa(ab, B)).toEqual(ab);
    // desmarcar depois vence a marcação antiga
    expect(mesclarMapa(A, { estado: {}, ts: { 1: [30, 'C'] } }).estado[1]).toBeUndefined();
    // mapa antigo sem ts perde para qualquer marcação nova
    expect(mesclarMapa({ estado: { 9: 'obstruido' }, ts: {} }, { estado: { 9: 'desobstruido' }, ts: { 9: [1, 'X'] } }).estado[9]).toBe('desobstruido');
  });
  it('desobstruídos no turno = verdes marcados neste lançamento', () => {
    expect(desobNoTurno({ a: 'desobstruido', b: 'desobstruido', c: 'obstruido' }, { a: [1, 'L1'], b: [1, 'L0'], c: [1, 'L1'] }, 'L1')).toBe(1);
  });
});

describe('produção', () => {
  it('com mapa: turno, acumulado, pendentes e tamponados vêm dele; total e escopo vêm da manutenção', () => {
    const p = producao({ manut: { total: 894, obstruidos: 300 }, estado: { a: 'desobstruido', b: 'desobstruido', c: 'obstruido', d: 'tamponado' }, ts: { a: [1, 'L'] }, lid: 'L' });
    expect(p).toMatchObject({ modo: 'mapa', total: '894', mapeados: '300', desob: '1', acum: '2', pend: '1', tamp: '1' });
  });
  it('sem mapa: acumulado soma os turnos anteriores da manutenção', () => {
    const p = producao({ manut: { id: 'm', total: '180', obstruidos: '100' }, estado: {}, lid: 'L3', manual: { desob: '15' },
      turnos: [{ lid: 'L1', manut: 'm', desobTurno: '20' }, { lid: 'L2', manut: 'm', desobTurno: '30' }, { lid: 'L0', manut: 'velha', desobTurno: '99' }] });
    expect(p).toMatchObject({ modo: 'manual', desob: '15', acum: '65', sugestaoPend: '35', total: '180' });
  });
});

describe('manutenções', () => {
  it('duas abertas da mesma TAG (aparelhos diferentes) viram uma, com o id da mais antiga e o valor editado por último', () => {
    const a = [{ id: 'mA', inicio: '2026-10-28T08:00', total: '894', obstruidos: '', atualizadoEm: '2026-10-28T08:00' }];
    const b = [{ id: 'mB', inicio: '2026-10-28T16:00', total: '894', obstruidos: '320', atualizadoEm: '2026-10-28T16:05' }];
    const l = mesclarManutencoes(a, b);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ id: 'mA', obstruidos: '320', aliases: ['mB'] });
    expect(mesclarManutencoes(l, b)).toEqual(mesclarManutencoes(b, l));
  });
});

describe('passagem de turno entre 3 aparelhos (ADM → Tarde → Noite → ADM)', () => {
  it('cada turno conta só a sua produção e todos terminam com o mesmo mapa e o mesmo histórico', () => {
    // ADM: abre a manutenção, informa o escopo, marca 300 obstruídos e desobstrói 40
    usar('adm');
    editarManut(TAG, DES, { total: '894', obstruidos: '300' });
    gravarMapa(TAG, DES, marcar({}, ids(0, 300), 'obstruido'), { lid: 'ADM1', autor: 'A' });
    gravarMapa(TAG, DES, marcar(lerMapa(TAG, DES).estado, ids(0, 40), 'desobstruido'), { lid: 'ADM1', autor: 'A' });
    const pAdm = salvarTurno(ppu('ADM1', 'ADM (07h30–17h24)', 'ENC ADM', {}));
    expect(pAdm).toMatchObject({ desob: '40', acum: '40', pend: '260', mapeados: '300', total: '894' });
    const html = mapaHtml('<svg></svg>', { trocador: TAG }, null, montarPassagem(TAG, DES, 'ENC ADM'));
    guardar('adm');

    // TARDE: aparelho novo, recebe a passagem; total e escopo já vêm preenchidos
    usar('tarde');
    const r = importarPassagem(lerPassagem(html));
    expect(r).toMatchObject({ tubos: 300, turnosNovos: 1 });
    expect(manutDe(TAG)).toMatchObject({ total: '894', obstruidos: '300' });
    gravarMapa(TAG, DES, marcar(lerMapa(TAG, DES).estado, ids(40, 100), 'desobstruido'), { lid: 'TAR1', autor: 'T' });
    const pTar = salvarTurno(ppu('TAR1', 'Tarde (15h30–00h50)', 'ENC TARDE', {}));
    expect(pTar).toMatchObject({ desob: '60', acum: '100', pend: '200' });
    const passTarde = montarPassagem(TAG, DES, 'ENC TARDE');
    guardar('tarde');

    // NOITE: recebe a da tarde (que já inclui a do ADM); tampona 5
    usar('noite');
    importarPassagem(passTarde);
    gravarMapa(TAG, DES, marcar(marcar(lerMapa(TAG, DES).estado, ids(100, 130), 'desobstruido'), ids(290, 295), 'tamponado'), { lid: 'NOI1', autor: 'N' });
    const pNoi = salvarTurno(ppu('NOI1', 'Noite (23h00–07h30)', 'ENC NOITE', {}));
    expect(pNoi).toMatchObject({ desob: '30', acum: '130', pend: '165', tamp: '5' });
    const passNoite = montarPassagem(TAG, DES, 'ENC NOITE');
    guardar('noite');

    // ADM do dia seguinte: recebe a da noite; o histórico tem os 3 turnos e o mapa é o mesmo da noite
    usar('adm');
    importarPassagem(passNoite);
    importarPassagem(passNoite); // repetir não duplica
    expect(turnosDaTag(TAG).map((t) => [t.encarregado, t.desobTurno])).toEqual([['ENC NOITE', '30'], ['ENC TARDE', '60'], ['ENC ADM', '40']]);
    const estAdm = lerMapa(TAG, DES).estado;
    guardar('adm');
    usar('noite');
    expect(lerMapa(TAG, DES).estado).toEqual(estAdm);
    // a produção de cada turno continua a mesma depois das passagens
    usar('adm');
    const m = lerMapa(TAG, DES);
    expect(desobNoTurno(m.estado, m.ts, 'ADM1')).toBe(40);
    expect(desobNoTurno(m.estado, m.ts, 'TAR1')).toBe(60);
  });

  it('turnos sobrepostos (ADM e Tarde no mesmo espelho) se juntam sem perder marcação', () => {
    usar('adm');
    gravarMapa(TAG, DES, marcar({}, ids(0, 10), 'obstruido'), { lid: 'ADM1', autor: 'A' });
    const base = montarPassagem(TAG, DES, 'A');
    guardar('adm');
    usar('tarde'); importarPassagem(base);
    gravarMapa(TAG, DES, marcar(lerMapa(TAG, DES).estado, ids(5, 10), 'desobstruido'), { lid: 'TAR1', autor: 'T' });
    const daTarde = montarPassagem(TAG, DES, 'T'); guardar('tarde');
    usar('adm');
    gravarMapa(TAG, DES, marcar(lerMapa(TAG, DES).estado, ids(0, 3), 'desobstruido'), { lid: 'ADM1', autor: 'A' });
    importarPassagem(daTarde);
    const m = lerMapa(TAG, DES);
    expect(Object.values(m.estado).filter((s) => s === 'desobstruido')).toHaveLength(8);
    expect([desobNoTurno(m.estado, m.ts, 'ADM1'), desobNoTurno(m.estado, m.ts, 'TAR1')]).toEqual([3, 5]);
  });

  it('nova manutenção limpa o espelho e passagens da manutenção antiga não sujam o mapa novo', () => {
    usar('adm');
    gravarMapa(TAG, DES, { t1: 'desobstruido' }, { lid: 'L1', autor: 'A' });
    const antiga = montarPassagem(TAG, DES, 'A');
    novaManutDaTag(TAG, DES, { total: '894' });
    expect(lerMapa(TAG, DES).estado).toEqual({});
    expect(manutDe(TAG).total).toBe('894');
    const r = importarPassagem(antiga);
    expect(r.mapaIgnorado).toBe(true);
    expect(lerMapa(TAG, DES).estado).toEqual({});
  });

  it('a passagem vai dentro do .html e é lida de volta', () => {
    const p = { tipo: 'montisol-rdo-passagem', tag: 'X</script><b>', turnos: [] };
    const html = `<html>${scriptPassagem(p)}</html>`;
    expect(lerPassagem(html)).toEqual(p);
    expect(lerPassagem('<svg></svg>')).toBeNull();
  });
});

describe('relógio dos celulares', () => {
  it('marcação nova vence mesmo com o relógio do celular atrasado', () => {
    const ts = carimbarMudancas({}, { a: 'obstruido' }, {}, 'L1', 'A', 5000); // celular adiantado
    const ts2 = carimbarMudancas({ a: 'obstruido' }, { a: 'desobstruido' }, ts, 'L2', 'B', 1000); // celular atrasado, depois
    expect(ts2.a[0]).toBeGreaterThan(ts.a[0]);
    expect(mesclarMapa({ estado: { a: 'obstruido' }, ts }, { estado: { a: 'desobstruido' }, ts: ts2 }).estado.a).toBe('desobstruido');
  });
});
