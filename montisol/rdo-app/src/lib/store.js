/* Armazenamento no aparelho. As chaves são as mesmas da versão 0.1: quem atualizar não perde histórico nem rascunho. */
import { migrar } from './rascunho.js';
import { clone, normTag } from './texto.js';

export const LS = 'montisol-rdo:v1:';
let aoFaltarEspaco = () => {};
export const quandoFaltarEspaco = (fn) => { aoFaltarEspaco = fn; };

export const store = {
  get(k, d) { try { const x = localStorage.getItem(LS + k); return x == null ? d : JSON.parse(x); } catch (_) { return d; } },
  set(k, x) { try { localStorage.setItem(LS + k, JSON.stringify(x)); return true; } catch (_) { aoFaltarEspaco(); return false; } },
  del(k) { localStorage.removeItem(LS + k); },
  chaves(prefixo) { return Object.keys(localStorage).filter((k) => k.startsWith(LS + prefixo)); },
};

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
