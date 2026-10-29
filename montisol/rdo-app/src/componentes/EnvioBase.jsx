/* Ajustes › Envio para a base: chave de envio (fica só neste aparelho), testar envio e fila. */
import { useEffect, useState } from 'react';
import { useApp } from '../estado.jsx';
import { chaveDeEnvio, guardarChave, itensDaFila, processarFila, testarEnvio, URL_BASE } from '../lib/base.js';

export function EnvioBase() {
  const { versao, tocar, toast } = useApp();
  const guardada = chaveDeEnvio();
  const [editando, setEditando] = useState(!guardada);
  const [chave, setChave] = useState('');
  const [ver, setVer] = useState(false);
  const [teste, setTeste] = useState(null);
  const [fila, setFila] = useState([]);
  useEffect(() => { itensDaFila().then(setFila); }, [versao]);

  const salvar = () => {
    if (!chave.trim()) { toast('Digite a chave de envio'); return; }
    guardarChave(chave); setChave(''); setEditando(false); tocar();
    toast('Chave guardada neste aparelho');
    processarFila(tocar);
  };
  const testar = async () => {
    const c = editando ? chave.trim() : guardada;
    if (!c) { toast('Peça a chave de envio ao planejamento'); return; }
    setTeste({ testando: true });
    setTeste(await testarEnvio(c));
  };
  const mascarada = guardada ? guardada.slice(0, 2) + '•'.repeat(Math.max(4, guardada.length - 4)) + guardada.slice(-2) : '';

  return (
    <section className="card"><h2 className="sem-margem">Envio para a base</h2>
      <p className="dim pequeno">O lançamento vai para o planejamento conferir e aprovar; a base de medição só recebe o que foi aprovado. Sem internet, fica na fila deste aparelho e vai sozinho depois.</p>
      <label>Chave de envio</label>
      {editando ? (
        <div className="chave">
          <input type={ver ? 'text' : 'password'} value={chave} onChange={(e) => setChave(e.target.value)} placeholder="peça ao planejamento" autoComplete="off" autoCapitalize="off" spellCheck="false" />
          <button type="button" className="btn min" onClick={() => setVer(!ver)}>{ver ? 'Ocultar' : 'Mostrar'}</button>
        </div>
      ) : <p className="chave-guardada"><b>{mascarada}</b> <span className="dim pequeno">guardada neste aparelho</span></p>}
      <div className="linha">
        {editando ? <button type="button" className="btn pri" onClick={salvar}>Salvar chave</button>
          : <button type="button" className="btn" onClick={() => setEditando(true)}>Trocar chave</button>}
        {editando && guardada && <button type="button" className="btn min" onClick={() => setEditando(false)}>Cancelar</button>}
        <button type="button" className="btn" onClick={testar}>Testar envio</button>
      </div>
      {teste && (teste.testando
        ? <div className="resultado-teste">Testando…</div>
        : <div className={'resultado-teste ' + (teste.ok ? 'ok' : 'erro')} data-teste={teste.ok ? 'ok' : 'erro'}>{teste.ok ? '✔ ' : '✘ '}{teste.texto}</div>)}
      <p className="dim pequeno">Na fila deste aparelho: <b>{fila.length}</b>{fila.length ? ` · último erro: ${fila[fila.length - 1].ultimoErro || '—'}` : ''}</p>
      {fila.length > 0 && <div className="linha"><button type="button" className="btn" onClick={async () => { const r = await processarFila(tocar); toast(`${r.enviados} enviado(s), ${r.restantes} na fila`); }}>Reenviar agora</button></div>}
      <p className="dim pequeno">Endereço: {URL_BASE}</p>
    </section>
  );
}
