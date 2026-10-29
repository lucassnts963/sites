/* Mensagens do WhatsApp (formato do relatório) e validação do lançamento.
   O texto precisa sair idêntico ao da versão 0.1 (test/mensagens.test.js compara com ela). */
import { ROTULO_ST, MOD_TXT } from './constantes.js';
import { minutos, resumoParadas } from './tempo.js';
import { cap, dataBR, v } from './texto.js';

export const nomePessoa = (p) => p.nome + (p.origem === 'manual' ? ` (${p.contrato ? 'outro contrato: ' + p.contrato : 'sem cadastro'})` : '');

function blocoPPU(d, eq) {
  const L = [];
  const simNao = (x) => (x === 'sim' ? 'Sim' : x === 'nao' ? 'Não' : '');
  L.push('📊 *RELATÓRIO DIÁRIO DE PRODUÇÃO – MONTISOL | HYDRO ALUNORTE*', '');
  L.push(`📅 *Data:* ${dataBR(d.data)}`);
  L.push(`🔧 *Turno:* ${v(d.turno)}`);
  L.push(`🏷️ *TAG do trocador:* ${v(eq.tag)}`);
  L.push(`👷 *Equipe:* ${(eq.equipe || []).map(nomePessoa).join(', ')}`);
  L.push(`🦺 *AQS do serviço:* ${simNao(eq.aqs)}`);
  L.push(`• Nº ou referência da AQS: ${v(eq.aqsRef)}`, '');
  L.push('⏱️ *1. HORÁRIOS DA ATIVIDADE*');
  const dds = minutos(eq.hor.ddsIni, eq.hor.ddsFim);
  L.push(`• DDS – Início: ${v(eq.hor.ddsIni)}`, `• DDS – Término: ${v(eq.hor.ddsFim)}`, `• DDS – Tempo: ${dds == null ? '___' : dds} minutos`,
    `• Liberação da atividade: ${v(eq.hor.lib)}`, `• Início da desobstrução: ${v(eq.hor.ini)}`, `• Término da atividade: ${v(eq.hor.fim)}`, '');
  L.push('📋 *2. CONTROLE DE PRODUÇÃO*');
  L.push(`• Total de tubos do trocador: ${v(eq.prod.total)}`, `• Tubos obstruídos mapeados: ${v(eq.prod.mapeados)}`, `• Tubos desobstruídos no turno: ${v(eq.prod.desob)}`,
    `• Tubos pendentes: ${v(eq.prod.pend)}`, `• Tubos tamponados: ${v(eq.prod.tamp)}`, '');
  L.push('🚧 *3. CONTROLE DE PARADAS*');
  if (!(eq.paradas || []).length) L.push('', '• Sem paradas registradas');
  (eq.paradas || []).forEach((p, i) => {
    const m = minutos(p.ini, p.fim);
    L.push('', `*Parada ${i + 1}*`, `• Responsável: ${v(p.resp)}`, `• Motivo: ${v(p.motivo)}`, `• Início: ${v(p.ini)}`, `• Término: ${v(p.fim)}`,
      `• Tempo parado: ${m == null ? '___' : m} minutos`, `• Impacto na produção: ${simNao(p.impacto)}`);
  });
  const r = resumoParadas(eq.paradas);
  L.push('', '📈 *RESUMO DAS PARADAS*', `• Tempo total parado: ${r.total} minutos`, `• Total de paradas Hydro: ${r.hydro} minutos`, `• Total de paradas Montisol: ${r.montisol} minutos`, '');
  L.push('🔧 *4. ATIVIDADES / OBSERVAÇÕES*');
  L.push(`• Serviço executado: ${v(eq.ativ.servico)}`, `• Situação atual: ${v(eq.ativ.situacao)}`, `• Pendências: ${v(eq.ativ.pend)}`, `• Próxima etapa / TAG: ${v(eq.ativ.prox)}`, '');
  L.push('📸 *5. REGISTRO FOTOGRÁFICO*', `• Antes: ${v(eq.fotos.antes)}`, `• Depois: ${v(eq.fotos.depois)}`);
  return L.join('\n');
}

export const msgPPU = (d) => (d.equipamentos || []).map((eq) => blocoPPU(d, eq)).join('\n\n━━━━━━━━━━━━━━━━━━\n\n');

