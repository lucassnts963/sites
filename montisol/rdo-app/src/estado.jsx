/* Estado do app: dados de apoio, rascunho do lançamento (D), histórico, "quem sou eu", aviso (toast) e janelas abertas.
   O rascunho é alterado com mudar(fn): fn recebe uma cópia, altera no lugar, e a cópia é salva no aparelho. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { carregarDados } from './lib/dados.js';
import { fotosReferenciadas, limparFotosOrfas } from './lib/fotos.js';
import { registrarTurnos } from './lib/passagem.js';
import { chaveDeEnvio, enfileirar, processarFila, statusDe } from './lib/base.js';
import { VERSAO } from './lib/constantes.js';
import { montarEnvio, novoUuid } from './lib/contrato.js';
import { garantirConteudo, migrar, novoDraft } from './lib/rascunho.js';
import { gravarRegistro, ordenar, quandoFaltarEspaco, registros, store } from './lib/store.js';
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
      limparFotosOrfas(fotosReferenciadas(r, registros()));
    });
  }, [recarregarDados, definirD]);

  const atualizarRegistros = useCallback(() => setRegs(registros()), []);
  // versão dos dados guardados fora do rascunho (manutenção, mapa, turnos): sobe para a tela reler depois de gravar
  const [versao, setVersao] = useState(0);
  const tocar = useCallback(() => setVersao((n) => n + 1), []);
  const salvarRegistro = useCallback((extra) => {
    const ok = gravarRegistro(Dref.current, extra);
    if (ok) registrarTurnos(Dref.current);
    atualizarRegistros(); tocar();
    return ok;
  }, [atualizarRegistros, tocar]);
  // Apaga as fotos que nem o rascunho nem o histórico usam (depois de "Novo", excluir registro, ao abrir).
  const limparFotos = useCallback(() => limparFotosOrfas(fotosReferenciadas(Dref.current, registros())), []);
  // ---------------------------------------------------------------- envio para a base (n8n)
  const dadosRef = useRef(null);
  dadosRef.current = dados;
  /** Envia o rascunho (sem argumento) ou um registro do histórico. Garante o uuid fixo do lançamento, põe na fila e tenta enviar. */
  const enviarParaBase = useCallback(async (registro) => {
    if (!chaveDeEnvio()) { toast('Peça a chave de envio ao planejamento'); return null; }
    let L;
    if (!registro) {
      if (!Dref.current.envioId) definirD({ ...clone(Dref.current), envioId: novoUuid() });
      gravarRegistro(Dref.current, {}); registrarTurnos(Dref.current);
      L = Dref.current;
    } else {
      L = registro.envioId ? registro : { ...registro, envioId: novoUuid() };
      if (!registro.envioId) store.set('registros', ordenar(registros().map((x) => (x.id === L.id ? L : x))));
    }
    atualizarRegistros();
    const corpo = montarEnvio(L, (dadosRef.current && dadosRef.current.EF) || { colaboradores: [], frentes: {} }, { id: L.envioId, appVersao: VERSAO });
    await enfileirar(corpo, L.id);
    tocar();
    await processarFila(tocar);
    const st = statusDe(L.id) || {};
    toast(st.status === 'enviado' ? (st.duplicado ? 'Já estava na base: nada duplicado' : 'Enviado para a base: aguarda a aprovação do planejamento')
      : st.status === 'erro' ? 'Não foi enviado: ' + st.erro + '. Ficou na fila.'
        : 'Sem conexão com a base: ficou na fila e vai sozinho quando houver internet');
    return st;
  }, [definirD, atualizarRegistros, tocar, toast]);

  // reenvia a fila ao abrir o app, ao voltar a conexão, ao voltar para a tela e de tempos em tempos
  useEffect(() => {
    const tentar = () => { processarFila(tocar); };
    tentar();
    const aoVoltarTela = () => { if (document.visibilityState === 'visible') tentar(); };
    window.addEventListener('online', tentar);
    document.addEventListener('visibilitychange', aoVoltarTela);
    const iv = setInterval(tentar, 90000);
    return () => { window.removeEventListener('online', tentar); document.removeEventListener('visibilitychange', aoVoltarTela); clearInterval(iv); };
  }, [tocar]);

  const setEu = useCallback((nome) => { if (nome) store.set('eu', nome); else store.del('eu'); setEuState(nome || ''); }, []);

  const valor = useMemo(() => ({
    dados, EF, D, mudar, definirD, recarregarDados, regs, atualizarRegistros, salvarRegistro, eu, setEu, limparFotos, versao, tocar, enviarParaBase,
    aviso, toast, mensagem, setMensagem, mapa, setMapa,
  }), [dados, EF, D, mudar, definirD, recarregarDados, regs, atualizarRegistros, salvarRegistro, eu, setEu, limparFotos, versao, tocar, enviarParaBase, aviso, toast, mensagem, mapa]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
