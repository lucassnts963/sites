import { describe, expect, it } from 'vitest';
import { encarregados, modalidadeDoEnc, origemDe, statusPadrao, turnoDoEnc } from '../src/lib/efetivo.js';
import { contar, exportSvg } from '../src/lib/mapa.js';
import { duplicarParaHoje, garantirConteudo, migrar, novoDraft } from '../src/lib/rascunho.js';
import EF from '../../dados/efetivo.exemplo.json';

describe('efetivo', () => {
  it('lista os encarregados das frentes do contrato', () => {
    expect(encarregados(EF)).toEqual(['ENCARREGADO EXTRA EXEMPLO', 'ENCARREGADO PPU EXEMPLO', 'ENCARREGADO TURMA EXEMPLO']);
  });
  it('modalidade e turno vêm do efetivo', () => {
    expect(modalidadeDoEnc(EF, 'encarregado turma exemplo')).toBe('6x4');
    expect(turnoDoEnc(EF, 'ENCARREGADO PPU EXEMPLO', 'ppu')).toBe('ADM (07h30–17h24)');
    expect(turnoDoEnc(EF, 'ENCARREGADO TURMA EXEMPLO', '6x4')).toBe('');
  });
  it('status padrão', () => {
    expect(statusPadrao({ status: 'FÉRIAS' })).toBe('ferias');
    expect(statusPadrao({ status: 'INSS' })).toBe('afastado');
    expect(statusPadrao({ status: 'ATIVO' })).toBe('presente');
  });
  it('outra equipe quando o encarregado ou a modalidade não batem', () => {
    const D = { encarregado: 'ENCARREGADO EXTRA EXEMPLO', modalidade: 'extra' };
    expect(origemDe(EF, D, EF.colaboradores[5])).toBe('equipe');
    expect(origemDe(EF, D, EF.colaboradores[1])).toBe('outra');
  });
});

describe('rascunho', () => {
  it('PPU começa com um equipamento e a equipe presente do encarregado', () => {
    const D = novoDraft(EF, 'ENCARREGADO PPU EXEMPLO');
    garantirConteudo(EF, D);
    expect(D.modalidade).toBe('ppu');
    expect(D.equipamentos).toHaveLength(1);
    expect(D.equipamentos[0].equipe.map((p) => p.nome)).toContain('JATISTA UM');
  });
  it('extra começa com a equipe toda (férias já marcadas)', () => {
    const D = novoDraft(EF, 'ENCARREGADO EXTRA EXEMPLO');
    garantirConteudo(EF, D);
    expect(D.modalidade).toBe('extra');
    expect(D.pessoas.map((p) => p.status)).toEqual(['presente', 'presente', 'ferias']);
  });
  it('migra registros antigos (hor.dds → ddsIni, blocos faltando)', () => {
    const d = migrar({ equipamentos: [{ hor: { dds: '07:30' } }] });
    expect(d.equipamentos[0].hor).toEqual({ ddsIni: '07:30', ddsFim: '' });
    expect(d.equipamentos[0].prod.total).toBe('');
    expect(d.equipamentos[0].uid).toBeTruthy();
  });
  it('duplicar para hoje limpa horários, paradas, fotos e desobstruídos', () => {
    const r = { id: 'x', data: '2026-01-01', enviadoEm: 'y', equipamentos: [{ tag: 'A', hor: { ddsIni: '07:00' }, paradas: [{}], fotos: { antes: '1' }, prod: { desob: '9', total: '10' } }] };
    const D = duplicarParaHoje(r);
    expect(D.id).not.toBe('x');
    expect(D.enviadoEm).toBeUndefined();
    expect(D.equipamentos[0]).toMatchObject({ paradas: [], prod: { desob: '', total: '10' }, fotos: { antes: '', depois: '' } });
  });

});

describe('mapa', () => {
  const sheet = { viewBox: [0, 0, 100, 50], r: 4, deco: '<g></g>', tubes: [['1', 10, 10, ''], ['2', 20, 10, ''], ['3', 30, 10, '']] };
  it('conta e exporta o SVG com status e totais', () => {
    const est = { 1: 'desobstruido', 2: 'tamponado' };
    expect(contar(est, sheet)).toMatchObject({ desobstruido: 1, tamponado: 1, total: 3, semRegistro: 1 });
    const svg = exportSvg(sheet, est, { trocador: 'HE <1>', desobstruidosTurno: 1 });
    expect(svg).toContain('data-trocador="HE &lt;1&gt;"');
    expect(svg).toContain('data-tube="1" data-status="desobstruido"');
    expect(svg).toContain('data-desobstruidos="1"');
    expect(svg).toContain('data-desobstruidos-turno="1"');
  });
});
