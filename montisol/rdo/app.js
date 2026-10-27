/* RDO de campo — Montisol | Trocador de Calor (Hydro Alunorte)
   Mini app estático (GitHub Pages): lançamento diário do encarregado.
   - PPU: relatório diário de produção por equipamento (TAG), com equipe, paradas e mapeamento do espelho.
   - Extra e 6x4: presença/falta da equipe (falta exige justificativa), atividades e OS (extra).
   Tudo fica salvo no aparelho (localStorage). Dados de apoio em ../dados/*.json e desenhos em ../desenhos/. */
(function () {
  'use strict';
  const VERSAO = '0.1.0';

  // ------------------------------------------------------------------ utilidades (sem DOM)
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const normTag = (s) => norm(s).replace(/[\s_]+/g, '-');
  const slug = (s) => norm(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sem-nome';
  const dataBR = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
  const cap = (s) => String(s || '').toLowerCase().replace(/(^|[\s/(.-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(Ii|Iii|Iv)\b/g, (m) => m.toUpperCase());
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /** Minutos entre dois horários "HH:MM" (passa da meia-noite se o fim for menor). */
  function minutos(ini, fim) {
    if (!ini || !fim) return null;
    const p = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    let d = p(fim) - p(ini);
    if (d < 0) d += 1440;
    return d;
  }

  function resumoParadas(paradas) {
    const r = { total: 0, hydro: 0, montisol: 0, semHorario: 0 };
    for (const p of paradas || []) {
      const m = minutos(p.ini, p.fim);
      if (m == null) { r.semHorario++; continue; }
      r.total += m;
      if (p.resp === 'Hydro') r.hydro += m;
      else if (p.resp === 'Montisol') r.montisol += m;
    }
    return r;
  }

  const ROTULO_ST = { presente: 'Presente', falta: 'Falta', ferias: 'Férias', afastado: 'Afastado' };
  const MOD_TXT = { ppu: 'PPU (desobstrução)', extra: 'Equipe extra (HH)', '6x4': 'Equipe fixa 6x4' };

  const nomePessoa = (p) => p.nome + (p.origem === 'manual' ? ` (${p.contrato ? 'outro contrato: ' + p.contrato : 'sem cadastro'})` : '');
  const v = (x) => (x == null ? '' : String(x).trim());

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
    L.push(`• DDS – Início: ${v(eq.hor.ddsIni)}`, `• DDS – Término: ${v(eq.hor.ddsFim)}`, `• DDS – Tempo: ${dds == null ? '___' : dds} minutos`, `• Liberação da atividade: ${v(eq.hor.lib)}`, `• Início da desobstrução: ${v(eq.hor.ini)}`, `• Término da atividade: ${v(eq.hor.fim)}`, '');
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

  function msgPPU(d) {
    return (d.equipamentos || []).map((eq) => blocoPPU(d, eq)).join('\n\n━━━━━━━━━━━━━━━━━━\n\n');
  }

  function msgPresenca(d) {
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

  const mensagem = (d) => (d.modalidade === 'ppu' ? msgPPU(d) : msgPresenca(d));

  function validar(d) {
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

  if (typeof window === 'undefined') {
    module.exports = { minutos, resumoParadas, msgPPU, msgPresenca, validar, norm, normTag, cap };
    return;
  }

  // ------------------------------------------------------------------ armazenamento no aparelho
  const LS = 'montisol-rdo:v1:';
  const $ = (s) => document.querySelector(s);
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2400); }
  const store = {
    get(k, d) { try { const x = localStorage.getItem(LS + k); return x == null ? d : JSON.parse(x); } catch (_) { return d; } },
    set(k, x) { try { localStorage.setItem(LS + k, JSON.stringify(x)); return true; } catch (e) { toast('Sem espaço no aparelho para salvar.'); return false; } },
    del(k) { localStorage.removeItem(LS + k); },
  };
  const hoje = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  // ------------------------------------------------------------------ dados de apoio
  const DADOS = '../dados/', DESENHOS = '../desenhos/';
  let EF = { colaboradores: [], frentes: {} }, FONTE = 'vazio', CAT = { desenhos: [], status: null }, TROC = [];
  async function getJson(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(url + ': ' + r.status); return r.json(); }
  async function carregar() {
    const imp = store.get('efetivo', null);
    let site = null;
    try { site = await getJson(DADOS + 'efetivo.json'); } catch (_) { /* o efetivo real não fica no repositório público */ }
    if (imp && (!site || String(imp.atualizado || '') >= String(site.atualizado || ''))) { EF = imp; FONTE = 'importado'; }
    else if (site) { EF = site; FONTE = 'site'; }
    else { try { EF = await getJson(DADOS + 'efetivo.exemplo.json'); FONTE = 'exemplo'; } catch (_) { FONTE = 'vazio'; } }
    EF.colaboradores = EF.colaboradores || [];
    EF.frentes = EF.frentes || {};
    try { CAT = await getJson(DESENHOS + 'catalogo.json'); } catch (_) { CAT = { desenhos: [], status: null }; }
    try { TROC = (await getJson(DADOS + 'trocadores.json')).trocadores || []; } catch (_) { TROC = []; }
    $('#avisoDados').hidden = !(FONTE === 'exemplo' || FONTE === 'vazio');
  }
  const modDe = (frente) => EF.frentes[frente] || '';
  const pessoasDoEnc = (enc) => EF.colaboradores.filter((c) => c.encarregado && norm(c.encarregado) === norm(enc));
  function encarregados() {
    const m = new Map();
    for (const c of EF.colaboradores) if (c.encarregado && modDe(c.frente)) m.set(norm(c.encarregado), c.encarregado);
    return [...m.values()].sort();
  }
  function modalidadeDoEnc(enc) {
    const n = {};
    for (const c of pessoasDoEnc(enc)) { const m = modDe(c.frente); if (m) n[m] = (n[m] || 0) + 1; }
    const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : '';
  }
  // Turnos do contrato (Anexo A): PPU de segunda a sexta; equipe fixa 6x4 em três turnos; extras seguem ADM/Tarde/Noite.
  const TURNOS_POR = {
    ppu: ['ADM (07h30–17h24)', 'Tarde (15h30–00h50)', 'Noite (23h00–07h30)'],
    extra: ['ADM', 'Tarde', 'Noite'],
    '6x4': ['Turno 07h–15h', 'Turno 15h–23h', 'Turno 23h–07h'],
  };
  const turnosDe = (mod) => TURNOS_POR[mod] || TURNOS_POR.ppu;
  /** Turno sugerido pelo efetivo (ADM / TARDE / NOITE) dentro da lista da modalidade; turma do 6x4 não define horário. */
  function turnoDoEnc(enc, mod) {
    const eu = EF.colaboradores.find((c) => norm(c.nome) === norm(enc));
    if (!eu) return '';
    const i = ['ADM', 'TARDE', 'NOITE'].indexOf(norm(eu.turno));
    return i < 0 ? '' : turnosDe(mod)[i];
  }
  function statusPadrao(c) {
    const s = norm(c.status);
    if (s.includes('FERIAS')) return 'ferias';
    if (s.includes('INSS') || s.includes('AFAST')) return 'afastado';
    return 'presente';
  }
  const pessoaDe = (c, origem) => ({ nome: c.nome, funcao: c.funcao || '', frente: c.frente || '', origem, contrato: '', status: statusPadrao(c), just: '' });
  const origemDe = (c) => (norm(c.encarregado) === norm(D.encarregado) && modDe(c.frente) === D.modalidade ? 'equipe' : 'outra');

  // ------------------------------------------------------------------ rascunho do lançamento
  function novoEq() {
    const equipe = D && D.encarregado
      ? pessoasDoEnc(D.encarregado).filter((c) => modDe(c.frente) === 'ppu' && statusPadrao(c) === 'presente').map((c) => pessoaDe(c, 'equipe'))
      : [];
    return { uid: uid(), tag: '', desenho: '', aqs: '', aqsRef: '', equipe, hor: { ddsIni: '', ddsFim: '', lib: '', ini: '', fim: '' },
      prod: { total: '', mapeados: '', desob: '', pend: '', tamp: '' }, paradas: [], ativ: { servico: '', situacao: '', pend: '', prox: '' },
      fotos: { antes: '', depois: '' }, mapaInicio: null };
  }
  function novoDraft() {
    const eu = store.get('eu', '');
    return { id: uid(), modalidade: (eu && modalidadeDoEnc(eu)) || 'ppu', data: hoje(), turno: eu ? turnoDoEnc(eu, (eu && modalidadeDoEnc(eu)) || 'ppu') : '', encarregado: eu || '',
      equipamentos: [], pessoas: [], atividades: '', osExec: '', osCanc: '', obs: '', criadoEm: new Date().toISOString() };
  }
  let D = null;
  const salvarRascunho = () => store.set('rascunho', D);
  function preencherEquipe() {
    let lista = pessoasDoEnc(D.encarregado).filter((c) => modDe(c.frente) === D.modalidade);
    if (!lista.length) lista = pessoasDoEnc(D.encarregado);
    D.pessoas = lista.map((c) => pessoaDe(c, 'equipe'));
  }
  function garantirConteudo() {
    if (D.modalidade === 'ppu' && !D.equipamentos.length) D.equipamentos.push(novoEq());
    if (D.modalidade !== 'ppu' && !D.pessoas.length && D.encarregado) preencherEquipe();
  }
  const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
  function setPath(o, p, val) { const ks = p.split('.'); let x = o; for (let i = 0; i < ks.length - 1; i++) x = x[ks[i]]; x[ks[ks.length - 1]] = val; }
  const alvoLista = (alvo) => (alvo === 'pres' ? D.pessoas : D.equipamentos[+alvo.split(':')[1]].equipe);

  // ------------------------------------------------------------------ registros (histórico local)
  function migrar(d) {
    for (const eq of (d && d.equipamentos) || []) {
      // registros restaurados de backup ou de versões antigas podem vir sem algum bloco
      eq.prod = Object.assign({ total: '', mapeados: '', desob: '', pend: '', tamp: '' }, eq.prod);
      eq.ativ = Object.assign({ servico: '', situacao: '', pend: '', prox: '' }, eq.ativ);
      eq.fotos = Object.assign({ antes: '', depois: '' }, eq.fotos);
      eq.equipe = eq.equipe || []; eq.paradas = eq.paradas || [];
      const h = eq.hor || (eq.hor = {});
      if (h.dds && !h.ddsIni) h.ddsIni = h.dds;
      delete h.dds;
      if (h.ddsIni === undefined) h.ddsIni = '';
      if (h.ddsFim === undefined) h.ddsFim = '';
    }
    return d;
  }
  const registros = () => store.get('registros', []).map(migrar);
  const ordenar = (regs) => regs.sort((a, b) => ((b.data || '') + (b.salvoEm || '')).localeCompare((a.data || '') + (a.salvoEm || '')));
  function gravarRegistro(extra) {
    const antes = registros();
    const antigo = antes.find((x) => x.id === D.id);
    const r = Object.assign(clone(D), { salvoEm: new Date().toISOString() }, extra || {});
    if (antigo && antigo.enviadoEm && !r.enviadoEm) r.enviadoEm = antigo.enviadoEm;
    return store.set('registros', ordenar([r, ...antes.filter((x) => x.id !== D.id)]));
  }

  // ------------------------------------------------------------------ telas
  let TELA = 'lancar';
  const opt = (val, rot, sel) => `<option value="${esc(val)}"${sel ? ' selected' : ''}>${esc(rot)}</option>`;
  const seg = (k, atual, opcoes) => `<div class="seg">${opcoes.map(([val, rot]) => `<button type="button" class="${atual === val ? 'on' : ''}" data-act="set" data-k="${k}" data-v="${esc(val)}">${rot}</button>`).join('')}</div>`;
  const campo = (rot, k, tipo, extra) => `<div><label>${rot}</label><input type="${tipo || 'text'}" data-k="${k}" value="${esc(getPath(D, k))}" ${extra || ''}></div>`;
  const area = (rot, k, ph) => `<label>${rot}</label><textarea data-k="${k}" placeholder="${esc(ph || '')}">${esc(getPath(D, k))}</textarea>`;

  function render() {
    document.querySelectorAll('#abas button').forEach((b) => b.classList.toggle('on', b.dataset.tela === TELA));
    const y = window.scrollY;
    $('#tela').innerHTML = TELA === 'lancar' ? telaLancar() : TELA === 'pesquisar' ? telaPesquisar() : TELA === 'historico' ? telaHistorico() : telaConfig();
    window.scrollTo(0, y);
  }

  function telaLancar() {
    const eu = store.get('eu', '');
    const encs = encarregados();
    const outro = D._digitar || (D.encarregado && !encs.some((e) => norm(e) === norm(D.encarregado)));
    let h = `<section class="card">
      <div class="linha" style="margin-top:0"><h2 style="margin:0">Lançamento</h2><span class="sp"></span>
        <button class="btn min" data-act="novo">🆕 Novo</button></div>
      ${D.data !== hoje() ? `<p class="dim">Este rascunho é de ${dataBR(D.data)}.</p>` : ''}
      <label>Encarregado</label>
      <select data-k="encarregado" data-re="enc">${opt('', '— escolha —', !D.encarregado && !outro)}${encs.map((e) => opt(e, e, norm(e) === norm(D.encarregado))).join('')}${opt('__outro', 'Outro (digitar o nome)', outro)}</select>
      ${outro ? `<input data-k="encarregado" placeholder="Nome do encarregado" value="${esc(D.encarregado)}" style="margin-top:6px">` : ''}
      <label style="display:flex;gap:8px;align-items:center;color:var(--text)"><input type="checkbox" style="width:22px;min-height:22px" data-act="lembrar" ${eu && norm(eu) === norm(D.encarregado) ? 'checked' : ''}> Lembrar que sou eu neste aparelho</label>
      <div class="grid2">
        ${campo('Data', 'data', 'date', 'data-re="1"')}
        <div><label>Turno</label><select data-k="turno" data-re="1">${opt('', '—', !D.turno)}${turnosDe(D.modalidade).map((t) => opt(t, t, t === D.turno)).join('')}${D.turno && !turnosDe(D.modalidade).includes(D.turno) ? opt(D.turno, D.turno, true) : ''}</select></div>
      </div>
      <label>Tipo de equipe</label>
      ${seg('modalidade', D.modalidade, [['ppu', 'PPU'], ['extra', 'Extra'], ['6x4', '6x4']])}
    </section>`;
    h += D.modalidade === 'ppu' ? formPPU() : formPresenca();
    h += `<div class="acoes"><button class="btn" data-act="ver">👁️ Ver</button><button class="btn" data-act="salvar">💾 Salvar</button><button class="btn wa" data-act="whats">📲 WhatsApp</button></div>`;
    return h;
  }

  // --- busca/adição de pessoas (serve para equipamento do PPU e para a lista de presença)
  function blocoAdicionar(alvo) {
    return `<div class="busca"><input type="search" placeholder="🔎 Adicionar colaborador pelo nome" data-busca="${alvo}" autocomplete="off"><div class="resultados" data-res="${alvo}"></div></div>
      <details><summary>➕ Digitar nome (sem cadastro / outro contrato)</summary>
        <div class="grid2"><div><label>Nome</label><input data-manual="${alvo}" data-f="nome"></div><div><label>Contrato / empresa</label><input data-manual="${alvo}" data-f="contrato" placeholder="ex.: Desincrustação"></div></div>
        <label>Função</label><input data-manual="${alvo}" data-f="funcao">
        <div class="linha"><button class="btn" data-act="manual" data-alvo="${alvo}">Adicionar</button></div>
      </details>`;
  }
  function resultadosBusca(alvo, q) {
    if (norm(q).length < 2) return '';
    const ja = new Set(alvoLista(alvo).map((p) => norm(p.nome)));
    const achados = [];
    EF.colaboradores.forEach((c, i) => { if (achados.length < 15 && norm(c.nome).includes(norm(q)) && !ja.has(norm(c.nome))) achados.push([c, i]); });
    return achados.map(([c, i]) => `<button data-act="add-pessoa" data-alvo="${alvo}" data-idx="${i}"><b>${esc(c.nome)}</b><small>${esc(cap(c.funcao))} · ${esc(cap(c.frente))} · enc. ${esc(c.encarregado || '—')}${c.status && norm(c.status) !== 'ATIVO' ? ' · ' + esc(cap(c.status)) : ''}</small></button>`).join('')
      + `<button data-act="manual-rapido" data-alvo="${alvo}" data-nome="${esc(q.trim())}">➕ Adicionar “${esc(q.trim())}” como nome sem cadastro</button>`;
  }
  const tagOrigem = (p) => (p.origem === 'outra' ? '<span class="tag outra">outra equipe</span>' : p.origem === 'manual' ? `<span class="tag manual">${p.contrato ? esc(p.contrato) : 'sem cadastro'}</span>` : '');

  // --- PPU
  const chaveMapa = (eq) => `mapa:${normTag(eq.tag)}:${eq.desenho}`;
  function contagemMapa(eq) {
    if (!eq.tag || !eq.desenho) return null;
    const est = store.get(chaveMapa(eq), null);
    if (!est) return null;
    const c = window.Mapa.contar(est, null);
    const d = CAT.desenhos.find((x) => x.id === eq.desenho);
    c.total = d ? d.tubos : '';
    return c;
  }
  function formPPU() {
    const tags = [...new Set([...TROC.map((t) => t.tag), ...registros().flatMap((r) => (r.equipamentos || []).map((e) => e.tag)).filter(Boolean)])];
    let h = `<datalist id="listaTags">${tags.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>`;
    D.equipamentos.forEach((eq, i) => {
      const k = `equipamentos.${i}`;
      const c = contagemMapa(eq);
      const r = resumoParadas(eq.paradas);
      h += `<section class="card eq">
        <div class="linha" style="margin-top:0"><b>Equipamento ${i + 1}${eq.tag ? ' · ' + esc(eq.tag) : ''}</b><span class="sp"></span>
          <button class="btn min" data-act="puxar-eq" data-i="${i}" title="Copia o último apontamento desta TAG">↺ Puxar anterior</button>
          <button class="btn min perigo" data-act="rm-eq" data-i="${i}" title="Remover equipamento">🗑</button></div>
        <div class="grid2">
          <div><label>TAG do trocador</label><input data-k="${k}.tag" list="listaTags" data-re="tag" value="${esc(eq.tag)}" placeholder="ex.: HE 41A-01A"></div>
          <div><label>Desenho do espelho</label><select data-k="${k}.desenho" data-re="desenho">${opt('', 'Sem desenho', !eq.desenho)}
            ${CAT.desenhos.map((d) => opt(d.id, `${d.tipo} – ${d.variacao}`, d.id === eq.desenho)).join('')}
            ${opt('__arquivo', '📂 SVG do aparelho…', eq.desenho === '__arquivo')}</select></div>
        </div>
        <div class="linha"><button class="btn" data-act="mapear" data-i="${i}" ${eq.tag && eq.desenho ? '' : 'disabled'}>🗺️ Mapear espelho</button>
          ${c ? `<span class="kpis"><span>🟢 ${c.desobstruido}</span><span>🔴 ${c.obstruido}</span><span>⚫ ${c.tamponado}</span><span>🟠 ${c.furado}</span></span>` : '<span class="dim" style="font-size:13px">sem mapeamento</span>'}</div>
        <label>AQS do serviço</label>${seg(`${k}.aqs`, eq.aqs, [['sim', 'Sim'], ['nao', 'Não']])}
        ${campo('Nº ou referência da AQS', `${k}.aqsRef`)}
        <h3>👷 Equipe que trabalhou no equipamento (${eq.equipe.length})</h3>
        <div class="chips">${eq.equipe.map((p, j) => `<span class="chip">${esc(p.nome)}${tagOrigem(p)}<button data-act="rm-pessoa" data-alvo="eq:${i}" data-j="${j}" aria-label="remover">✕</button></span>`).join('') || '<span class="dim">ninguém apontado</span>'}</div>
        ${blocoAdicionar(`eq:${i}`)}
        <h3>⏱️ 1. Horários da atividade</h3>
        <div class="grid2">${campo('DDS – início', `${k}.hor.ddsIni`, 'time', 'data-re="1"')}${campo('DDS – término', `${k}.hor.ddsFim`, 'time', 'data-re="1"')}</div>
        <p class="dim" style="margin:6px 0">Tempo do DDS: <b>${minutos(eq.hor.ddsIni, eq.hor.ddsFim) == null ? '—' : minutos(eq.hor.ddsIni, eq.hor.ddsFim) + ' min'}</b></p>
        <div class="grid4">${campo('Liberação', `${k}.hor.lib`, 'time')}${campo('Início desobstrução', `${k}.hor.ini`, 'time')}${campo('Término', `${k}.hor.fim`, 'time')}</div>
        <h3>📋 2. Controle de produção</h3>
        <div class="grid2">${campo('Total de tubos do trocador', `${k}.prod.total`, 'number', 'inputmode="numeric" min="0"')}${campo('Tubos obstruídos mapeados', `${k}.prod.mapeados`, 'number', 'inputmode="numeric" min="0"')}
          ${campo('Desobstruídos no turno', `${k}.prod.desob`, 'number', 'inputmode="numeric" min="0"')}${campo('Tubos pendentes', `${k}.prod.pend`, 'number', 'inputmode="numeric" min="0"')}
          ${campo('Tubos tamponados', `${k}.prod.tamp`, 'number', 'inputmode="numeric" min="0"')}</div>
        ${c ? `<div class="linha"><button class="btn min" data-act="usar-mapa" data-i="${i}">⇩ Usar números do mapa</button><small>desobstruídos no turno = desobstruídos agora − no início do lançamento</small></div>` : ''}
        <h3>🚧 3. Controle de paradas</h3>
        ${eq.paradas.map((p, j) => { const m = minutos(p.ini, p.fim); return `<div class="parada">
          <div class="linha" style="margin-top:0"><b>Parada ${j + 1}</b><span class="sp"></span><button class="btn min perigo" data-act="rm-parada" data-i="${i}" data-j="${j}">🗑</button></div>
          <label>Responsável</label>${seg(`${k}.paradas.${j}.resp`, p.resp, [['Hydro', 'Hydro'], ['Montisol', 'Montisol']])}
          ${campo('Motivo', `${k}.paradas.${j}.motivo`)}
          <div class="grid2">${campo('Início', `${k}.paradas.${j}.ini`, 'time', 'data-re="1"')}${campo('Término', `${k}.paradas.${j}.fim`, 'time', 'data-re="1"')}</div>
          <p class="dim" style="margin:6px 0">Tempo parado: <b>${m == null ? '—' : m + ' min'}</b></p>
          <label>Impacto na produção</label>${seg(`${k}.paradas.${j}.impacto`, p.impacto, [['sim', 'Sim'], ['nao', 'Não']])}
        </div>`; }).join('')}
        <div class="linha"><button class="btn min" data-act="add-parada" data-i="${i}">➕ Parada</button></div>
        <div class="resumo">📈 Total parado: <b>${r.total} min</b> · Hydro: <b>${r.hydro} min</b> · Montisol: <b>${r.montisol} min</b>${r.semHorario ? ` · ${r.semHorario} sem horário` : ''}</div>
        <h3>🔧 4. Atividades / observações</h3>
        ${area('Serviço executado', `${k}.ativ.servico`)}${area('Situação atual', `${k}.ativ.situacao`)}${area('Pendências', `${k}.ativ.pend`)}${campo('Próxima etapa / TAG', `${k}.ativ.prox`)}
        <h3>📸 5. Registro fotográfico</h3>
        <div class="grid2">${campo('Antes', `${k}.fotos.antes`, 'text', 'placeholder="ex.: 4 fotos no grupo"')}${campo('Depois', `${k}.fotos.depois`, 'text', 'placeholder="ex.: 4 fotos no grupo"')}</div>
      </section>`;
    });
    h += `<div class="linha"><button class="btn" data-act="add-eq">➕ Adicionar equipamento</button></div>`;
    return h;
  }

  // --- Extra e 6x4
  function formPresenca() {
    const ps = D.pessoas;
    const n = (st) => ps.filter((p) => p.status === st).length;
    const ja = new Set(ps.map((p) => norm(p.nome)));
    const doEnc = D.encarregado ? pessoasDoEnc(D.encarregado).filter((c) => !ja.has(norm(c.nome))) : [];
    let h = `<section class="card">
      <div class="linha" style="margin-top:0"><h2 style="margin:0">Equipe (${ps.length})</h2><span class="sp"></span>
        <button class="btn min" data-act="puxar-pres" title="Copia o último apontamento deste encarregado">↺ Anterior</button>
        <button class="btn min" data-act="recarregar-equipe" title="Recarrega a equipe do encarregado">⟳ Equipe</button></div>
      <div class="kpis" style="margin:8px 0"><span>✅ ${n('presente')}</span><span>❌ ${n('falta')}</span><span>🏖️ ${n('ferias') + n('afastado')}</span></div>
      ${!D.encarregado ? '<p class="dim">Escolha o encarregado para carregar a equipe.</p>' : ''}
      <div>${ps.map((p, j) => `<div class="pessoa">
        <div><div class="nome">${esc(p.nome)}${tagOrigem(p)}</div><div class="info">${esc(cap(p.funcao))}${p.frente ? ' · ' + esc(cap(p.frente)) : ''}</div></div>
        <button class="btn min" data-act="rm-pessoa" data-alvo="pres" data-j="${j}" aria-label="remover">✕</button>
        <div class="st">${Object.entries(ROTULO_ST).map(([st, rot]) => `<button class="${p.status === st ? 'on' : ''}" data-act="st" data-j="${j}" data-st="${st}">${rot}</button>`).join('')}</div>
        ${p.status === 'falta' ? `<div class="just"><input data-k="pessoas.${j}.just" placeholder="Justificativa da falta" value="${esc(p.just)}"><button class="btn min" data-act="sem-just" data-j="${j}">Sem justificativa</button></div>` : ''}
      </div>`).join('')}</div>
      ${doEnc.length ? `<h3>Também com este encarregado</h3><div class="chips">${doEnc.map((c) => `<button class="chip" data-act="add-pessoa" data-alvo="pres" data-idx="${EF.colaboradores.indexOf(c)}">＋ ${esc(c.nome)} <small>${esc(cap(c.frente))}</small></button>`).join('')}</div>` : ''}
      <h3>Adicionar alguém de outra equipe ou contrato</h3>
      ${blocoAdicionar('pres')}
    </section>`;
    if (D.modalidade === 'extra') {
      h += `<section class="card"><h2>Atividades e OS</h2>
        ${area('Atividades executadas', 'atividades', 'Descreva o que a equipe fez')}
        ${area('OS executadas (uma por linha)', 'osExec', 'ex.: 4012345 – limpeza do HE...')}
        ${area('OS canceladas (uma por linha, com o motivo)', 'osCanc', 'ex.: 4012399 – área não liberada')}
      </section>`;
    } else {
      h += `<section class="card"><h2>Observações</h2>${area('Observações (opcional)', 'obs')}</section>`;
    }
    return h;
  }

  // --- Pesquisa por colaborador
  let ULTIMA_Q = '';
  function telaPesquisar() {
    return `<section class="card"><h2 style="margin-top:0">Pesquisar colaborador</h2>
      <input type="search" id="q" placeholder="Nome (mín. 2 letras)" value="${esc(ULTIMA_Q)}" autocomplete="off">
      <div id="resPesq">${resultadosPesquisa(ULTIMA_Q)}</div></section>`;
  }
  function resultadosPesquisa(q) {
    if (norm(q).length < 2) return '<p class="dim">Digite parte do nome. Mostra a equipe, o encarregado e o histórico de apontamentos deste aparelho.</p>';
    const nq = norm(q);
    const regs = registros();
    const nomes = new Map();
    for (const c of EF.colaboradores) if (norm(c.nome).includes(nq)) nomes.set(norm(c.nome), c);
    for (const r of regs) {
      for (const p of [...(r.pessoas || []), ...(r.equipamentos || []).flatMap((e) => e.equipe || [])]) {
        if (norm(p.nome).includes(nq) && !nomes.has(norm(p.nome))) nomes.set(norm(p.nome), Object.assign({ semCadastro: true }, p));
      }
    }
    if (!nomes.size) return '<p class="dim">Ninguém encontrado.</p>';
    return [...nomes.values()].slice(0, 25).map((c) => {
      const hist = [];
      for (const r of regs) {
        const p = (r.pessoas || []).find((x) => norm(x.nome) === norm(c.nome));
        if (p) hist.push(`${dataBR(r.data)} · ${esc(r.turno)} · ${ROTULO_ST[p.status] || '—'}${p.status === 'falta' ? ' (' + esc(p.just || 'sem justificativa') + ')' : ''} · enc. ${esc(r.encarregado)}`);
        for (const e of r.equipamentos || []) if ((e.equipe || []).some((x) => norm(x.nome) === norm(c.nome))) hist.push(`${dataBR(r.data)} · ${esc(r.turno)} · PPU ${esc(e.tag)} · enc. ${esc(r.encarregado)}`);
      }
      const mod = modDe(c.frente);
      return `<div class="card"><b>${esc(c.nome)}</b>${c.semCadastro ? '<span class="tag manual">sem cadastro</span>' : ''}
        <div class="dim" style="font-size:14px">${esc(cap(c.funcao))}${c.frente ? ' · ' + esc(cap(c.frente)) : ''}${mod ? ' (' + esc(MOD_TXT[mod]) + ')' : ''}</div>
        ${c.semCadastro ? '' : `<div style="font-size:14px">Turno: ${esc(c.turno || '—')} · Status: ${esc(cap(c.status) || '—')}<br>Encarregado: ${esc(c.encarregado || '—')} · Supervisor: ${esc(c.supervisor || '—')}</div>`}
        ${hist.length ? `<details><summary>Apontamentos neste aparelho (${hist.length})</summary><ul>${hist.slice(0, 40).map((x) => `<li>${x}</li>`).join('')}</ul></details>` : '<small>Sem apontamentos neste aparelho.</small>'}
      </div>`;
    }).join('');
  }

  // --- Histórico
  function resumoRegistro(r) {
    if (r.modalidade === 'ppu') return (r.equipamentos || []).map((e) => `${esc(e.tag || 'sem TAG')}: ${esc(e.prod.desob || 0)} tubos`).join(' · ');
    const ps = r.pessoas || [];
    return `${ps.filter((p) => p.status === 'presente').length} presentes · ${ps.filter((p) => p.status === 'falta').length} faltas`;
  }
  function telaHistorico() {
    const regs = registros();
    return `<section class="card"><div class="linha" style="margin-top:0"><h2 style="margin:0">Histórico (${regs.length})</h2><span class="sp"></span>
        <button class="btn min" data-act="exportar">⬇ Backup</button><button class="btn min" data-act="importar">⬆ Restaurar</button></div>
      <p class="dim" style="font-size:13px">Fica só neste aparelho. Faça backup de vez em quando.</p></section>
      ${regs.map((r) => `<div class="card reg"><div><b>${dataBR(r.data)} · ${esc(r.turno || '—')} · ${esc(MOD_TXT[r.modalidade] || r.modalidade)}</b>
        <div class="dim" style="font-size:13px">${esc(r.encarregado)} · ${resumoRegistro(r)}</div></div>
        <span class="tag ${r.enviadoEm ? '' : 'outra'}">${r.enviadoEm ? 'enviado' : 'salvo'}</span>
        <div class="acoes-reg"><button class="btn min" data-act="reg-ver" data-id="${r.id}">👁️ Ver</button><button class="btn min" data-act="reg-editar" data-id="${r.id}">✏️ Editar</button>
          <button class="btn min" data-act="reg-dup" data-id="${r.id}">⧉ Duplicar p/ hoje</button><button class="btn min perigo" data-act="reg-del" data-id="${r.id}">🗑</button></div>
      </div>`).join('') || '<p class="dim">Nenhum registro ainda.</p>'}`;
  }

  // --- Configuração
  function telaConfig() {
    const eu = store.get('eu', '');
    const nMapas = Object.keys(localStorage).filter((k) => k.startsWith(LS + 'mapa:')).length;
    const fonte = { importado: 'importado neste aparelho', site: 'do site', exemplo: 'EXEMPLO (nomes fictícios)', vazio: 'nenhum' }[FONTE];
    return `<section class="card"><h2 style="margin-top:0">Efetivo</h2>
        <p>Fonte: <b>${fonte}</b><br>Atualizado em: ${esc(dataBR(EF.atualizado || ''))} · ${EF.colaboradores.length} colaboradores</p>
        <p class="dim" style="font-size:13px">O efetivo real não fica no site público. Importe o arquivo <b>efetivo.json</b> enviado pelo planejamento.</p>
        <div class="linha"><button class="btn" data-act="imp-efetivo">⬆ Importar efetivo</button>${FONTE === 'importado' ? '<button class="btn perigo" data-act="del-efetivo">Remover importado</button>' : ''}</div></section>
      <section class="card"><h2 style="margin-top:0">Quem sou eu</h2><p>${eu ? esc(eu) : '<span class="dim">não definido</span>'}</p>
        ${eu ? '<button class="btn" data-act="esquecer">Esquecer neste aparelho</button>' : ''}</section>
      <section class="card"><h2 style="margin-top:0">Mapeamentos</h2><p>${nMapas} espelho(s) guardado(s) neste aparelho.</p>
        <p class="dim" style="font-size:13px">Desenhos disponíveis: ${CAT.desenhos.length}. TAGs cadastradas: ${TROC.length}.</p></section>
      <p class="dim" style="text-align:center;font-size:12px">RDO de campo v${VERSAO} · sem login; os dados ficam no aparelho.</p>`;
  }

  // ------------------------------------------------------------------ mapeamento
  const sheets = new Map();
  async function sheetDe(eq) {
    if (eq.desenho === '__arquivo') {
      const txt = store.get('svg:' + normTag(eq.tag), null);
      return txt ? window.Mapa.parseSheet(txt).sheet : null;
    }
    if (sheets.has(eq.desenho)) return sheets.get(eq.desenho);
    const d = CAT.desenhos.find((x) => x.id === eq.desenho);
    if (!d) return null;
    const r = await fetch(DESENHOS + d.arquivo);
    if (!r.ok) throw new Error('Desenho não encontrado no site: ' + d.arquivo);
    const { sheet } = window.Mapa.parseSheet(await r.text());
    sheets.set(eq.desenho, sheet);
    return sheet;
  }
  async function mapear(i) {
    const eq = D.equipamentos[i];
    let sheet;
    try { sheet = await sheetDe(eq); } catch (e) { toast(e.message); return; }
    if (!sheet) { toast('Escolha o desenho do espelho (ou abra o SVG do aparelho).'); return; }
    const estado = store.get(chaveMapa(eq), {});
    if (!eq.mapaInicio) { eq.mapaInicio = window.Mapa.contar(estado, sheet); salvarRascunho(); }
    window.Mapa.abrir($('#mapa'), {
      sheet, estado, statuses: CAT.status, titulo: eq.tag,
      onChange: (est) => store.set(chaveMapa(eq), est),
      onClose: (est) => { store.set(chaveMapa(eq), est); render(); },
      onExport: (est) => exportarSvg(eq, sheet, est),
    });
  }
  async function compartilharArquivo(nome, texto, tipo) {
    const blob = new Blob([texto], { type: tipo });
    const file = new File([blob], nome, { type: tipo });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: nome }); toast('Enviado'); return; } catch (_) { /* cancelado: baixa o arquivo */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('Arquivo salvo: ' + nome);
  }
  function exportarSvg(eq, sheet, est) {
    const c = window.Mapa.contar(est, sheet);
    const turno = Math.max(0, c.desobstruido - ((eq.mapaInicio && eq.mapaInicio.desobstruido) || 0));
    const svg = window.Mapa.exportSvg(sheet, est, { trocador: eq.tag, data: D.data, resp: D.encarregado, desenho: eq.desenho, desobstruidosTurno: turno }, CAT.status);
    compartilharArquivo(`mapeamento-${slug(eq.tag)}-${D.data}-${slug(D.turno || 'turno')}.svg`, svg, 'image/svg+xml');
  }
  function usarMapa(i) {
    const eq = D.equipamentos[i];
    const c = contagemMapa(eq);
    if (!c) return;
    if (c.total !== '') eq.prod.total = String(c.total);
    eq.prod.mapeados = String(c.obstruido + c.desobstruido);
    eq.prod.desob = String(Math.max(0, c.desobstruido - ((eq.mapaInicio && eq.mapaInicio.desobstruido) || 0)));
    eq.prod.pend = String(c.obstruido);
    eq.prod.tamp = String(c.tamponado);
    salvarRascunho();
    render();
    toast('Produção preenchida com os números do mapa');
  }

  // ------------------------------------------------------------------ ações
  function abrirArquivo(accept, cb) {
    const inp = $('#arquivo');
    inp.accept = accept;
    inp.onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) cb(await f.text(), f.name); };
    inp.click();
  }
  function dlg(html) { $('#dlgCorpo').innerHTML = html; if (!$('#dlg').open) $('#dlg').showModal(); }
  async function copiar(txt) {
    try { await navigator.clipboard.writeText(txt); toast('Mensagem copiada'); }
    catch (_) { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); toast('Mensagem copiada'); }
  }
  let MSG_ATUAL = '';
  function mostrarMensagem(msg, erros) {
    MSG_ATUAL = msg;
    dlg(`${erros && erros.length ? `<div class="card" style="border-color:#5a2a2a"><b>Falta completar:</b><ul>${erros.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
      <pre class="msg">${esc(msg)}</pre>
      <div class="linha"><button class="btn" data-act="copiar">📋 Copiar</button><button class="btn wa" data-act="whats-msg" ${erros && erros.length ? 'disabled' : ''}>📲 WhatsApp</button><span class="sp"></span><button class="btn" data-act="fechar-dlg">Fechar</button></div>`);
  }
  function enviarWhats(msg) {
    const url = 'https://wa.me/?text=' + encodeURIComponent(msg);
    // mensagens muito longas (vários equipamentos) estouram o limite do link: copia e abre o WhatsApp vazio
    if (url.length > 6000) { copiar(msg); toast('Mensagem longa copiada: cole no WhatsApp'); window.open('https://wa.me/', '_blank'); return; }
    window.open(url, '_blank');
  }

  const ACOES = {
    novo() { if (!confirm('Começar um lançamento novo? Salve antes se quiser guardar o atual no histórico.')) return; D = novoDraft(); garantirConteudo(); salvarRascunho(); render(); },
    lembrar(el) {
      if (el.checked && D.encarregado) { store.set('eu', D.encarregado); toast('Pronto: este aparelho lembra de ' + D.encarregado); }
      else { store.del('eu'); if (el.checked) { el.checked = false; toast('Escolha o encarregado primeiro'); } }
    },
    set(el) {
      setPath(D, el.dataset.k, el.dataset.v);
      if (el.dataset.k === 'modalidade') {
        if (!turnosDe(D.modalidade).includes(D.turno)) D.turno = turnoDoEnc(D.encarregado, D.modalidade);
        garantirConteudo();
      }
      salvarRascunho(); render();
    },
    'add-eq'() { D.equipamentos.push(novoEq()); salvarRascunho(); render(); },
    'rm-eq'(el) { const i = +el.dataset.i; if (!confirm(`Remover o equipamento ${i + 1}?`)) return; D.equipamentos.splice(i, 1); salvarRascunho(); render(); },
    'add-parada'(el) { D.equipamentos[+el.dataset.i].paradas.push({ resp: '', motivo: '', ini: '', fim: '', impacto: '' }); salvarRascunho(); render(); },
    'rm-parada'(el) { D.equipamentos[+el.dataset.i].paradas.splice(+el.dataset.j, 1); salvarRascunho(); render(); },
    'add-pessoa'(el) {
      const c = EF.colaboradores[+el.dataset.idx];
      if (!c) return;
      const lista = alvoLista(el.dataset.alvo);
      if (lista.some((p) => norm(p.nome) === norm(c.nome))) { toast('Já está na lista'); return; }
      lista.push(pessoaDe(c, origemDe(c)));
      salvarRascunho(); render();
    },
    'manual-rapido'(el) {
      alvoLista(el.dataset.alvo).push({ nome: el.dataset.nome.toUpperCase(), funcao: '', frente: '', origem: 'manual', contrato: '', status: 'presente', just: '' });
      salvarRascunho(); render();
    },
    manual(el) {
      const alvo = el.dataset.alvo;
      const f = (k) => (document.querySelector(`[data-manual="${alvo}"][data-f="${k}"]`) || {}).value || '';
      if (!f('nome').trim()) { toast('Digite o nome'); return; }
      alvoLista(alvo).push({ nome: f('nome').trim().toUpperCase(), funcao: f('funcao').trim().toUpperCase(), frente: '', origem: 'manual', contrato: f('contrato').trim(), status: 'presente', just: '' });
      salvarRascunho(); render();
    },
    'rm-pessoa'(el) { alvoLista(el.dataset.alvo).splice(+el.dataset.j, 1); salvarRascunho(); render(); },
    st(el) { const p = D.pessoas[+el.dataset.j]; p.status = el.dataset.st; if (p.status !== 'falta') p.just = ''; salvarRascunho(); render(); },
    'sem-just'(el) { D.pessoas[+el.dataset.j].just = 'Sem justificativa'; salvarRascunho(); render(); },
    'recarregar-equipe'() {
      if (!D.encarregado) { toast('Escolha o encarregado'); return; }
      if (D.pessoas.length && !confirm('Substituir a lista atual pela equipe do encarregado?')) return;
      preencherEquipe(); salvarRascunho(); render();
    },
    'puxar-pres'() {
      const r = registros().find((x) => x.id !== D.id && x.modalidade === D.modalidade && norm(x.encarregado) === norm(D.encarregado));
      if (!r) { toast('Nenhum apontamento anterior deste encarregado nesta equipe'); return; }
      if (D.pessoas.length && !confirm(`Trocar a lista pela do apontamento de ${dataBR(r.data)} (${r.turno})?`)) return;
      D.pessoas = clone(r.pessoas || []);
      salvarRascunho(); render(); toast(`Puxado de ${dataBR(r.data)}`);
    },
    'puxar-eq'(el) {
      const eq = D.equipamentos[+el.dataset.i];
      let achado = null;
      for (const r of registros()) {
        if (r.id === D.id || r.modalidade !== 'ppu') continue;
        for (const e of r.equipamentos || []) {
          if (eq.tag ? normTag(e.tag) === normTag(eq.tag) : norm(r.encarregado) === norm(D.encarregado)) { achado = { r, e }; break; }
        }
        if (achado) break;
      }
      if (!achado) { toast(eq.tag ? 'Nenhum apontamento anterior desta TAG' : 'Nenhum apontamento anterior deste encarregado'); return; }
      const { r, e } = achado;
      if (!confirm(`Copiar o apontamento de ${dataBR(r.data)} (${r.turno}) da TAG ${e.tag}? Horários, paradas e fotos não são copiados.`)) return;
      Object.assign(eq, { tag: eq.tag || e.tag, desenho: e.desenho, aqs: e.aqs, aqsRef: e.aqsRef, equipe: clone(e.equipe || []),
        prod: { total: e.prod.total, mapeados: e.prod.mapeados, desob: '', pend: e.prod.pend, tamp: e.prod.tamp }, ativ: clone(e.ativ) });
      salvarRascunho(); render(); toast('Apontamento anterior copiado: ajuste o que mudou');
    },
    mapear(el) { mapear(+el.dataset.i); },
    'usar-mapa'(el) { usarMapa(+el.dataset.i); },
    ver() { mostrarMensagem(mensagem(D), validar(D)); },
    salvar() { if (gravarRegistro()) toast('Salvo no histórico deste aparelho'); },
    whats() {
      const erros = validar(D);
      if (erros.length) { mostrarMensagem(mensagem(D), erros); return; }
      gravarRegistro({ enviadoEm: new Date().toISOString() });
      enviarWhats(mensagem(D));
    },
    'whats-msg'() { gravarRegistro({ enviadoEm: new Date().toISOString() }); enviarWhats(MSG_ATUAL); },
    copiar() { copiar(MSG_ATUAL); },
    'fechar-dlg'() { $('#dlg').close(); },
    'reg-ver'(el) { const r = registros().find((x) => x.id === el.dataset.id); if (r) mostrarMensagem(mensagem(r), []); },
    'reg-editar'(el) {
      const r = registros().find((x) => x.id === el.dataset.id);
      if (!r || !confirm('Abrir este registro para editar? O rascunho atual será substituído.')) return;
      D = clone(r); delete D.salvoEm; salvarRascunho(); TELA = 'lancar'; render();
    },
    'reg-dup'(el) {
      const r = registros().find((x) => x.id === el.dataset.id);
      if (!r || !confirm('Criar um lançamento de hoje a partir deste? O rascunho atual será substituído.')) return;
      D = clone(r); D.id = uid(); D.data = hoje(); D.criadoEm = new Date().toISOString(); delete D.salvoEm; delete D.enviadoEm;
      for (const eq of D.equipamentos || []) { eq.hor = { ddsIni: '', ddsFim: '', lib: '', ini: '', fim: '' }; eq.paradas = []; eq.fotos = { antes: '', depois: '' }; eq.prod.desob = ''; eq.mapaInicio = null; }
      salvarRascunho(); TELA = 'lancar'; render();
    },
    'reg-del'(el) { if (!confirm('Excluir este registro do aparelho?')) return; store.set('registros', registros().filter((x) => x.id !== el.dataset.id)); render(); },
    exportar() { compartilharArquivo(`rdo-backup-${hoje()}.json`, JSON.stringify({ versao: VERSAO, exportadoEm: new Date().toISOString(), registros: registros() }, null, 1), 'application/json'); },
    importar() {
      abrirArquivo('.json,application/json', (txt) => {
        try {
          const o = JSON.parse(txt);
          const atual = registros();
          const ids = new Set(atual.map((r) => r.id));
          const novos = (o.registros || []).filter((r) => r.id && !ids.has(r.id));
          store.set('registros', ordenar(atual.concat(novos)));
          render(); toast(`${novos.length} registro(s) restaurado(s)`);
        } catch (e) { alert('Arquivo inválido: ' + e.message); }
      });
    },
    'imp-efetivo'() {
      abrirArquivo('.json,application/json', async (txt) => {
        try {
          const o = JSON.parse(txt);
          if (!Array.isArray(o.colaboradores)) throw new Error('não tem a lista "colaboradores"');
          store.set('efetivo', o); await carregar(); render(); toast(`Efetivo importado: ${o.colaboradores.length} colaboradores`);
        } catch (e) { alert('Arquivo inválido: ' + e.message); }
      });
    },
    async 'del-efetivo'() { if (!confirm('Remover o efetivo importado deste aparelho?')) return; store.del('efetivo'); await carregar(); render(); },
    esquecer() { store.del('eu'); render(); },
  };

  // ------------------------------------------------------------------ eventos
  document.addEventListener('click', (e) => {
    const aba = e.target.closest('#abas button');
    if (aba) { TELA = aba.dataset.tela; render(); window.scrollTo(0, 0); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const f = ACOES[el.dataset.act];
    if (f) { if (el.tagName !== 'INPUT') e.preventDefault(); f(el); }
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'q') { ULTIMA_Q = el.value; $('#resPesq').innerHTML = resultadosPesquisa(el.value); return; }
    if (el.dataset.busca) { document.querySelector(`[data-res="${el.dataset.busca}"]`).innerHTML = resultadosBusca(el.dataset.busca, el.value); return; }
    if (el.dataset.k && !el.dataset.re && el.tagName !== 'SELECT') { setPath(D, el.dataset.k, el.value); salvarRascunho(); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.dataset.k || !el.dataset.re) return;
    const re = el.dataset.re;
    if (re === 'enc' && el.value === '__outro') { D._digitar = true; D.encarregado = ''; salvarRascunho(); render(); return; }
    setPath(D, el.dataset.k, el.value);
    if (re === 'enc') {
      delete D._digitar;
      const mod = modalidadeDoEnc(D.encarregado);
      if (mod) D.modalidade = mod;
      if (!D.turno || !turnosDe(D.modalidade).includes(D.turno)) D.turno = turnoDoEnc(D.encarregado, D.modalidade);
      if (D.modalidade !== 'ppu') { if (!D.pessoas.length || confirm('Carregar a equipe deste encarregado na lista?')) preencherEquipe(); }
      else if (D.equipamentos.length === 1 && !D.equipamentos[0].tag) D.equipamentos[0] = novoEq();
      garantirConteudo();
    }
    if (re === 'tag') {
      const eq = D.equipamentos[+el.dataset.k.split('.')[1]];
      const t = TROC.find((x) => normTag(x.tag) === normTag(eq.tag));
      if (t && !eq.desenho) eq.desenho = t.desenho;
      eq.mapaInicio = null;
    }
    if (re === 'desenho') {
      const eq = D.equipamentos[+el.dataset.k.split('.')[1]];
      eq.mapaInicio = null;
      if (eq.desenho === '__arquivo') {
        if (!eq.tag) { eq.desenho = ''; toast('Informe a TAG antes de abrir o SVG'); salvarRascunho(); render(); return; }
        abrirArquivo('.svg,image/svg+xml', (txt) => {
          try {
            const lido = window.Mapa.parseSheet(txt);
            if (!lido.sheet.tubes.length) throw new Error('nenhum tubo no desenho');
            store.set('svg:' + normTag(eq.tag), txt);
            const n = Object.keys(lido.estado).length;
            if (n && confirm(`O SVG já traz ${n} tubos marcados. Usar essa marcação?`)) store.set(chaveMapa(eq), lido.estado);
            salvarRascunho(); render(); toast(`${lido.sheet.tubes.length} tubos carregados`);
          } catch (x) { eq.desenho = ''; salvarRascunho(); render(); alert('Não foi possível abrir: ' + x.message); }
        });
      }
    }
    salvarRascunho();
    render();
  });

  // ------------------------------------------------------------------ início
  carregar().then(() => {
    D = migrar(store.get('rascunho', null)) || novoDraft();
    D.equipamentos = D.equipamentos || [];
    D.pessoas = D.pessoas || [];
    garantirConteudo();
    salvarRascunho();
    render();
  });
})();
