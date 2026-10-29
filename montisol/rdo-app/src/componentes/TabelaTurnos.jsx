/* Histórico turno a turno de uma TAG (deste aparelho e das passagens recebidas). */
import { dataBR } from '../lib/texto.js';

const curto = (t) => String(t || '').split(' ')[0] || '—';
const primeiro = (n) => String(n || '').split(' ')[0] || '—';

export function TabelaTurnos({ turnos, lid }) {
  if (!turnos.length) return <p className="dim pequeno">Nenhum turno registrado ainda (salve ou envie o lançamento).</p>;
  return (
    <div className="tabela-rolagem">
      <table className="turnos">
        <thead><tr><th>Data</th><th>Turno</th><th>Encarregado</th><th>Desob.</th><th>Acum.</th><th>Pend.</th><th>Tamp.</th></tr></thead>
        <tbody>
          {turnos.map((t) => (
            <tr key={t.id} className={t.lid === lid ? 'este' : ''} title={t.encarregado}>
              <td>{dataBR(t.data).slice(0, 5)}</td><td>{curto(t.turno)}</td><td>{primeiro(t.encarregado)}</td>
              <td><b>{t.desobTurno || 0}</b></td><td>{t.acum || '—'}</td><td>{t.pend || '—'}</td><td>{t.tamp || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