export function msgPresenca(d) {
  const ps = d.pessoas || [];
  const por = (st) => ps.filter((p) => p.status === st);
  const pres = por('presente'), faltas = por('falta'), fora = ps.filter((p) => p.status === 'ferias' || p.status === 'afastado');
  const semStatus = ps.filter((p) => !ROTULO_ST[p.status]);
  const extraInfo = (p) => (p.origem === 'outra' ? ` · outra equipe${p.frente ? ': ' + cap(p.frente) : ''}` : '');
  const linha = (p, i) => `${i + 1}. ${nomePessoa(p)}${p.funcao ? ' – ' + cap(p.funcao) : ''}${extraInfo(p)}`;
  const frentes = [...new Set(ps.filter((p) => p.origem === 'equipe' && p.frente).map((p) => cap(p.frente)))];
  const L = [];
  L.push('📋 *APONTAMENTO DE PRESENÇA – MONTISOL | HYDRO ALUNORTE*', '');
  L.push(`📅 *Data:* ${dataBR(d.data)}`, `🔧 *Turno:* ${v(d.turno)}`, `👷 *Encarregado:* ${v(d.encarregado)}`,
    `🏷️ *Equipe:* ${MOD_TXT[d.modalidade] || ''}${frentes.length ? ' – ' + frentes.join(', ') : ''}`, '');
  L.push(`✅ *PRESENTES (${pres.length})*`, ...(pres.length ? pres.map(linha) : ['• Nenhum']), '');
  L.push(`❌ *FALTAS (${faltas.length})*`, ...(faltas.length ? faltas.map((p, i) => `${linha(p, i)} – Justificativa: ${v(p.just) || 'Sem justificativa'}`) : ['• Nenhuma']), '');
  if (fora.length) L.push(`🏖️ *FÉRIAS / AFASTADOS (${fora.length})*`, ...fora.map((p, i) => `${linha(p, i)} – ${ROTULO_ST[p.status]}`), '');
  if (semStatus.length) L.push(`⚠️ *SEM STATUS (${semStatus.length})*`, ...semStatus.map(linha), '');
  const outras = ps.filter((p) => p.origem === 'outra').length, manuais = ps.filter((p) => p.origem === 'manual').length;
  L.push('📈 *RESUMO*', `• Apontados: ${ps.length} · Presentes: ${pres.length} · Faltas: ${faltas.length} · Férias/afastados: ${fora.length}`);
  if (outras || manuais) L.push(`• De outras equipes: ${outras} · Sem cadastro / outro contrato: ${manuais}`);
  if (d.modalidade === 'extra') {
    const itens = (t) => v(t).split(/\n+/).map((x) => x.trim()).filter(Boolean);
    const exec = itens(d.osExec), canc = itens(d.osCanc);
    L.push('', '🔧 *ATIVIDADES*', v(d.atividades) || '—');
    L.push('', `🧾 *OS EXECUTADAS (${exec.length})*`, ...(exec.length ? exec.map((x) => '• ' + x) : ['• Nenhuma']));
    L.push('', `🚫 *OS CANCELADAS (${canc.length})*`, ...(canc.length ? canc.map((x) => '• ' + x) : ['• Nenhuma']));
  } else if (v(d.obs)) {
    L.push('', '📝 *OBSERVAÇÕES*', v(d.obs));
  }
  return L.join('\n');
}

export const mensagem = (d) => (d.modalidade === 'ppu' ? msgPPU(d) : msgPresenca(d));

export function validar(d) {
  const erros = [];
  if (!v(d.encarregado)) erros.push('Escolha o encarregado.');
  if (!d.data) erros.push('Informe a data.');
  if (!v(d.turno)) erros.push('Informe o turno.');
  if (d.modalidade === 'ppu') {
    if (!(d.equipamentos || []).length) erros.push('Adicione pelo menos um equipamento.');
    (d.equipamentos || []).forEach((eq, i) => {
      if (!v(eq.tag)) erros.push(`Equipamento ${i + 1}: informe a TAG.`);
      if (!(eq.equipe || []).length) erros.push(`Equipamento ${i + 1}: aponte a equipe que trabalhou nele.`);
      if (!v(eq.hor.ddsIni) || !v(eq.hor.ddsFim)) erros.push(`Equipamento ${i + 1}: informe o início e o término do DDS.`);
      (eq.paradas || []).forEach((p, j) => { if (!p.resp) erros.push(`Equipamento ${i + 1}, parada ${j + 1}: informe o responsável (Hydro ou Montisol).`); });
    });
  } else {
    if (!(d.pessoas || []).length) erros.push('A lista da equipe está vazia.');
    (d.pessoas || []).forEach((p) => {
      if (!ROTULO_ST[p.status]) erros.push(`${p.nome}: marque presença ou falta.`);
      if (p.status === 'falta' && !v(p.just)) erros.push(`${p.nome}: falta precisa de justificativa (ou toque em "Sem justificativa").`);
    });
  }
  return erros;
}
