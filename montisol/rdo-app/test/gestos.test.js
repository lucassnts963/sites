/* Gestos no espelho: em Mover nada marca tubo; só em Marcar o toque marca. */
import { describe, expect, it } from 'vitest';
import { gestoAoTocar, gravarPintura, MODO_INICIAL, MODOS, statusAoPintar } from '../src/lib/gestos.js';
import { confirmacaoPassagem } from '../src/lib/turnos.js';

describe('modo inicial', () => {
  it('o mapa abre em Mover (não marca)', () => {
    expect(MODO_INICIAL).toBe('move');
    expect(MODOS.move.aviso).toBe('Mover: toque nos tubos desativado');
  });
});

describe('Mover: nenhum gesto marca tubo', () => {
  const casos = [
    ['toque simples num tubo', { sobreTubo: true }],
    ['toque fora dos tubos', { sobreTubo: false }],
    ['clique com outro botão do mouse', { sobreTubo: true, botao: 2 }],
    ['segundo dedo (pinça)', { sobreTubo: true, dedos: 2 }],
  ];
  it.each(casos)('%s', (_, x) => {
    expect(gestoAoTocar({ modo: 'move', ...x })).not.toBe('pintar');
  });
  it('arrasto começa como navegação, nunca como pintura', () => {
    expect(gestoAoTocar({ modo: 'move', sobreTubo: true })).toBe('arrastar');
  });
  it('toque duplo: cada toque é avaliado de novo e nenhum pinta', () => {
    expect([1, 2].map(() => gestoAoTocar({ modo: 'move', sobreTubo: true }))).toEqual(['arrastar', 'arrastar']);
  });
  it('pintura que começou em Marcar e terminou em Mover não é gravada', () => {
    expect(gravarPintura({ modoNoInicio: 'mark', modoAgora: 'move' })).toBe(false);
    expect(gravarPintura({ modoNoInicio: 'move', modoAgora: 'move' })).toBe(false);
  });
});

describe('Marcar', () => {
  it('toque num tubo pinta', () => {
    expect(gestoAoTocar({ modo: 'mark', sobreTubo: true })).toBe('pintar');
  });
  it('arrasto começando fora dos tubos navega (não pinta por engano)', () => {
    expect(gestoAoTocar({ modo: 'mark', sobreTubo: false })).toBe('arrastar');
  });
  it('dois dedos viram pinça (zoom) e a pintura começada é cancelada', () => {
    expect(gestoAoTocar({ modo: 'mark', sobreTubo: true, dedos: 2 })).toBe('pinca');
    expect(gravarPintura({ modoNoInicio: 'mark', modoAgora: 'mark', cancelado: true })).toBe(false);
  });
  it('clique direito não pinta', () => {
    expect(gestoAoTocar({ modo: 'mark', sobreTubo: true, botao: 2 })).toBe('arrastar');
  });
  it('grava ao soltar quando ficou em Marcar', () => {
    expect(gravarPintura({ modoNoInicio: 'mark', modoAgora: 'mark' })).toBe(true);
  });
  it('pincel: marca; tocar de novo com o mesmo status limpa', () => {
    expect(statusAoPintar('', 'desobstruido')).toBe('desobstruido');
    expect(statusAoPintar('obstruido', 'desobstruido')).toBe('desobstruido');
    expect(statusAoPintar('desobstruido', 'desobstruido')).toBe('');
  });
});

describe('ações em massa', () => {
  it('confirmação da passagem resume o que vai entrar', () => {
    const t = confirmacaoPassagem({ de: 'ENC TARDE', tag: 'HE 41A-01A', geradoEm: '2026-10-29T18:05:00', mapa: { estado: { a: 'x', b: 'y' } }, turnos: [{}] });
    expect(t).toMatch(/^Juntar a passagem de turno de ENC TARDE em 29\/10 18:05 \(HE 41A-01A: 2 tubo\(s\) marcados, 1 turno\(s\)\)/);
  });
});
