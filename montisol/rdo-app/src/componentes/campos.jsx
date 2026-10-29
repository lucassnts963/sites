/* Campos ligados a um caminho do rascunho (ex.: "equipamentos.0.hor.ddsIni"). */
import { useApp } from '../estado.jsx';
import { getPath, setPath } from '../lib/texto.js';

const valorDe = (D, k) => { const x = getPath(D, k); return x == null ? '' : x; };

export function Campo({ rot, k, tipo = 'text', aoMudar, ...resto }) {
  const { D, mudar } = useApp();
  const onChange = (e) => { const val = e.target.value; mudar((d) => { setPath(d, k, val); if (aoMudar) aoMudar(d, val); }); };
  return (
    <div>
      <label>{rot}</label>
      <input type={tipo} value={valorDe(D, k)} onChange={onChange} {...resto} />
    </div>
  );
}

export function Numero(props) {
  return <Campo tipo="number" inputMode="numeric" min="0" {...props} />;
}

export function Area({ rot, k, placeholder }) {
  const { D, mudar } = useApp();
  return (
    <>
      <label>{rot}</label>
      <textarea value={valorDe(D, k)} placeholder={placeholder} onChange={(e) => { const val = e.target.value; mudar((d) => setPath(d, k, val)); }} />
    </>
  );
}

/** Botões de escolha única. opcoes = [[valor, rótulo]]. */
export function Seg({ k, opcoes, aoMudar }) {
  const { D, mudar } = useApp();
  const atual = getPath(D, k);
  return (
    <div className="seg">
      {opcoes.map(([val, rot]) => (
        <button key={val} type="button" className={atual === val ? 'on' : ''}
          onClick={() => mudar((d) => { setPath(d, k, val); if (aoMudar) aoMudar(d, val); })}>{rot}</button>
      ))}
    </div>
  );
}

export const Sp = () => <span className="sp" />;
