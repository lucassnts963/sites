/* Armazenamento no aparelho. As chaves são as mesmas da versão 0.1: quem atualizar não perde histórico nem rascunho.
   - Onde: localStorage; se estiver bloqueado (ex.: mini app isolado sem armazenamento), cai para a memória e a tela avisa.
   - Como: o codec da plataforma (#plataforma) pode comprimir os valores (alvo beacon); no Pages é JSON puro.
   - Quanto: usoArmazenamento() estima o espaço usado (o limite do navegador é de uns 5 MB por site). */
import { codec } from '#plataforma';
import { migrar } from './rascunho.js';
import { clone, normTag } from './texto.js';

export const LS = 'montisol-rdo:v1:';
export const LIMITE_BYTES = 5 * 1024 * 1024;
export const AVISO_BYTES = 4 * 1024 * 1024; // "perto do limite"
let aoFaltarEspaco = () => {};
export const quandoFaltarEspaco = (fn) => { aoFaltarEspaco = fn; };

/** Memória: mesma interface do localStorage (some ao fechar a tela). */
function memoria() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
    key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
}
function escolherBackend() {
  try {
    const ls = globalThis.localStorage;
    ls.setItem(LS + '__teste', '1');
    ls.removeItem(LS + '__teste');
    return { ls, modo: 'local' };
  } catch (_) {
    return { ls: memoria(), modo: 'memoria' };
  }
}
let B = null;
const be = () => (B || (B = escolherBackend()));
/** Para os testes: refaz a escolha do backend. */
export const _reiniciarArmazenamento = () => { B = null; };
export const modoArmazenamento = () => be().modo;

const todasChaves = () => { const ls = be().ls, out = []; for (let i = 0; i < ls.length; i++) out.push(ls.key(i)); return out; };
const ler = (txt) => (codec ? codec.ler(txt) : JSON.parse(txt));
const gravar = (obj) => (codec ? codec.gravar(obj) : JSON.stringify(obj));

export const store = {
  get(k, d) { try { const x = be().ls.getItem(LS + k); return x == null ? d : ler(x); } catch (_) { return d; } },
  set(k, x) { try { be().ls.setItem(LS + k, gravar(x)); return true; } catch (_) { aoFaltarEspaco(); return false; } },
  del(k) { try { be().ls.removeItem(LS + k); } catch (_) { /* nada */ } },
  chaves(prefixo) { return todasChaves().filter((k) => k && k.startsWith(LS + prefixo)); },
};

/** Espaço usado no armazenamento do site (UTF-16: 2 bytes por caractere de chave e valor). */
export function usoArmazenamento() {
  const ls = be().ls;
  let bytes = 0;
  for (const k of todasChaves()) { const v = ls.getItem(k) || ''; bytes += (k.length + v.length) * 2; }
  return { bytes, limite: LIMITE_BYTES, perto: bytes >= AVISO_BYTES, modo: be().modo };
}

export const registros = () => store.get('registros', []).map(migrar);
export const ordenar = (regs) => regs.sort((a, b) => ((b.data || '') + (b.salvoEm || '')).localeCompare((a.data || '') + (a.salvoEm || '')));

/** Salva o lançamento no histórico (substitui o de mesmo id e mantém a data de envio). */
export function gravarRegistro(D, extra) {
  const antes = registros();
  const antigo = antes.find((x) => x.id === D.id);
  const r = Object.assign(clone(D), { salvoEm: new Date().toISOString() }, extra || {});
  delete r._digitar;
  if (antigo && antigo.enviadoEm && !r.enviadoEm) r.enviadoEm = antigo.enviadoEm;
  return store.set('registros', ordenar([r, ...antes.filter((x) => x.id !== D.id)]));
}

/** Junta os registros de um backup aos atuais (ignora os ids que já existem). Devolve quantos entraram. */
export function restaurarBackup(o) {
  const atual = registros();
  const ids = new Set(atual.map((r) => r.id));
  const novos = (o.registros || []).filter((r) => r.id && !ids.has(r.id));
  store.set('registros', ordenar(atual.concat(novos)));
  return novos.length;
}

export const chaveMapa = (eq) => `mapa:${normTag(eq.tag)}:${eq.desenho}`;
export const chaveSvg = (tag) => 'svg:' + normTag(tag);
