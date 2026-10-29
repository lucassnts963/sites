import { useEffect, useRef, useState } from 'react';
import { useApp } from './estado.jsx';
import { Mapa } from './componentes/Mapa.jsx';
import { compartilharArquivo, copiar, enviarWhats } from './lib/arquivos.js';
import { MOD_TXT } from './lib/constantes.js';
import { contar, exportSvg } from './lib/mapa.js';
import { chaveMapa, store } from './lib/store.js';
import { dataBR, slug } from './lib/texto.js';
import { Config } from './telas/Config.jsx';
import { Historico } from './telas/Historico.jsx';
import { Lancar } from './telas/Lancar.jsx';
import { Pesquisar } from './telas/Pesquisar.jsx';

const ABAS = [['lancar', '📝', 'Lançar'], ['pesquisar', '🔎', 'Pesquisar'], ['historico', '🗂️', 'Histórico'], ['config', '⚙️', 'Config']];

function Toast() {
  const { aviso } = useApp();
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    if (!aviso.n) return undefined;
    setVisivel(true);
    const t = setTimeout(() => setVisivel(false), 2400);
    return () => clearTimeout(t);
  }, [aviso]);
  return <div id="toast" className={visivel ? 'show' : ''}>{aviso.texto}</div>;
}

function MensagemDialog() {
  const { mensagem, setMensagem, salvarRegistro, toast } = useApp();
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (mensagem && !d.open) d.showModal();
    if (!mensagem && d.open) d.close();
  }, [mensagem]);
  const erros = (mensagem && mensagem.erros) || [];
  return (
    <dialog ref={ref} onClose={() => setMensagem(null)}>
      {mensagem && <>
        {erros.length > 0 && <div className="card erro"><b>Falta completar:</b><ul>{erros.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        <pre className="msg">{mensagem.msg}</pre>
        <div className="linha">
          <button type="button" className="btn" onClick={async () => { await copiar(mensagem.msg); toast('Mensagem copiada'); }}>📋 Copiar</button>
          <button type="button" className="btn wa" disabled={erros.length > 0}
            onClick={() => { salvarRegistro({ enviadoEm: new Date().toISOString() }); toast(enviarWhats(mensagem.msg)); }}>📲 WhatsApp</button>
          <span className="sp" />
          <button type="button" className="btn" onClick={() => setMensagem(null)}>Fechar</button>
        </div>
      </>}
    </dialog>
  );
}

/** Abre o editor do espelho do equipamento escolhido e guarda o mapa por TAG + desenho. */
function EditorMapa() {
  const { D, dados, mapa, setMapa, toast } = useApp();
  if (!mapa) return null;
  const eq = D.equipamentos[mapa.i];
  const exportar = async (est) => {
    const c = contar(est, mapa.sheet);
    const turno = Math.max(0, c.desobstruido - ((eq.mapaInicio && eq.mapaInicio.desobstruido) || 0));
    const svg = exportSvg(mapa.sheet, est, { trocador: eq.tag, data: D.data, resp: D.encarregado, desenho: eq.desenho, desobstruidosTurno: turno }, dados.CAT.status);
    toast(await compartilharArquivo(`mapeamento-${slug(eq.tag)}-${D.data}-${slug(D.turno || 'turno')}.svg`, svg, 'image/svg+xml'));
  };
  return (
    <Mapa sheet={mapa.sheet} estadoInicial={mapa.estado} statuses={dados.CAT.status} titulo={eq.tag}
      onChange={(est) => store.set(chaveMapa(eq), est)}
      onClose={(est) => { store.set(chaveMapa(eq), est); setMapa(null); }}
      onExport={exportar} />
  );
}

export function App() {
  const { dados, D } = useApp();
  const [tela, setTela] = useState('lancar');
  const [q, setQ] = useState('');
  const irPara = (t) => { setTela(t); window.scrollTo(0, 0); };

  return (
    <>
      <header className="topo">
        <div>
          <b>RDO de campo</b>
          <small>Montisol · Trocador de Calor · Hydro Alunorte</small>
        </div>
        {D && tela === 'lancar' && <span className="chip-topo">{MOD_TXT[D.modalidade].split(' ')[0]} · {dataBR(D.data).slice(0, 5)}</span>}
        {dados && (dados.fonte === 'exemplo' || dados.fonte === 'vazio') && <span className="aviso-dados">dados de exemplo</span>}
      </header>

      <main>
        {!D ? <p className="dim carregando">Carregando…</p>
          : tela === 'lancar' ? <Lancar />
            : tela === 'pesquisar' ? <Pesquisar q={q} setQ={setQ} />
              : tela === 'historico' ? <Historico irPara={irPara} />
                : <Config />}
      </main>

      <nav className="abas">
        {ABAS.map(([id, ic, rot]) => <button type="button" key={id} className={tela === id ? 'on' : ''} onClick={() => irPara(id)}>{ic}<span>{rot}</span></button>)}
      </nav>

      {D && <EditorMapa />}
      <MensagemDialog />
      <Toast />
    </>
  );
}
