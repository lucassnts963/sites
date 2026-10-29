/* Busca no efetivo e adição de gente sem cadastro. Serve para a equipe de um equipamento (PPU) e para a lista de presença.
   `caminho` é a lista no rascunho: "pessoas" ou "equipamentos.<i>.equipe". */
import { useState } from 'react';
import { useApp } from '../estado.jsx';
import { buscarColaboradores, origemDe, pessoaDe, pessoaManual } from '../lib/efetivo.js';
import { cap, getPath, norm } from '../lib/texto.js';

export function TagOrigem({ p }) {
  if (p.origem === 'outra') return <span className="tag outra">outra equipe</span>;
  if (p.origem === 'manual') return <span className="tag manual">{p.contrato || 'sem cadastro'}</span>;
  return null;
}

/** Devolve uma função que acrescenta uma pessoa à lista do caminho (sem repetir nomes). */
export function useAdicionar(caminho) {
  const { EF, mudar, toast, D } = useApp();
  return (pessoaOuColab, manual) => {
    const lista = getPath(D, caminho) || [];
    if (lista.some((p) => norm(p.nome) === norm(pessoaOuColab.nome))) { toast('Já está na lista'); return; }
    mudar((d) => { getPath(d, caminho).push(manual ? pessoaOuColab : pessoaDe(pessoaOuColab, origemDe(EF, d, pessoaOuColab))); });
  };
}

export function AdicionarPessoa({ caminho }) {
  const { EF, D, toast } = useApp();
  const adicionar = useAdicionar(caminho);
  const [q, setQ] = useState('');
  const [manual, setManual] = useState({ nome: '', contrato: '', funcao: '' });
  const achados = buscarColaboradores(EF, q, getPath(D, caminho) || []);
  const mostrar = norm(q).length >= 2;

  const addManual = () => {
    if (!manual.nome.trim()) { toast('Digite o nome'); return; }
    adicionar(pessoaManual(manual.nome, manual.funcao, manual.contrato), true);
    setManual({ nome: '', contrato: '', funcao: '' });
  };

  return (
    <>
      <div className="busca">
        <input type="search" placeholder="🔎 Adicionar colaborador pelo nome" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        {mostrar && (
          <div className="resultados">
            {achados.map(({ c, i }) => (
              <button key={i} type="button" onClick={() => { adicionar(c); setQ(''); }}>
                <b>{c.nome}</b>
                <small>{cap(c.funcao)} · {cap(c.frente)} · enc. {c.encarregado || '—'}{c.status && norm(c.status) !== 'ATIVO' ? ' · ' + cap(c.status) : ''}</small>
              </button>
            ))}
            <button type="button" onClick={() => { adicionar(pessoaManual(q), true); setQ(''); }}>➕ Adicionar “{q.trim()}” como nome sem cadastro</button>
          </div>
        )}
      </div>
      <details>
        <summary>➕ Digitar nome (sem cadastro / outro contrato)</summary>
        <div className="grid2">
          <div><label>Nome</label><input value={manual.nome} onChange={(e) => setManual({ ...manual, nome: e.target.value })} /></div>
          <div><label>Contrato / empresa</label><input value={manual.contrato} placeholder="ex.: Desincrustação" onChange={(e) => setManual({ ...manual, contrato: e.target.value })} /></div>
        </div>
        <label>Função</label><input value={manual.funcao} onChange={(e) => setManual({ ...manual, funcao: e.target.value })} />
        <div className="linha"><button type="button" className="btn" onClick={addManual}>Adicionar</button></div>
      </details>
    </>
  );
}
