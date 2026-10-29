import { useEffect, useRef, useState } from 'react';
import { useApp } from './estado.jsx';
import { Mapa } from './componentes/Mapa.jsx';
import { baixar, copiar, enviarWhats } from './lib/arquivos.js';
import { legendaMapa, mapaHtml, mapaPng } from './lib/mapaImagem.js';
import { useEnvio } from './componentes/useEnvio.js';
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
  const { D, dados, mapa, setMapa } = useApp();
  const enviar = useEnvio();
  if (!mapa) return null;
  const eq = D.equipamentos[mapa.i];
  const nome = `mapeamento-${slug(eq.tag)}-${D.data}-${slug(D.turno || 'turno')}`;
  const gerar = (est) => {
    const c = contar(est, mapa.sheet);
    const meta = { trocador: eq.tag, data: D.data, turno: D.turno, resp: D.encarregado, desenho: eq.desenho, desobstruidosTurno: Math.max(0, c.desobstruido - ((eq.mapaInicio && eq.mapaInicio.desobstruido) || 0)) };
    return { c, meta, svg: exportSvg(mapa.sheet, est, meta, dados.CAT.status) };
  };
  const chave = (tipo, est) => tipo + JSON.stringify(est);
  // O WhatsApp não envia SVG (tenta abrir como foto). Imagem: PNG. Arquivo: .html com o SVG dentro (vai como documento).
  const enviarImagem = (est) => enviar(chave('png', est), async () => {
    const { c, meta, svg } = gerar(est);
    const png = await mapaPng(svg, mapa.sheet, meta, c, dados.CAT.status);
    return { files: [new File([png], nome + '.png', { type: 'image/png' })], text: legendaMapa(meta, c) };
  });
  const enviarArquivo = (est) => enviar(chave('html', est), async () => {
    const { c, meta, svg } = gerar(est);
    return { files: [new File([mapaHtml(svg, meta, c)], nome + '.html', { type: 'text/html' })], text: legendaMapa(meta, c) };
  });
  const baixarSvg = (est) => baixar(new File([gerar(est).svg], nome + '.svg', { type: 'image/svg+xml' }));
  return (
    <Mapa sheet={mapa.sheet} estadoInicial={mapa.estado} statuses={dados.CAT.status} titulo={eq.tag}
      onChange={(est) => store.set(chaveMapa(eq), est)}
      onClose={(est) => { store.set(chaveMapa(eq), est); setMapa(null); }}
      onEnviarImagem={enviarImagem} onEnviarArquivo={enviarArquivo} onBaixarSvg={baixarSvg} />
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
