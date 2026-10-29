/* Histórico local: ver, editar, duplicar para hoje, excluir, backup e restauração. */
import { useApp } from '../estado.jsx';
import { Sp } from '../componentes/campos.jsx';
import { abrirArquivo, compartilharArquivo } from '../lib/arquivos.js';
import { MOD_TXT, VERSAO } from '../lib/constantes.js';
import { mensagem } from '../lib/mensagens.js';
import { duplicarParaHoje } from '../lib/rascunho.js';
import { restaurarBackup, store } from '../lib/store.js';
import { clone, dataBR, hoje } from '../lib/texto.js';

function resumoRegistro(r) {
  if (r.modalidade === 'ppu') return (r.equipamentos || []).map((e) => `${e.tag || 'sem TAG'}: ${e.prod.desob || 0} tubos`).join(' · ');
  const ps = r.pessoas || [];
  return `${ps.filter((p) => p.status === 'presente').length} presentes · ${ps.filter((p) => p.status === 'falta').length} faltas`;
}

export function Historico({ irPara }) {
  const { regs, atualizarRegistros, definirD, setMensagem, toast } = useApp();

  const editar = (r) => {
    if (!confirm('Abrir este registro para editar? O rascunho atual será substituído.')) return;
    const D = clone(r); delete D.salvoEm;
    definirD(D); irPara('lancar');
  };
  const duplicar = (r) => {
    if (!confirm('Criar um lançamento de hoje a partir deste? O rascunho atual será substituído.')) return;
    definirD(duplicarParaHoje(r)); irPara('lancar');
  };
  const excluir = (r) => {
    if (!confirm('Excluir este registro do aparelho?')) return;
    store.set('registros', regs.filter((x) => x.id !== r.id)); atualizarRegistros();
  };
  const exportar = async () => toast(await compartilharArquivo(`rdo-backup-${hoje()}.json`,
    JSON.stringify({ versao: VERSAO, exportadoEm: new Date().toISOString(), registros: regs }, null, 1), 'application/json'));
  const importar = async () => {
    const arq = await abrirArquivo('.json,application/json');
    if (!arq) return;
    try { const n = restaurarBackup(JSON.parse(arq.texto)); atualizarRegistros(); toast(`${n} registro(s) restaurado(s)`); }
    catch (e) { alert('Arquivo inválido: ' + e.message); }
  };

  return (
    <>
      <section className="card">
        <div className="linha topo-card"><h2>Histórico ({regs.length})</h2><Sp />
          <button type="button" className="btn min" onClick={exportar}>⬇ Backup</button>
          <button type="button" className="btn min" onClick={importar}>⬆ Restaurar</button></div>
        <p className="dim pequeno">Fica só neste aparelho. Faça backup de vez em quando.</p>
      </section>
      {regs.length ? regs.map((r) => (
        <div className="card reg" key={r.id}>
          <div><b>{dataBR(r.data)} · {r.turno || '—'} · {MOD_TXT[r.modalidade] || r.modalidade}</b>
            <div className="dim pequeno">{r.encarregado} · {resumoRegistro(r)}</div></div>
          <span className={'tag ' + (r.enviadoEm ? 'ok' : 'outra')}>{r.enviadoEm ? 'enviado' : 'salvo'}</span>
          <div className="acoes-reg">
            <button type="button" className="btn min" onClick={() => setMensagem({ msg: mensagem(r), erros: [] })}>👁️ Ver</button>
            <button type="button" className="btn min" onClick={() => editar(r)}>✏️ Editar</button>
            <button type="button" className="btn min" onClick={() => duplicar(r)}>⧉ Duplicar p/ hoje</button>
            <button type="button" className="btn min perigo" onClick={() => excluir(r)}>🗑</button>
          </div>
        </div>
      )) : <p className="dim">Nenhum registro ainda.</p>}
    </>
  );
}
