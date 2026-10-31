import { useEffect, useRef, useState } from 'react';
import { useApp } from './estado.jsx';
import { Mapa } from './componentes/Mapa.jsx';
import { OfertaArquivos } from './componentes/OfertaArquivos.jsx';
import { AvisoArmazenamento } from './componentes/AvisoArmazenamento.jsx';
import { baixar, copiar, enviarWhats } from './lib/arquivos.js';
import { legendaMapa, mapaHtml, mapaPng } from './lib/mapaImagem.js';
import { useEnvio } from './componentes/useEnvio.js';
import { MARCA, MOD_TXT } from './lib/constantes.js';
import { contar, exportSvg } from './lib/mapa.js';
import { gravarMapa, importarPassagem, lerMapa, montarPassagem } from './lib/passagem.js';
import { codigoPassagem, confirmacaoPassagem, desobNoTurno, lerPassagem } from './lib/turnos.js';
import { dataBR, slug } from './lib/texto.js';
import { Config } from './telas/Config.jsx';
import { Historico } from './telas/Historico.jsx';
import { Lancar } from './telas/Lancar.jsx';
import { Pesquisar } from './telas/Pesquisar.jsx';

// ícones de linha da marca (versão preta, para fundo claro)
const ABAS = [['lancar', 'ferramentas', 'Lançar'], ['pesquisar', 'lupa', 'Pesquisar'], ['historico', 'calendario', 'Histórico'], ['config', 'engrenagem', 'Ajustes']];

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
          <button type="button" className="btn" onClick={async () => { toast(await copiar(mensagem.msg) ? 'Mensagem copiada' : 'Não deu para copiar aqui: selecione o texto acima e copie'); }}>📋 Copiar</button>
          <button type="button" className="btn wa" disabled={erros.length > 0}
            onClick={async () => { salvarRegistro({ enviadoEm: new Date().toISOString() }); const r = await enviarWhats(mensagem.msg); toast(r.aviso); }}>📲 WhatsApp</button>
          <span className="sp" />
          <button type="button" className="btn" onClick={() => setMensagem(null)}>Fechar</button>
        </div>
      </>}
    </dialog>
  );
}

/** Abre o editor do espelho do equipamento escolhido e guarda o mapa por TAG + desenho. */
function EditorMapa() {
  const { D, dados, mapa, setMapa, toast, tocar } = useApp();
  const enviar = useEnvio();
  if (!mapa) return null;
  const eq = D.equipamentos[mapa.i];
  const nome = `mapeamento-${slug(eq.tag)}-${D.data}-${slug(D.turno || 'turno')}`;
  const gerar = (est) => {
    const c = contar(est, mapa.sheet);
    const meta = { trocador: eq.tag, data: D.data, turno: D.turno, resp: D.encarregado, desenho: eq.desenho, desobstruidosTurno: desobNoTurno(est, lerMapa(eq.tag, eq.desenho).ts, D.id) };
    return { c, meta, svg: exportSvg(mapa.sheet, est, meta, dados.CAT.status) };
  };
  const chave = (tipo, est) => tipo + JSON.stringify(est);
  // O WhatsApp não envia SVG (tenta abrir como foto). Imagem: PNG. Arquivo: .html com o SVG dentro (vai como documento).
  const enviarImagem = (est) => enviar(chave('png', est), async () => {
    const { c, meta, svg } = gerar(est);
    const png = await mapaPng(svg, mapa.sheet, meta, c, dados.CAT.status);
    return { titulo: 'Imagem do mapa', files: [new File([png], nome + '.png', { type: 'image/png' })], text: legendaMapa(meta, c) };
  });
  const enviarArquivo = (est) => enviar(chave('html', est), async () => {
    const { c, meta, svg } = gerar(est);
    const p = montarPassagem(eq.tag, eq.desenho, D.encarregado);
    return { titulo: 'Mapa (documento com o SVG)', files: [new File([mapaHtml(svg, meta, c, p)], nome + '.html', { type: 'text/html' })], text: legendaMapa(meta, c), codigo: legendaMapa(meta, c) + '\n\n' + codigoPassagem(p) };
  });
  const baixarSvg = (est) => baixar(new File([gerar(est).svg], nome + '.svg', { type: 'image/svg+xml' }));
  return (
    <Mapa sheet={mapa.sheet} estadoInicial={mapa.estado} statuses={dados.CAT.status} titulo={eq.tag}
      onChange={(est, op) => gravarMapa(eq.tag, eq.desenho, est, { lid: op && op.importado ? 'importado' : D.id, autor: D.encarregado })}
      onClose={(est) => { gravarMapa(eq.tag, eq.desenho, est, { lid: D.id, autor: D.encarregado }); setMapa(null); tocar(); }}
      aoImportar={(texto) => {
        const p = lerPassagem(texto);
        if (!p) return null;
        if (p.tag && p.tag.toUpperCase() !== eq.tag.toUpperCase()) { toast(`Esta passagem é da TAG ${p.tag}`); return false; }
        if (!confirm(confirmacaoPassagem(p))) return false;
        const r = importarPassagem(p);
        toast(`Passagem de ${r.de || 'outro aparelho'} recebida: ${r.tubos} tubo(s) atualizado(s), ${r.turnosNovos} turno(s) novo(s)`);
        tocar();
        return lerMapa(eq.tag, eq.desenho).estado;
      }}
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
          <img className="logo" src={MARCA + 'logo-horizontal-branco.png'} alt="Montisol" width="134" height="24" />
          <small><b>RDO de campo</b> · Trocador de Calor · Hydro Alunorte</small>
        </div>
        {D && tela === 'lancar' && <span className="chip-topo">{MOD_TXT[D.modalidade].split(' ')[0]} · {dataBR(D.data).slice(0, 5)}</span>}
        {dados && (dados.fonte === 'exemplo' || dados.fonte === 'vazio') && <span className="aviso-dados">dados de exemplo</span>}
      </header>

      <AvisoArmazenamento />
      <main>
        {!D ? <div className="abertura"><div><img src={MARCA + 'logo-vertical-colorido.png'} alt="Montisol" /><p>RDO de campo · carregando…</p></div></div>
          : tela === 'lancar' ? <Lancar />
            : tela === 'pesquisar' ? <Pesquisar q={q} setQ={setQ} />
              : tela === 'historico' ? <Historico irPara={irPara} />
                : <Config />}
      </main>

      <nav className="abas">
        {ABAS.map(([id, ic, rot]) => (
          <button type="button" key={id} className={tela === id ? 'on' : ''} onClick={() => irPara(id)} aria-current={tela === id ? 'page' : undefined}>
            <img src={`${MARCA}icones/${ic}-preto.png`} alt="" /><span>{rot}</span>
          </button>
        ))}
      </nav>

      {D && <EditorMapa />}
      <MensagemDialog />
      <OfertaArquivos />
      <Toast />
    </>
  );
}
