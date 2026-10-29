/* v0.3: lista de equipamentos importada, faltas na equipe PPU e fotos com legenda na mensagem. */
import { describe, expect, it } from 'vitest';
import { lerListaEquipamentos, mesclarEquipamentos, MODELO_CSV } from '../src/lib/equipamentos.js';
import { msgPPU, msgPresenca, validar } from '../src/lib/mensagens.js';
import { completarPelaTag, garantirConteudo, marcarPresencaPPU, novoDraft } from '../src/lib/rascunho.js';
import { fotosReferenciadas } from '../src/lib/fotos.js';
import EF from '../../dados/efetivo.exemplo.json';
import CAT from '../../desenhos/catalogo.json';

describe('lista de equipamentos', () => {
  it('lê CSV com ; (Excel em português), aspas e cabeçalho com acento', () => {
    const csv = '﻿TAG;Tipo;Área;Desenho;Tubos\nhe 41a-01b;Resfriamento a vácuo;"Precipitação; 41";resfriamento-a-vacuo--6-colmeias;894\n;;;;\nHE 41A-01B;Repetida;;;\n';
    const l = lerListaEquipamentos(csv, 'lista.csv');
    expect(l).toEqual([{ tag: 'HE 41A-01B', tipo: 'Repetida', area: '', desenho: '', }]);
    const l2 = lerListaEquipamentos('tag,tipo,tubos\nA-1,Aquecedor,"1.200"\n', 'x.csv');
    expect(l2[0]).toMatchObject({ tag: 'A-1', tipo: 'Aquecedor', tubos: 1200 });
  });
  it('lê colado do Excel (tabulação) e o modelo', () => {
    expect(lerListaEquipamentos('TAG\tTIPO\nAP-01\tAquecedor').map((x) => x.tag)).toEqual(['AP-01']);
    expect(lerListaEquipamentos(MODELO_CSV)[0]).toMatchObject({ tag: 'HE 41A-01A', tubos: 894 });
  });
  it('lê JSON no formato de trocadores.json e recusa arquivo sem TAG', () => {
    expect(lerListaEquipamentos('{"trocadores":[{"tag":"x-1","desenho":"d"}]}')[0]).toMatchObject({ tag: 'X-1', desenho: 'd' });
    expect(() => lerListaEquipamentos('nome;tipo\na;b')).toThrow(/tag/);
  });
  it('a importada completa e vence a do site na mesma TAG', () => {
    const m = mesclarEquipamentos([{ tag: 'HE 41A-01A', tipo: 'Resfriamento', area: 'P41', desenho: 'd1' }], [{ tag: 'he 41a-01a', tipo: '', area: 'Nova', desenho: '' }, { tag: 'B', tipo: 't' }]);
    expect(m).toEqual([{ tag: 'B', tipo: 't' }, { tag: 'he 41a-01a', tipo: 'Resfriamento', area: 'Nova', desenho: 'd1' }]);
  });
  it('TAG escolhida preenche desenho e total de tubos', () => {
    const eq = { tag: 'HE 41A-01A', desenho: '', prod: { total: '' } };
    completarPelaTag(eq, [{ tag: 'HE 41A-01A', desenho: 'resfriamento-a-vacuo--6-colmeias' }], CAT);
    expect(eq).toMatchObject({ desenho: 'resfriamento-a-vacuo--6-colmeias', prod: { total: '894' } });
  });
});

describe('faltas na equipe PPU', () => {
  const lancamento = () => {
    const D = novoDraft(EF, 'ENCARREGADO PPU EXEMPLO');
    garantirConteudo(EF, D);
    D.equipamentos[0].tag = 'HE 41A-01A';
    D.turno = 'ADM (07h30–17h24)';
    return D;
  };
  it('lista de presença vem com a equipe PPU e o equipamento com os presentes', () => {
    const D = lancamento();
    expect(D.pessoas.map((p) => p.nome)).toEqual(['ENCARREGADO PPU EXEMPLO', 'JATISTA UM', 'JATISTA DOIS', 'MOTORISTA OPERADOR UM']);
    expect(D.equipamentos[0].equipe).toHaveLength(4);
  });
  it('falta tira do equipamento e sugere onde deveria estar; presente devolve', () => {
    const D = lancamento();
    marcarPresencaPPU(D, 1, 'falta');
    expect(D.equipamentos[0].equipe.map((p) => p.nome)).not.toContain('JATISTA UM');
    expect(D.pessoas[1]).toMatchObject({ status: 'falta', deveria: 'HE 41A-01A' });
    expect(validar(D)).toContain('JATISTA UM: falta precisa de justificativa (ou toque em "Sem justificativa").');
    expect(validar(D)).not.toContain('JATISTA UM: informe onde deveria estar (TAG).');
    D.pessoas[1].deveria = '';
    expect(validar(D)).toContain('JATISTA UM: informe onde deveria estar (TAG).');
    marcarPresencaPPU(D, 1, 'presente');
    expect(D.equipamentos[0].equipe.map((p) => p.nome)).toContain('JATISTA UM');
    expect(D.pessoas[1]).toMatchObject({ status: 'presente', just: '', deveria: '' });
  });
  it('mensagem mostra a falta no equipamento e a presença no fim', () => {
    const D = lancamento();
    marcarPresencaPPU(D, 2, 'falta');
    D.pessoas[2].just = 'Atestado';
    marcarPresencaPPU(D, 3, 'ferias');
    const m = msgPPU(D);
    expect(m).toContain('❌ *Faltas:* JATISTA DOIS (Atestado)');
    expect(m).toContain('👥 *PRESENÇA DA EQUIPE PPU');
    expect(m).toContain('1. JATISTA DOIS – Mecanico Jatista – Deveria estar: HE 41A-01A – Justificativa: Atestado');
    expect(m).toContain('🏖️ *FÉRIAS / AFASTADOS (1)*');
    expect(m).not.toMatch(/Equipe:\* [^\n]*JATISTA DOIS/);
  });
});

describe('fotos com legenda', () => {
  it('entram no registro fotográfico do PPU e no fim da presença', () => {
    const eq = { tag: 'T', equipe: [], hor: {}, prod: {}, paradas: [], ativ: {}, fotos: { antes: '', depois: 'no grupo' },
      anexos: [{ id: 'a', momento: 'antes', legenda: 'Colmeia 2 suja' }, { id: 'b', momento: 'antes', legenda: '' }, { id: 'c', momento: '', legenda: 'Bico' }] };
    const m = msgPPU({ data: '2026-10-29', equipamentos: [eq] });
    expect(m).toContain('• Antes: 2 foto(s)\n• Depois: no grupo\n• Fotos anexadas: 3\n   1. (antes) Colmeia 2 suja\n   2. (antes) sem legenda\n   3. Bico');
    const p = msgPresenca({ modalidade: '6x4', pessoas: [], anexos: [{ id: 'z', momento: 'depois', legenda: 'Área limpa' }] });
    expect(p).toMatch(/📸 \*REGISTRO FOTOGRÁFICO\*\n• Fotos anexadas: 1\n {3}1\. \(depois\) Área limpa$/);
  });
  it('referências de fotos de rascunho e histórico', () => {
    const ids = fotosReferenciadas({ anexos: [{ id: '1' }], equipamentos: [{ anexos: [{ id: '2' }] }] }, [{ equipamentos: [{ anexos: [{ id: '3' }] }] }]);
    expect([...ids].sort()).toEqual(['1', '2', '3']);
  });
});
