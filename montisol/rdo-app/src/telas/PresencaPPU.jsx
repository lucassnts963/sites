/* PPU: presença da equipe do encarregado. A falta pede justificativa e onde a pessoa deveria estar;
   quem falta sai da equipe dos equipamentos (e volta ao ser marcado presente). */
import { useState } from 'react';
import { useApp } from '../estado.jsx';
import { MARCA } from '../lib/constantes.js';
import { AdicionarPessoa } from '../componentes/AdicionarPessoa.jsx';
import { Sp } from '../componentes/campos.jsx';
import { preencherEquipe } from '../lib/rascunho.js';
import { Pessoa } from './FormPresenca.jsx';

export function PresencaPPU({ pendencias }) {
  const { EF, D, mudar, toast } = useApp();
  const [aberto, setAberto] = useState(true);
  const ps = D.pessoas;
  const n = (st) => ps.filter((p) => p.status === st).length;
  const tags = [...new Set(D.equipamentos.map((e) => e.tag).filter(Boolean))];

  const recarregar = () => {
    if (!D.encarregado) { toast('Escolha o encarregado'); return; }
    if (ps.length && !confirm('Substituir a lista de presença pela equipe do encarregado?')) return;
    mudar((d) => preencherEquipe(EF, d));
  };

  return (
    <section className={'card' + (aberto ? '' : ' fechado')}>
      <datalist id="tagsDoDia">{tags.map((t) => <option key={t} value={t} />)}</datalist>
      <div className="linha topo-card">
        <button type="button" className="dobra" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
          <span className="seta">{aberto ? '▾' : '▸'}</span><img className="ic" src={MARCA + 'icones/supervisor-preto.png'} alt="" width="24" height="24" /><b>Presença da equipe ({ps.length})</b>
          {pendencias ? <span className="tag outra">{pendencias} a completar</span> : null}
        </button>
        <Sp />
        <button type="button" className="btn min" onClick={recarregar} title="Recarrega a equipe do encarregado">⟳ Equipe</button>
      </div>
      <div className="kpis"><span>✅ {n('presente')}</span><span>❌ {n('falta')}</span><span>🏖️ {n('ferias') + n('afastado')}</span></div>
      {aberto && <>
        {!D.encarregado && <p className="dim">Escolha o encarregado para carregar a equipe.</p>}
        <p className="dim pequeno">Marque quem faltou e onde deveria estar. Quem falta sai da equipe do equipamento.</p>
        <div>{ps.map((p, j) => <Pessoa key={p.nome + j} p={p} j={j} ppu />)}</div>
        <details><summary>➕ Adicionar alguém à lista de presença</summary><AdicionarPessoa caminho="pessoas" /></details>
      </>}
    </section>
  );
}
