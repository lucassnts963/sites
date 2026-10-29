/* Tela "Lançar": cabeçalho (encarregado, data, turno, tipo de equipe), formulário da modalidade e barra de ações. */
import { useApp } from '../estado.jsx';
import { Campo, Seg, Sp } from '../componentes/campos.jsx';
import { enviarWhats } from '../lib/arquivos.js';
import { turnosDe } from '../lib/constantes.js';
import { encarregados, modalidadeDoEnc, turnoDoEnc } from '../lib/efetivo.js';
import { mensagem, validar } from '../lib/mensagens.js';
import { garantirConteudo, novoDraft, novoEq, preencherEquipe } from '../lib/rascunho.js';
import { dataBR, hoje, norm } from '../lib/texto.js';
import { FormPPU } from './FormPPU.jsx';
import { FormPresenca } from './FormPresenca.jsx';
import { arquivosDasFotos, rodapeDe, textoDasFotos } from '../componentes/Fotos.jsx';
import { useEnvio } from '../componentes/useEnvio.js';
import { slug } from '../lib/texto.js';

/** Grupos de fotos do lançamento: um por equipamento (PPU) e o do lançamento. */
const gruposDeFotos = (D) => [
  ...(D.equipamentos || []).filter((e) => (e.anexos || []).length).map((e) => ({ tag: e.tag, anexos: e.anexos })),
  ...((D.anexos || []).length && D.modalidade !== 'ppu' ? [{ tag: '', anexos: D.anexos }] : []),
];

function Cabecalho() {
  const { EF, D, mudar, definirD, eu, setEu, toast, limparFotos } = useApp();
  const encs = encarregados(EF);
  const outro = D._digitar || (D.encarregado && !encs.some((e) => norm(e) === norm(D.encarregado)));
  const turnos = turnosDe(D.modalidade);

  const novo = () => {
    if (!confirm('Começar um lançamento novo? Salve antes se quiser guardar o atual no histórico.')) return;
    const n = novoDraft(EF, eu);
    garantirConteudo(EF, n);
    definirD(n);
    limparFotos();
  };

  const escolherEnc = (val) => {
    if (val === '__outro') { mudar((d) => { d._digitar = true; d.encarregado = ''; }); return; }
    const mod = modalidadeDoEnc(EF, val) || D.modalidade;
    const carregar = !D.pessoas.length || confirm('Carregar a equipe deste encarregado na lista de presença?');
    mudar((d) => {
      delete d._digitar;
      d.encarregado = val;
      d.modalidade = mod;
      if (!d.turno || !turnosDe(d.modalidade).includes(d.turno)) d.turno = turnoDoEnc(EF, d.encarregado, d.modalidade);
      if (carregar) preencherEquipe(EF, d);
      if (d.modalidade === 'ppu' && d.equipamentos.length === 1 && !d.equipamentos[0].tag) d.equipamentos[0] = novoEq(EF, d);
      garantirConteudo(EF, d);
    });
  };

  const lembrar = (marcado) => {
    if (marcado && D.encarregado) { setEu(D.encarregado); toast('Pronto: este aparelho lembra de ' + D.encarregado); }
    else { setEu(''); if (marcado) toast('Escolha o encarregado primeiro'); }
  };

  const trocarModalidade = (d) => {
    if (!turnosDe(d.modalidade).includes(d.turno)) d.turno = turnoDoEnc(EF, d.encarregado, d.modalidade);
    garantirConteudo(EF, d);
  };

  return (
    <section className="card">
      <div className="linha topo-card"><h2>Lançamento</h2><Sp /><button type="button" className="btn min" onClick={novo}>🆕 Novo</button></div>
      {D.data !== hoje() && <p className="aviso-linha">Este rascunho é de {dataBR(D.data)}.</p>}
      <label>Encarregado</label>
      <select value={outro ? '__outro' : (encs.find((e) => norm(e) === norm(D.encarregado)) || '')} onChange={(e) => escolherEnc(e.target.value)}>
        <option value="">— escolha —</option>
        {encs.map((e) => <option key={e} value={e}>{e}</option>)}
        <option value="__outro">Outro (digitar o nome)</option>
      </select>
      {outro && <input placeholder="Nome do encarregado" value={D.encarregado} style={{ marginTop: 6 }} onChange={(e) => { const val = e.target.value; mudar((d) => { d.encarregado = val; }); }} />}
      <label className="check">
        <input type="checkbox" checked={!!eu && norm(eu) === norm(D.encarregado)} onChange={(e) => lembrar(e.target.checked)} /> Lembrar que sou eu neste aparelho
      </label>
      <div className="grid2">
        <Campo rot="Data" k="data" tipo="date" />
        <div>
          <label>Turno</label>
          <select value={D.turno || ''} onChange={(e) => { const val = e.target.value; mudar((d) => { d.turno = val; }); }}>
            <option value="">—</option>
            {turnos.map((t) => <option key={t} value={t}>{t}</option>)}
            {D.turno && !turnos.includes(D.turno) && <option value={D.turno}>{D.turno}</option>}
          </select>
        </div>
      </div>
      <label>Tipo de equipe</label>
      <Seg k="modalidade" opcoes={[['ppu', 'PPU'], ['extra', 'Extra'], ['6x4', '6x4']]} aoMudar={trocarModalidade} />
    </section>
  );
}

function BarraAcoes({ erros }) {
  const { D, salvarRegistro, toast, setMensagem } = useApp();
  const enviar = useEnvio();
  const grupos = gruposDeFotos(D);
  const nFotos = grupos.reduce((n, g) => n + g.anexos.length, 0);
  const enviarFotos = () => enviar(JSON.stringify(grupos) + D.data + D.turno, async () => {
    const files = [];
    for (const g of grupos) files.push(...await arquivosDasFotos(g.anexos, rodapeDe(D, g.tag), `foto-${slug(g.tag || D.encarregado || 'rdo')}-${D.data}`));
    const text = [`📸 *Fotos do RDO* – ${rodapeDe(D, '')}`, ...grupos.map((g) => textoDasFotos(g.tag ? `*${g.tag}*` : '', g.anexos).trim())].join('\n');
    return { files, text };
  });
  const whats = () => {
    if (erros.length) { setMensagem({ msg: mensagem(D), erros }); return; }
    salvarRegistro({ enviadoEm: new Date().toISOString() });
    toast(enviarWhats(mensagem(D)));
  };
  return (
    <div className="acoes">
      <button type="button" className="btn" onClick={() => setMensagem({ msg: mensagem(D), erros })}>👁️ Ver</button>
      <button type="button" className="btn" onClick={() => { if (salvarRegistro()) toast('Salvo no histórico deste aparelho'); }}>💾 Salvar</button>
      {nFotos > 0 && <button type="button" className="btn" onClick={enviarFotos} title="Envia as fotos com a legenda gravada">📷 {nFotos}</button>}
      <button type="button" className="btn wa" onClick={whats}>📲 WhatsApp{erros.length ? <span className="badge" title="itens a completar">{erros.length}</span> : null}</button>
    </div>
  );
}

export function Lancar() {
  const { D } = useApp();
  const erros = validar(D);
  return (
    <>
      <Cabecalho />
      {D.modalidade === 'ppu' ? <FormPPU erros={erros} /> : <FormPresenca />}
      <BarraAcoes erros={erros} />
    </>
  );
}
