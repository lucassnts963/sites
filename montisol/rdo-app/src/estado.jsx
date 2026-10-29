/* Estado do app: dados de apoio, rascunho do lançamento (D), histórico, "quem sou eu", aviso (toast) e janelas abertas.
   O rascunho é alterado com mudar(fn): fn recebe uma cópia, altera no lugar, e a cópia é salva no aparelho. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { carregarDados } from './lib/dados.js';
import { garantirConteudo, migrar, novoDraft } from './lib/rascunho.js';
import { gravarRegistro, quandoFaltarEspaco, registros, store } from './lib/store.js';
import { clone } from './lib/texto.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [dados, setDados] = useState(null);
  const [D, setD] = useState(null);
  const Dref = useRef(null);
  const [eu, setEuState] = useState(() => store.get('eu', ''));
  const [regs, setRegs] = useState(() => registros());
  const [aviso, setAviso] = useState({ texto: '', n: 0 });
  const [mensagem, setMensagem] = useState(null); // { msg, erros }
  const [mapa, setMapa] = useState(null); // { i, sheet, estado }

  const toast = useCallback((texto) => { if (texto) setAviso((a) => ({ texto, n: a.n + 1 })); }, []);
  useEffect(() => quandoFaltarEspaco(() => toast('Sem espaço no aparelho para salvar.')), [toast]);

  const EF = dados ? dados.EF : { colaboradores: [], frentes: {} };

  const definirD = useCallback((n) => { store.set('rascunho', n); Dref.current = n; setD(n); }, []);
  const mudar = useCallback((fn) => {
    const n = clone(Dref.current);
    fn(n);
    definirD(n);
  }, [definirD]);

  const recarregarDados = useCallback(async () => { const x = await carregarDados(); setDados(x); return x; }, []);

  useEffect(() => {
    recarregarDados().then((x) => {
      const r = migrar(store.get('rascunho', null)) || novoDraft(x.EF, store.get('eu', ''));
      garantirConteudo(x.EF, r);
      definirD(r);
    });
  }, [recarregarDados, definirD]);

  const atualizarRegistros = useCallback(() => setRegs(registros()), []);
  const salvarRegistro = useCallback((extra) => { const ok = gravarRegistro(Dref.current, extra); atualizarRegistros(); return ok; }, [atualizarRegistros]);
  const setEu = useCallback((nome) => { if (nome) store.set('eu', nome); else store.del('eu'); setEuState(nome || ''); }, []);

  const valor = useMemo(() => ({
    dados, EF, D, mudar, definirD, recarregarDados, regs, atualizarRegistros, salvarRegistro, eu, setEu,
    aviso, toast, mensagem, setMensagem, mapa, setMapa,
  }), [dados, EF, D, mudar, definirD, recarregarDados, regs, atualizarRegistros, salvarRegistro, eu, setEu, aviso, toast, mensagem, mapa]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
