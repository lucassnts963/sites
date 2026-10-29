/* Regras de toque no espelho (sem DOM, testadas em test/gestos.test.js).
   Modos do editor: 'move' (Mover: navegar, arrastar, zoom; o toque NUNCA marca tubo) e 'mark' (Marcar: o toque marca).
   O mapa sempre abre em 'move', o modo seguro: marcar é escolha do encarregado. */

export const MODO_INICIAL = 'move';
export const MODOS = {
  move: { rotulo: 'Mover', aviso: 'Mover: toque nos tubos desativado' },
  mark: { rotulo: 'Marcar', aviso: 'Marcar: o toque marca o tubo' },
};

/** O que fazer quando um dedo (ou o mouse) encosta no mapa.
    - 'pinca': já há outro dedo na tela (zoom de dois dedos), em qualquer modo;
    - 'pintar': só em Marcar, começando sobre um tubo, com o botão principal (dedo ou clique esquerdo);
    - 'arrastar': o resto (navegar). */
export function gestoAoTocar({ modo, sobreTubo, botao = 0, dedos = 1 }) {
  if (dedos >= 2) return 'pinca';
  if (modo === 'mark' && sobreTubo && botao === 0) return 'pintar';
  return 'arrastar';
}

/** Ao soltar: grava a pintura só se o gesto continuou sendo pintura em Marcar do começo ao fim. */
export const gravarPintura = ({ modoNoInicio, modoAgora, cancelado }) => !cancelado && modoNoInicio === 'mark' && modoAgora === 'mark';

/** Novo status do tubo tocado em Marcar: o pincel; tocar de novo um tubo já com o mesmo status limpa. */
export const statusAoPintar = (atual, pincel) => ((atual || '') === pincel ? '' : pincel);
