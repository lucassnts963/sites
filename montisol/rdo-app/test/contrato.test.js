/* Contrato v1 do envio para a base: nomes de campo exatamente como combinados com o fluxo do n8n. */
import { describe, expect, it } from 'vitest';
import { frenteDoEnc, horarioDoLancamento, montarEnvio, novoUuid } from '../src/lib/contrato.js';
import { mensagem } from '../src/lib/mensagens.js';
import { garantirConteudo, marcarPresencaPPU, novoDraft } from '../src/lib/rascunho.js';
import EF from '../../dados/efetivo.exemplo.json';

// Modelo do pedido (estrutura e nomes; valores são só exemplo)
const MODELO = {
  versao: 1, id: '', app_versao: '', enviado_em: '',
  lancamento: {
    data: '', turno: '', modalidade: '', encarregado: '', frente: '', inicio: '', termino: '',
    equipamentos: [{ tag: '', servico: '', equipe: [''], hor: { ddsIni: '', ddsFim: '', lib: '', ini: '', fim: '' },
      prod: { total: 0, mapeados: 0, desob: 0, acum: 0, pend: 0, tamp: 0 },
      paradas: [{ resp: '', motivo: '', ini: '', fim: '', impacto: '' }], ativ: { servico: '', situacao: '', pend: '', prox: '' } }],
    pessoas: [{ nome: '', funcao: '', status: '', just: '', deveria: '', origem: '', hn: null, he65: null, he100: null, adn: null }],
    os_executadas: [''], os_canceladas: [''], atividades: '', obs: '', fotos: [{ momento: '', legenda: '' }],
  },
  texto_whatsapp: '',
};
/** Caminhos de todas as chaves (listas viram [] e seguem pelo primeiro item). */
function chaves(o, pre = '') {
  if (Array.isArray(o)) return o.length && typeof o[0] === 'object' && o[0] ? chaves(o[0], pre + '[]') : [pre];
  if (o && typeof o === 'object') return Object.keys(o).flatMap((k) => [pre + '.' + k, ...chaves(o[k], pre + '.' + k)]);
  return [];
}

function lancamentoPPU() {
  const D = novoDraft(EF, 'ENCARREGADO PPU EXEMPLO');
  garantirConteudo(EF, D);
  D.turno = 'ADM (07h30–17h24)';
  const eq = D.equipamentos[0];
  Object.assign(eq, { tag: 'HE-41B-01C', servico: 'desobstrucao' });
  Object.assign(eq.hor, { ddsIni: '07:30', ddsFim: '07:45', lib: '08:00', ini: '08:20', fim: '16:40' });
  Object.assign(eq.prod, { total: '894', mapeados: '300', desob: '40', acum: '120', pend: '180', tamp: '' });
  eq.paradas = [{ resp: 'Hydro', motivo: 'Aguardando liberação', ini: '10:00', fim: '10:30', impacto: 'sim' }];
  eq.ativ = { servico: 'Desobstrução colmeia 2', situacao: 'Em andamento', pend: '', prox: 'HE-41B-01D' };
  eq.anexos = [{ id: 'f1', momento: 'antes', legenda: 'Colmeia 2 suja' }, { id: 'f2', momento: '', legenda: '' }];
  marcarPresencaPPU(D, 2, 'falta');
  D.pessoas[2].just = 'Atestado';
  return D;
}

