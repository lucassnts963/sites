/* Situação do envio do lançamento para a base: enviado em…, na fila ou erro. */
import { useApp } from '../estado.jsx';
import { statusDe } from '../lib/base.js';

const quando = (iso) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** Texto e classe da situação (null se nunca foi para a base). */
export function situacaoBase(lid) {
  const st = statusDe(lid);
  if (!st) return null;
  if (st.status === 'enviado') return { classe: 'ok', texto: `base: enviado em ${quando(st.enviadoEm)}` };
  if (st.status === 'erro') return { classe: 'erro', texto: `base: na fila · ${st.erro}` };
  return { classe: 'fila', texto: `base: na fila${st.erro ? ' · ' + st.erro : ''}` };
}

export function StatusBase({ lid, etiqueta }) {
  useApp(); // relê quando a fila muda (versao no contexto)
  const s = situacaoBase(lid);
  if (!s) return etiqueta ? null : <p className="status-base">Ainda não foi para a base.</p>;
  return etiqueta ? <span className={'tag ' + s.classe}>{s.texto}</span> : <p className={'status-base ' + s.classe} data-status-base={s.classe}>{s.texto}</p>;
}
