/* Extra e 6x4: presença/falta da equipe do encarregado; extra tem atividades e OS. */
import { useApp } from '../estado.jsx';
import { AdicionarPessoa, TagOrigem, useAdicionar } from '../componentes/AdicionarPessoa.jsx';
import { Area, Sp } from '../componentes/campos.jsx';
import { ROTULO_ST } from '../lib/constantes.js';
import { pessoasDoEnc } from '../lib/efetivo.js';
import { marcarPresencaPPU, preencherEquipe } from '../lib/rascunho.js';
import { Fotos } from '../componentes/Fotos.jsx';
import { cap, clone, dataBR, norm } from '../lib/texto.js';

/** Uma pessoa da lista de presença. No PPU (`ppu`), a falta pede também onde a pessoa deveria estar (TAG). */
export function Pessoa({ p, j, ppu }) {
  const { mudar } = useApp();
  const marcar = (st) => mudar((d) => {
    if (ppu) { marcarPresencaPPU(d, j, st); return; }
    const x = d.pessoas[j]; x.status = st; if (st !== 'falta') x.just = '';
  });
  return (
    <div className="pessoa">
      <div><div className="nome">{p.nome}<TagOrigem p={p} /></div><div className="info">{cap(p.funcao)}{p.frente ? ' · ' + cap(p.frente) : ''}</div></div>
      <button type="button" className="btn min" aria-label="remover" onClick={() => mudar((d) => { d.pessoas.splice(j, 1); })}>✕</button>
      <div className="st">
        {Object.entries(ROTULO_ST).map(([st, rot]) => (
          <button type="button" key={st} data-st={st} className={p.status === st ? 'on' : ''} onClick={() => marcar(st)}>{rot}</button>
        ))}
      </div>
      {p.status === 'falta' && (
        <div className="just">
          <input placeholder="Justificativa da falta" value={p.just} onChange={(e) => { const val = e.target.value; mudar((d) => { d.pessoas[j].just = val; }); }} />
          <button type="button" className="btn min" onClick={() => mudar((d) => { d.pessoas[j].just = 'Sem justificativa'; })}>Sem justificativa</button>
        </div>
      )}
      {ppu && p.status === 'falta' && (
        <div className="just deveria">
          <label>Onde deveria estar</label>
          <input list="tagsDoDia" placeholder="Onde deveria estar (TAG)" value={p.deveria || ''}
            onChange={(e) => { const val = e.target.value; mudar((d) => { d.pessoas[j].deveria = val; }); }} />
        </div>
      )}
    </div>
  );
}

export function FormPresenca() {
  const { EF, D, mudar, regs, toast } = useApp();
  const adicionar = useAdicionar('pessoas');
  const ps = D.pessoas;
  const n = (st) => ps.filter((p) => p.status === st).length;
  const ja = new Set(ps.map((p) => norm(p.nome)));
  const doEnc = D.encarregado ? pessoasDoEnc(EF, D.encarregado).filter((c) => !ja.has(norm(c.nome))) : [];

  const puxarAnterior = () => {
    const r = regs.find((x) => x.id !== D.id && x.modalidade === D.modalidade && norm(x.encarregado) === norm(D.encarregado));
    if (!r) { toast('Nenhum apontamento anterior deste encarregado nesta equipe'); return; }
    if (ps.length && !confirm(`Trocar a lista pela do apontamento de ${dataBR(r.data)} (${r.turno})?`)) return;
    mudar((d) => { d.pessoas = clone(r.pessoas || []); });
    toast(`Puxado de ${dataBR(r.data)}`);
  };
  const recarregar = () => {
    if (!D.encarregado) { toast('Escolha o encarregado'); return; }
    if (ps.length && !confirm('Substituir a lista atual pela equipe do encarregado?')) return;
    mudar((d) => preencherEquipe(EF, d));
  };

  return (
    <>
      <section className="card">
        <div className="linha topo-card"><h2>Equipe ({ps.length})</h2><Sp />
          <button type="button" className="btn min" onClick={puxarAnterior} title="Copia o último apontamento deste encarregado">↺ Anterior</button>
          <button type="button" className="btn min" onClick={recarregar} title="Recarrega a equipe do encarregado">⟳ Equipe</button></div>
        <div className="kpis"><span>✅ {n('presente')}</span><span>❌ {n('falta')}</span><span>🏖️ {n('ferias') + n('afastado')}</span></div>
        {!D.encarregado && <p className="dim">Escolha o encarregado para carregar a equipe.</p>}
        <div>{ps.map((p, j) => <Pessoa key={p.nome + j} p={p} j={j} />)}</div>
        {doEnc.length > 0 && <>
          <h3>Também com este encarregado</h3>
          <div className="chips">{doEnc.map((c) => <button type="button" className="chip" key={c.nome} onClick={() => adicionar(c)}>＋ {c.nome} <small>{cap(c.frente)}</small></button>)}</div>
        </>}
        <h3>Adicionar alguém de outra equipe ou contrato</h3>
        <AdicionarPessoa caminho="pessoas" />
      </section>
      {D.modalidade === 'extra' ? (
        <section className="card"><h2>Atividades e OS</h2>
          <Area rot="Atividades executadas" k="atividades" placeholder="Descreva o que a equipe fez" />
          <Area rot="OS executadas (uma por linha)" k="osExec" placeholder="ex.: 4012345 – limpeza do HE..." />
          <Area rot="OS canceladas (uma por linha, com o motivo)" k="osCanc" placeholder="ex.: 4012399 – área não liberada" />
        </section>
      ) : (
        <section className="card"><h2>Observações</h2><Area rot="Observações (opcional)" k="obs" /></section>
      )}
      <section className="card"><h2>Fotos</h2><Fotos caminho="anexos" tag="" /></section>
    </>
  );
}