describe('contrato v1', () => {
  it('tem exatamente os campos do modelo (PPU)', () => {
    const c = montarEnvio(lancamentoPPU(), EF, { id: 'u-1', appVersao: '0.5.0', agora: new Date('2026-10-29T18:00:00Z') });
    expect(chaves(c).sort()).toEqual(chaves(MODELO).sort());
    expect(c).toMatchObject({ versao: 1, id: 'u-1', app_versao: '0.5.0', enviado_em: '2026-10-29T18:00:00.000Z' });
  });

  it('preenche o lançamento PPU como o app tem', () => {
    const D = lancamentoPPU();
    const { lancamento: l, texto_whatsapp } = montarEnvio(D, EF, { id: 'u', appVersao: 'x' });
    expect(l).toMatchObject({ modalidade: 'ppu', encarregado: 'ENCARREGADO PPU EXEMPLO', frente: 'DESOBSTRUÇÃO', inicio: '07:30', termino: '16:40', turno: 'ADM (07h30–17h24)' });
    const e = l.equipamentos[0];
    expect(e).toMatchObject({ tag: 'HE-41B-01C', servico: 'desobstrucao', hor: { ddsIni: '07:30', fim: '16:40' } });
    expect(e.equipe).not.toContain('JATISTA DOIS'); // faltou: saiu da equipe do equipamento
    // números como número; o que não foi preenchido vai null (não vira 0)
    expect(e.prod).toEqual({ total: 894, mapeados: 300, desob: 40, acum: 120, pend: 180, tamp: null });
    expect(e.paradas[0]).toEqual({ resp: 'Hydro', motivo: 'Aguardando liberação', ini: '10:00', fim: '10:30', impacto: 'sim' });
    const falta = l.pessoas.find((p) => p.nome === 'JATISTA DOIS');
    expect(falta).toEqual({ nome: 'JATISTA DOIS', funcao: 'MECANICO JATISTA', status: 'falta', just: 'Atestado', deveria: 'HE-41B-01C', origem: 'equipe', hn: null, he65: null, he100: null, adn: null });
    expect(l.pessoas.filter((p) => p.status === 'presente').every((p) => p.deveria === '' && p.just === '')).toBe(true);
    // horas por pessoa nunca são inventadas
    expect(l.pessoas.every((p) => p.hn === null && p.he65 === null && p.he100 === null && p.adn === null)).toBe(true);
    // fotos: só momento e legenda (sem imagem nem id)
    expect(l.fotos).toEqual([{ momento: 'antes', legenda: 'Colmeia 2 suja' }, { momento: null, legenda: '' }]);
    expect(l).toMatchObject({ os_executadas: [], os_canceladas: [], atividades: '' });
    expect(texto_whatsapp).toBe(mensagem(D));
  });

  it('extra: OS por linha, atividades, sem equipamentos; horário informado no cabeçalho vence', () => {
    const D = novoDraft(EF, 'ENCARREGADO EXTRA EXEMPLO');
    garantirConteudo(EF, D);
    Object.assign(D, { turno: 'ADM', inicio: '07:00', termino: '16:00', atividades: 'Limpeza', osExec: '4012345 – limpeza\n\n4012346', osCanc: '4012399 – área não liberada',
      anexos: [{ id: 'a', momento: 'depois', legenda: 'Área limpa' }] });
    const { lancamento: l } = montarEnvio(D, EF, { id: 'u', appVersao: 'x' });
    expect(l).toMatchObject({ modalidade: 'extra', frente: 'DESCONTAMINAÇÃO', inicio: '07:00', termino: '16:00', equipamentos: [],
      os_executadas: ['4012345 – limpeza', '4012346'], os_canceladas: ['4012399 – área não liberada'], atividades: 'Limpeza', fotos: [{ momento: 'depois', legenda: 'Área limpa' }] });
    expect(l.pessoas.map((p) => p.status)).toEqual(['presente', 'presente', 'ferias']);
    expect(l.pessoas.every((p) => p.deveria === '')).toBe(true);
  });

  it('frente e horário derivados', () => {
    expect(frenteDoEnc(EF, 'ENCARREGADO TURMA EXEMPLO', '6x4')).toBe('LAVAGEM ÁCIDA-6X4');
    expect(frenteDoEnc(EF, 'NINGUÉM', 'ppu')).toBe('');
    expect(horarioDoLancamento({ modalidade: '6x4' })).toEqual({ inicio: '', termino: '' });
    expect(horarioDoLancamento({ modalidade: 'ppu', equipamentos: [{ hor: { ddsIni: '08:00', fim: '12:00' } }, { hor: { ddsIni: '07:40', fim: '17:10' } }] })).toEqual({ inicio: '07:40', termino: '17:10' });
  });

  it('uuid v4', () => {
    const a = novoUuid(), b = novoUuid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
