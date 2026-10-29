/* Ajustes: envio para a base, efetivo (importar/remover), equipamentos, "quem sou eu" e mapeamentos guardados. */
import { useApp } from '../estado.jsx';
import { EnvioBase } from '../componentes/EnvioBase.jsx';
import { abrirArquivo, baixar } from '../lib/arquivos.js';
import { lerListaEquipamentos, MODELO_CSV } from '../lib/equipamentos.js';
import { VERSAO } from '../lib/constantes.js';
import { store } from '../lib/store.js';
import { dataBR } from '../lib/texto.js';

const FONTE_TXT = { importado: 'importado neste aparelho', site: 'do site', exemplo: 'EXEMPLO (nomes fictícios)', vazio: 'nenhum' };

export function Config() {
  const { dados, EF, eu, setEu, recarregarDados, toast } = useApp();
  const nMapas = store.chaves('mapa:').length;

  const importar = async () => {
    const arq = await abrirArquivo('.json,application/json');
    if (!arq) return;
    try {
      const o = JSON.parse(arq.texto);
      if (!Array.isArray(o.colaboradores)) throw new Error('não tem a lista "colaboradores"');
      store.set('efetivo', o);
      await recarregarDados();
      toast(`Efetivo importado: ${o.colaboradores.length} colaboradores`);
    } catch (e) { alert('Arquivo inválido: ' + e.message); }
  };
  const importarEquip = async () => {
    const arq = await abrirArquivo('.csv,.txt,.json,text/csv,text/plain,application/json');
    if (!arq) return;
    try {
      const lista = lerListaEquipamentos(arq.texto, arq.nome);
      const novos = lista.filter((x) => !dados.TROC.some((t) => t.tag.toUpperCase() === x.tag));
      store.set('equipamentos', { atualizado: new Date().toISOString().slice(0, 10), arquivo: arq.nome, trocadores: lista });
      await recarregarDados();
      toast(`Lista importada: ${lista.length} equipamento(s), ${novos.length} novo(s)`);
    } catch (e) { alert('Não foi possível importar: ' + e.message); }
  };
  const removerEquip = async () => { if (!confirm('Remover a lista de equipamentos importada deste aparelho?')) return; store.del('equipamentos'); await recarregarDados(); };
  const remover = async () => { if (!confirm('Remover o efetivo importado deste aparelho?')) return; store.del('efetivo'); await recarregarDados(); };

  return (
    <>
      <EnvioBase />
      <section className="card"><h2 className="sem-margem">Efetivo</h2>
        <p>Fonte: <b>{FONTE_TXT[dados.fonte]}</b><br />Atualizado em: {dataBR(EF.atualizado || '')} · {EF.colaboradores.length} colaboradores</p>
        <p className="dim pequeno">O efetivo real não fica no site público. Importe o arquivo <b>efetivo.json</b> enviado pelo planejamento.</p>
        <div className="linha">
          <button type="button" className="btn" onClick={importar}>⬆ Importar efetivo</button>
          {dados.fonte === 'importado' && <button type="button" className="btn perigo" onClick={remover}>Remover importado</button>}
        </div>
      </section>
      <section className="card"><h2 className="sem-margem">Equipamentos</h2>
        <p>{dados.TROC.length} TAG(s) na lista{dados.equipImp ? <> · importada em {dataBR(dados.equipImp.atualizado)} ({dados.equipImp.trocadores.length} do arquivo <b>{dados.equipImp.arquivo}</b>)</> : ' (só a do site)'}</p>
        <p className="dim pequeno">Importe uma planilha salva em CSV (colunas <b>tag; tipo; area; desenho; tubos</b>) ou o JSON no formato de trocadores.json. A TAG escolhida no lançamento já preenche o desenho e o total de tubos.</p>
        <div className="linha">
          <button type="button" className="btn" onClick={importarEquip}>⬆ Importar lista</button>
          <button type="button" className="btn min" onClick={() => baixar(new File(['\uFEFF' + MODELO_CSV], 'equipamentos-modelo.csv', { type: 'text/csv' }))}>⬇ Modelo CSV</button>
          {dados.equipImp && <button type="button" className="btn perigo" onClick={removerEquip}>Remover importada</button>}
        </div>
        {dados.TROC.length > 0 && <details><summary>Ver a lista ({dados.TROC.length})</summary>
          <ul className="lista-equip">{dados.TROC.map((t) => <li key={t.tag}><b>{t.tag}</b> <span className="dim">{[t.tipo, t.area, t.tubos ? t.tubos + ' tubos' : '', t.desenho && !dados.CAT.desenhos.some((d) => d.id === t.desenho) ? '⚠ desenho não encontrado: ' + t.desenho : ''].filter(Boolean).join(' · ')}</span></li>)}</ul>
        </details>}
      </section>
      <section className="card"><h2 className="sem-margem">Quem sou eu</h2>
        <p>{eu || <span className="dim">não definido</span>}</p>
        {eu && <button type="button" className="btn" onClick={() => setEu('')}>Esquecer neste aparelho</button>}
      </section>
      <section className="card"><h2 className="sem-margem">Mapeamentos</h2>
        <p>{nMapas} espelho(s) guardado(s) neste aparelho.</p>
        <p className="dim pequeno">Desenhos disponíveis: {dados.CAT.desenhos.map((d) => d.id).join(', ')}.</p>
      </section>
      <p className="dim rodape">RDO de campo v{VERSAO} · sem login; os dados ficam no aparelho.</p>
    </>
  );
}
