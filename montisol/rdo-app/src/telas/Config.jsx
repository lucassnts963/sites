/* Configuração: efetivo (importar/remover), "quem sou eu" e mapeamentos guardados. */
import { useApp } from '../estado.jsx';
import { abrirArquivo } from '../lib/arquivos.js';
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
  const remover = async () => { if (!confirm('Remover o efetivo importado deste aparelho?')) return; store.del('efetivo'); await recarregarDados(); };

  return (
    <>
      <section className="card"><h2 className="sem-margem">Efetivo</h2>
        <p>Fonte: <b>{FONTE_TXT[dados.fonte]}</b><br />Atualizado em: {dataBR(EF.atualizado || '')} · {EF.colaboradores.length} colaboradores</p>
        <p className="dim pequeno">O efetivo real não fica no site público. Importe o arquivo <b>efetivo.json</b> enviado pelo planejamento.</p>
        <div className="linha">
          <button type="button" className="btn" onClick={importar}>⬆ Importar efetivo</button>
          {dados.fonte === 'importado' && <button type="button" className="btn perigo" onClick={remover}>Remover importado</button>}
        </div>
      </section>
      <section className="card"><h2 className="sem-margem">Quem sou eu</h2>
        <p>{eu || <span className="dim">não definido</span>}</p>
        {eu && <button type="button" className="btn" onClick={() => setEu('')}>Esquecer neste aparelho</button>}
      </section>
      <section className="card"><h2 className="sem-margem">Mapeamentos</h2>
        <p>{nMapas} espelho(s) guardado(s) neste aparelho.</p>
        <p className="dim pequeno">Desenhos disponíveis: {dados.CAT.desenhos.length}. TAGs cadastradas: {dados.TROC.length}.</p>
      </section>
      <p className="dim rodape">RDO de campo v{VERSAO} · sem login; os dados ficam no aparelho.</p>
    </>
  );
}
