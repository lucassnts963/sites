/* Contrato v1 do envio para a base (n8n). Os nomes dos campos são fixos: o fluxo do n8n depende deles.
   Regras: o que o app não sabe vai como null (horas por pessoa, números não preenchidos, momento da foto sem marcar);
   as imagens das fotos não vão, só momento e legenda; o texto do WhatsApp vai igual ao que o app gera. */
import { modDe, pessoasDoEnc } from './efetivo.js';
import { mensagem } from './mensagens.js';
import { v } from './texto.js';

export const VERSAO_CONTRATO = 1;
const MOMENTOS = ['antes', 'durante', 'depois'];
export const SERVICOS = [['desobstrucao', 'Desobstrução'], ['abertura', 'Abertura'], ['manutencao', 'Manutenção']];

/** Número do campo digitado; vazio ou inválido = null. */
const num = (x) => { if (x === '' || x == null) return null; const n = Number(String(x).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const linhas = (t) => v(t).split(/\n+/).map((x) => x.trim()).filter(Boolean);
const minHora = (hs) => hs.filter(Boolean).sort()[0] || '';
const maxHora = (hs) => hs.filter(Boolean).sort().slice(-1)[0] || '';

/** Frente do encarregado na modalidade (a mais comum entre as pessoas dele). */
export function frenteDoEnc(EF, enc, mod) {
  const n = {};
  for (const c of pessoasDoEnc(EF, enc)) if (c.frente && (!mod || modDe(EF, c.frente) === mod)) n[c.frente] = (n[c.frente] || 0) + 1;
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : '';
}

/** Início/término do lançamento: o informado no cabeçalho; no PPU, se vazio, o primeiro DDS e o último término dos equipamentos. */
export function horarioDoLancamento(D) {
  const eqs = D.modalidade === 'ppu' ? D.equipamentos || [] : [];
  const inicio = v(D.inicio) || minHora(eqs.map((e) => e.hor.ddsIni || e.hor.lib || e.hor.ini));
  const termino = v(D.termino) || maxHora(eqs.map((e) => e.hor.fim));
  return { inicio, termino };
}

/** Corpo do POST. `id` é o uuid do lançamento (o mesmo em todo reenvio). */
export function montarEnvio(D, EF, { id, appVersao, agora = new Date() }) {
  const ppu = D.modalidade === 'ppu';
  const { inicio, termino } = horarioDoLancamento(D);
  const fotos = [...(ppu ? [] : D.anexos || []), ...(ppu ? D.equipamentos || [] : []).flatMap((e) => e.anexos || [])]
    .map((a) => ({ momento: MOMENTOS.includes(a.momento) ? a.momento : null, legenda: v(a.legenda) }));
  return {
    versao: VERSAO_CONTRATO,
    id,
    app_versao: appVersao,
    enviado_em: agora.toISOString(),
    lancamento: {
      data: D.data || '',
      turno: v(D.turno),
      modalidade: D.modalidade,
      encarregado: v(D.encarregado),
      frente: frenteDoEnc(EF, D.encarregado, D.modalidade),
      inicio,
      termino,
      equipamentos: ppu ? (D.equipamentos || []).map((e) => ({
        tag: v(e.tag),
        servico: e.servico || 'desobstrucao',
        equipe: (e.equipe || []).map((p) => p.nome),
        hor: { ddsIni: v(e.hor.ddsIni), ddsFim: v(e.hor.ddsFim), lib: v(e.hor.lib), ini: v(e.hor.ini), fim: v(e.hor.fim) },
        prod: { total: num(e.prod.total), mapeados: num(e.prod.mapeados), desob: num(e.prod.desob), acum: num(e.prod.acum), pend: num(e.prod.pend), tamp: num(e.prod.tamp) },
        paradas: (e.paradas || []).map((p) => ({ resp: v(p.resp), motivo: v(p.motivo), ini: v(p.ini), fim: v(p.fim), impacto: v(p.impacto) })),
        ativ: { servico: v(e.ativ.servico), situacao: v(e.ativ.situacao), pend: v(e.ativ.pend), prox: v(e.ativ.prox) },
      })) : [],
      pessoas: (D.pessoas || []).map((p) => ({
        nome: p.nome,
        funcao: v(p.funcao),
        status: p.status,
        just: p.status === 'falta' ? v(p.just) : '',
        deveria: ppu && p.status === 'falta' ? v(p.deveria) : '',
        origem: p.origem,
        // o app não registra horas por pessoa: vão nulas, nunca estimadas
        hn: null, he65: null, he100: null, adn: null,
      })),
      os_executadas: D.modalidade === 'extra' ? linhas(D.osExec) : [],
      os_canceladas: D.modalidade === 'extra' ? linhas(D.osCanc) : [],
      atividades: D.modalidade === 'extra' ? v(D.atividades) : '',
      obs: v(D.obs),
      fotos,
    },
    texto_whatsapp: mensagem(D),
  };
}

/** uuid do lançamento (crypto.randomUUID quando houver). */
export function novoUuid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
