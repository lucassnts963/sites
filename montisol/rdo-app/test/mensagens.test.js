/* As mensagens do WhatsApp e a validação precisam sair idênticas às da versão 0.1 (test/legado/app.legado.cjs). */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { msgPPU, msgPresenca, validar } from '../src/lib/mensagens.js';
import { cap, norm, normTag } from '../src/lib/texto.js';
import { minutos, resumoParadas } from '../src/lib/tempo.js';

const legado = createRequire(import.meta.url)('./legado/app.legado.cjs');

const eqBase = (x = {}) => ({
  tag: 'HE 41A-01A', desenho: 'resfriamento-a-vacuo--6-colmeias', aqs: 'sim', aqsRef: 'AQS-123',
  equipe: [{ nome: 'JATISTA UM', origem: 'equipe' }, { nome: 'FULANO', origem: 'manual', contrato: 'Desincrustação' }, { nome: 'BELTRANO', origem: 'manual', contrato: '' }],
  hor: { ddsIni: '07:30', ddsFim: '07:45', lib: '08:10', ini: '08:30', fim: '16:50' },
  prod: { total: '894', mapeados: '300', desob: '120', pend: '180', tamp: '4' },
  paradas: [
    { resp: 'Hydro', motivo: 'Falta de liberação', ini: '10:00', fim: '10:40', impacto: 'sim' },
    { resp: 'Montisol', motivo: 'Troca de bico', ini: '23:50', fim: '00:20', impacto: 'nao' },
    { resp: '', motivo: 'sem horário', ini: '', fim: '', impacto: '' },
  ],
  ativ: { servico: 'Desobstrução colmeia 2', situacao: 'Em andamento', pend: '', prox: 'HE 41A-01B' },
  fotos: { antes: '4 fotos', depois: '' },
  ...x,
});

const casosPPU = [
  { data: '2026-10-28', turno: 'ADM (07h30–17h24)', encarregado: 'ENC', modalidade: 'ppu', equipamentos: [eqBase()] },
  { data: '2026-10-28', turno: 'Noite (23h00–07h30)', encarregado: 'ENC', modalidade: 'ppu', equipamentos: [eqBase({ paradas: [], aqs: 'nao' }), eqBase({ tag: '', equipe: [], hor: { ddsIni: '', ddsFim: '', lib: '', ini: '', fim: '' } })] },
  { data: '', turno: '', encarregado: '', modalidade: 'ppu', equipamentos: [] },
];

const pessoas = [
  { nome: 'MECANICO UM', funcao: 'MECANICO MONTADOR', frente: 'DESCONTAMINAÇÃO', origem: 'equipe', status: 'presente', just: '' },
  { nome: 'MECANICO DOIS', funcao: 'MECANICO MONTADOR', frente: 'DESCONTAMINAÇÃO', origem: 'equipe', status: 'falta', just: 'Atestado' },
  { nome: 'MECANICO TRES', funcao: '', frente: '', origem: 'equipe', status: 'falta', just: '' },
  { nome: 'OUTRO', funcao: 'CALDEIREIRO II', frente: 'DIGESTÃO - FIXA', origem: 'outra', status: 'presente', just: '' },
  { nome: 'VISITA', funcao: '', frente: '', origem: 'manual', contrato: 'Desincrustação', status: 'ferias', just: '' },
  { nome: 'SEM STATUS', funcao: '', frente: '', origem: 'equipe', status: '', just: '' },
];
const casosPresenca = [
  { data: '2026-10-28', turno: 'ADM', encarregado: 'ENC EXTRA', modalidade: 'extra', pessoas, atividades: 'Limpeza', osExec: '4012345 – limpeza\n\n4012346', osCanc: '' },
  { data: '2026-10-28', turno: 'Turno 07h–15h', encarregado: 'ENC 6x4', modalidade: '6x4', pessoas: pessoas.slice(0, 1), obs: 'Tudo certo' },
  { data: '2026-10-28', turno: '', encarregado: 'ENC 6x4', modalidade: '6x4', pessoas: [], obs: '' },
];

describe('mensagens iguais à versão 0.1', () => {
  it.each(casosPPU.map((d, i) => [i, d]))('PPU caso %i', (_, d) => {
    expect(msgPPU(d)).toBe(legado.msgPPU(d));
    expect(validar(d)).toEqual(legado.validar(d));
  });
  it.each(casosPresenca.map((d, i) => [i, d]))('presença caso %i', (_, d) => {
    expect(msgPresenca(d)).toBe(legado.msgPresenca(d));
    expect(validar(d)).toEqual(legado.validar(d));
  });
});

describe('utilidades', () => {
  it('minutos passa da meia-noite', () => {
    expect(minutos('23:50', '00:20')).toBe(30);
    expect(minutos('', '10:00')).toBeNull();
  });
  it('resumo das paradas separa Hydro e Montisol', () => {
    expect(resumoParadas(eqBase().paradas)).toEqual({ total: 70, hydro: 40, montisol: 30, semHorario: 1 });
    expect(resumoParadas(eqBase().paradas)).toEqual(legado.resumoParadas(eqBase().paradas));
  });
  it('texto igual ao legado', () => {
    for (const s of ['  Desobstrução  ', 'HE 41a_01A', 'caldeireiro ii', 'MOT. OPERADOR DE HIDROJATO']) {
      expect(norm(s)).toBe(legado.norm(s));
      expect(normTag(s)).toBe(legado.normTag(s));
      expect(cap(s)).toBe(legado.cap(s));
    }
  });
});
