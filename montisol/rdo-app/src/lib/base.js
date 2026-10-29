/* Envio para a base (n8n): o lançamento vai para a fila do aparelho (IndexedDB) e a fila é enviada quando há internet.
   O Lucas confere e aprova no n8n; a base de medição só recebe o que ele aprovou.
   - A chave (X-RDO-Chave) é digitada pelo encarregado em Ajustes e fica só no aparelho: o repositório é público.
   - Cada lançamento tem um uuid fixo (envioId); reenviar usa o mesmo id e o n8n responde "duplicado".
   - O status de cada lançamento fica em localStorage (base:status): fila | enviado | erro. */
import { tx } from './idb.js';
import { store } from './store.js';

export const URL_BASE = 'https://n8n.elucas.dev/webhook/montisol-rdo';
// Endereço alternativo só para os testes automáticos (servidor local); o app usa sempre URL_BASE.
const url = () => store.get('base:url-teste', '') || URL_BASE;
const TEMPO_LIMITE = 20000;

export const chaveDeEnvio = () => store.get('base:chave', '');
export const guardarChave = (c) => (c ? store.set('base:chave', c.trim()) : store.del('base:chave'));

// ------------------------------------------------------------------ status por lançamento

export const statusEnvios = () => store.get('base:status', {});
export const statusDe = (lid) => statusEnvios()[lid] || null;
function marcar(lid, dados) {
  const s = statusEnvios();
  s[lid] = { ...(s[lid] || {}), ...dados, atualizadoEm: new Date().toISOString() };
  store.set('base:status', s);
}

// ------------------------------------------------------------------ fila

export const itensDaFila = () => tx('fila', 'readonly', (s) => s.getAll()).catch(() => []);
const guardarNaFila = (item) => tx('fila', 'readwrite', (s) => { s.put(item); });
const tirarDaFila = (id) => tx('fila', 'readwrite', (s) => { s.delete(id); });

/** Põe (ou troca, pelo id) o lançamento na fila. */
export async function enfileirar(corpo, lid) {
  await guardarNaFila({ id: corpo.id, lid, corpo, entrouEm: new Date().toISOString(), tentativas: 0 });
  const st = statusDe(lid);
  marcar(lid, { id: corpo.id, status: 'fila', erro: '', ...(st && st.enviadoEm ? { reenvio: true } : {}) });
}

// ------------------------------------------------------------------ rede

/** POST de um corpo. Devolve { ok, duplicado, http, resposta, erro, semRede }. */
export async function postar(corpo, chave) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TEMPO_LIMITE);
  try {
    const r = await fetch(url(), {
      method: 'POST', signal: ctrl.signal, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-RDO-Chave': chave },
      body: JSON.stringify(corpo),
    });
    const texto = await r.text();
    let resposta = null;
    try { resposta = texto ? JSON.parse(texto) : null; } catch (_) { /* resposta não é JSON */ }
    if (r.status === 200 && resposta && (resposta.ok === true || resposta.duplicado === true)) return { ok: true, duplicado: !!resposta.duplicado, http: 200, resposta };
    const motivo = r.status === 401 || r.status === 403 ? 'chave recusada' : resposta && (resposta.erro || resposta.mensagem || resposta.message) ? String(resposta.erro || resposta.mensagem || resposta.message) : texto.slice(0, 160) || 'resposta inesperada';
    return { ok: false, http: r.status, resposta, erro: `HTTP ${r.status}: ${motivo}` };
  } catch (e) {
    // sem internet, servidor fora do ar, tempo esgotado ou bloqueio de CORS: o navegador não diferencia
    return { ok: false, http: 0, semRede: true, erro: e && e.name === 'AbortError' ? 'tempo esgotado' : 'sem conexão com a base' };
  } finally { clearTimeout(t); }
}

let enviando = null, deNovo = false;
/** Envia o que está na fila (um de cada vez). Se for chamada durante uma rodada, faz outra em seguida
    (o lançamento que acabou de entrar na fila não espera o próximo gatilho). Devolve { enviados, falhas, restantes }. */
export function processarFila(aoMudar) {
  if (enviando) { deNovo = true; return enviando.then(() => processarFila(aoMudar)); }
  deNovo = false;
  enviando = (async () => {
    const r = { enviados: 0, falhas: 0, restantes: 0, ultimoErro: '' };
    const chave = chaveDeEnvio();
    const itens = await itensDaFila();
    if (!chave || !itens.length || (typeof navigator !== 'undefined' && navigator.onLine === false)) { r.restantes = itens.length; return r; }
    for (const it of itens) {
      const corpo = { ...it.corpo, enviado_em: new Date().toISOString() };
      const res = await postar(corpo, chave);
      if (res.ok) {
        await tirarDaFila(it.id);
        marcar(it.lid, { id: it.id, status: 'enviado', enviadoEm: new Date().toISOString(), erro: '', duplicado: res.duplicado, reenvio: false, statusBase: (res.resposta && res.resposta.status) || '' });
        r.enviados++;
      } else {
        await guardarNaFila({ ...it, tentativas: (it.tentativas || 0) + 1, ultimoErro: res.erro, ultimaTentativa: new Date().toISOString() });
        marcar(it.lid, { id: it.id, status: res.semRede ? 'fila' : 'erro', erro: res.erro });
        r.falhas++; r.ultimoErro = res.erro;
        if (res.semRede) break; // sem rede: não adianta tentar os outros agora
      }
      if (aoMudar) aoMudar();
    }
    r.restantes = (await itensDaFila()).length;
    return r;
  })().finally(() => { enviando = null; if (aoMudar) aoMudar(); });
  return enviando;
}
export const filaOcupada = () => !!enviando || deNovo;

/** Ajustes › Testar envio: manda {"versao":1,"teste":true} e devolve o resultado para mostrar. */
export async function testarEnvio(chave) {
  const res = await postar({ versao: 1, teste: true }, chave);
  return { ...res, texto: res.http ? `HTTP ${res.http}${res.resposta ? ' · ' + JSON.stringify(res.resposta) : ''}` : res.erro };
}
