/* Pesquisa por colaborador: equipe, encarregado, supervisor e apontamentos feitos neste aparelho. */
import { useApp } from '../estado.jsx';
import { MOD_TXT, ROTULO_ST } from '../lib/constantes.js';
import { modDe } from '../lib/efetivo.js';
import { cap, dataBR, norm } from '../lib/texto.js';

export function pesquisar(EF, regs, q) {
  const nq = norm(q);
  const nomes = new Map();
  for (const c of EF.colaboradores) if (norm(c.nome).includes(nq)) nomes.set(norm(c.nome), c);
  for (const r of regs) {
    for (const p of [...(r.pessoas || []), ...(r.equipamentos || []).flatMap((e) => e.equipe || [])]) {
      if (norm(p.nome).includes(nq) && !nomes.has(norm(p.nome))) nomes.set(norm(p.nome), Object.assign({ semCadastro: true }, p));
    }
  }
  return [...nomes.values()].slice(0, 25).map((c) => {
    const hist = [];
    for (const r of regs) {
      const p = (r.pessoas || []).find((x) => norm(x.nome) === norm(c.nome));
      if (p) hist.push(`${dataBR(r.data)} · ${r.turno} · ${ROTULO_ST[p.status] || '—'}${p.status === 'falta' ? ' (' + (p.just || 'sem justificativa') + ')' : ''} · enc. ${r.encarregado}`);
      for (const e of r.equipamentos || []) if ((e.equipe || []).some((x) => norm(x.nome) === norm(c.nome))) hist.push(`${dataBR(r.data)} · ${r.turno} · PPU ${e.tag} · enc. ${r.encarregado}`);
    }
    return { c, hist };
  });
}

export function Pesquisar({ q, setQ }) {
  const { EF, regs } = useApp();
  const achados = norm(q).length >= 2 ? pesquisar(EF, regs, q) : null;
  return (
    <section className="card">
      <h2 className="sem-margem">Pesquisar colaborador</h2>
      <input type="search" placeholder="Nome (mín. 2 letras)" value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      {!achados && <p className="dim">Digite parte do nome. Mostra a equipe, o encarregado e o histórico de apontamentos deste aparelho.</p>}
      {achados && !achados.length && <p className="dim">Ninguém encontrado.</p>}
      {achados && achados.map(({ c, hist }) => {
        const mod = modDe(EF, c.frente);
        return (
          <div className="card" key={c.nome}>
            <b>{c.nome}</b>{c.semCadastro && <span className="tag manual">sem cadastro</span>}
            <div className="dim pequeno">{cap(c.funcao)}{c.frente ? ' · ' + cap(c.frente) : ''}{mod ? ` (${MOD_TXT[mod]})` : ''}</div>
            {!c.semCadastro && <div className="pequeno">Turno: {c.turno || '—'} · Status: {cap(c.status) || '—'}<br />Encarregado: {c.encarregado || '—'} · Supervisor: {c.supervisor || '—'}</div>}
            {hist.length
              ? <details><summary>Apontamentos neste aparelho ({hist.length})</summary><ul>{hist.slice(0, 40).map((x, i) => <li key={i}>{x}</li>)}</ul></details>
              : <small>Sem apontamentos neste aparelho.</small>}
          </div>
        );
      })}
    </section>
  );
}
