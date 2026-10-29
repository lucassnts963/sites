/* PPU: um cartão por equipamento (TAG) com equipe, AQS, horários, produção, paradas, atividades e fotos. */
import { useEffect, useState } from 'react';
import { useApp } from '../estado.jsx';
import { AdicionarPessoa, TagOrigem } from '../componentes/AdicionarPessoa.jsx';
import { Area, Campo, Numero, Seg, Sp } from '../componentes/campos.jsx';
import { abrirArquivo } from '../lib/arquivos.js';
import { DESENHOS } from '../lib/constantes.js';
import { contar, exportSvg, parseSheet } from '../lib/mapa.js';
import { completarPelaTag, copiarApontamento, novoEq, paradaVazia } from '../lib/rascunho.js';
import { editarManut, garantirManut, gravarMapa, importarPassagem, lerMapa, manutDe, montarPassagem, novaManutDaTag, turnosDaTag } from '../lib/passagem.js';
import { lerPassagem, producao } from '../lib/turnos.js';
import { mapaHtml } from '../lib/mapaImagem.js';
import { TabelaTurnos } from '../componentes/TabelaTurnos.jsx';
import { useEnvio } from '../componentes/useEnvio.js';
import { Fotos } from '../componentes/Fotos.jsx';
import { PresencaPPU } from './PresencaPPU.jsx';
import { chaveSvg, store } from '../lib/store.js';
import { minutos, resumoParadas } from '../lib/tempo.js';
import { dataBR, norm, normTag, slug } from '../lib/texto.js';

// Desenhos do catálogo já lidos (o SVG grande demora para medir).
const folhas = new Map();
async function folhaDe(eq, CAT) {
  if (eq.desenho === '__arquivo') {
    const txt = store.get(chaveSvg(eq.tag), null);
    return txt ? parseSheet(txt).sheet : null;
  }
  if (folhas.has(eq.desenho)) return folhas.get(eq.desenho);
  const d = CAT.desenhos.find((x) => x.id === eq.desenho);
  if (!d) return null;
  const r = await fetch(DESENHOS + d.arquivo);
  if (!r.ok) throw new Error('Desenho não encontrado no site: ' + d.arquivo);
  const { sheet } = parseSheet(await r.text());
  folhas.set(eq.desenho, sheet);
  return sheet;
}

/** Contagem do mapa guardado para a TAG + desenho, com o total de tubos do catálogo. */
export function contagemMapa(eq, CAT) {
  if (!eq.tag || !eq.desenho) return null;
  const est = lerMapa(eq.tag, eq.desenho).estado;
  if (!Object.keys(est).length) return null;
  const c = contar(est, null);
  const d = CAT.desenhos.find((x) => x.id === eq.desenho);
  c.total = d ? d.tubos : '';
  return c;
}

const Tempo = ({ ini, fim, rot }) => { const m = minutos(ini, fim); return <p className="dim calc">{rot}: <b>{m == null ? '—' : m + ' min'}</b></p>; };

function Parada({ i, j, p }) {
  const { mudar } = useApp();
  const k = `equipamentos.${i}.paradas.${j}`;
  return (
    <div className="parada">
      <div className="linha topo-card"><b>Parada {j + 1}</b><Sp />
        <button type="button" className="btn min perigo" onClick={() => mudar((d) => { d.equipamentos[i].paradas.splice(j, 1); })}>🗑</button></div>
      <label>Responsável</label><Seg k={`${k}.resp`} opcoes={[['Hydro', 'Hydro'], ['Montisol', 'Montisol']]} />
      <Campo rot="Motivo" k={`${k}.motivo`} />
      <div className="grid2"><Campo rot="Início" k={`${k}.ini`} tipo="time" /><Campo rot="Término" k={`${k}.fim`} tipo="time" /></div>
      <Tempo rot="Tempo parado" ini={p.ini} fim={p.fim} />
      <label>Impacto na produção</label><Seg k={`${k}.impacto`} opcoes={[['sim', 'Sim'], ['nao', 'Não']]} />
    </div>
  );
}

/** Controle de produção: dados da manutenção (uma vez por TAG), números do turno vindos do mapa, histórico turno a turno
    e passagem de turno para o próximo encarregado. */
function Producao({ eq, i, c, folha }) {
  const { dados, D, mudar, toast, tocar, versao } = useApp();
  const enviar = useEnvio();
  const manut = manutDe(eq.tag);
  const mapa = lerMapa(eq.tag, eq.desenho);
  const turnos = turnosDaTag(eq.tag);
  const p = producao({ manut, estado: mapa.estado, ts: mapa.ts, lid: D.id, manual: eq.prod, turnos });
  const k = `equipamentos.${i}`;

  // os números calculados vão para o lançamento (mensagem, histórico)
  const campos = ['total', 'mapeados', 'desob', 'pend', 'tamp', 'acum'];
  const difere = campos.some((f) => String(eq.prod[f] || '') !== String(p[f] || ''));
  useEffect(() => {
    if (difere) mudar((d) => { for (const f of campos) d.equipamentos[i].prod[f] = p[f]; });
  });

  const editar = (campo, val) => {
    if (!eq.tag) { toast('Informe a TAG primeiro'); return; }
    editarManut(eq.tag, eq.desenho, { [campo]: val }, { total: eq.prod.total });
    tocar();
  };
  const novaManut = () => {
    if (!confirm(`Encerrar a manutenção atual da ${eq.tag} e começar outra? O espelho volta limpo (o mapa antigo fica guardado no aparelho).`)) return;
    novaManutDaTag(eq.tag, eq.desenho, { total: eq.prod.total });
    tocar(); toast('Nova manutenção iniciada');
  };
  const passar = () => enviar(`passagem|${eq.tag}|${versao}|${JSON.stringify(mapa.ts).length}`, async () => {
    garantirManut(eq.tag, eq.desenho, { total: eq.prod.total, obstruidos: eq.prod.mapeados });
    const pass = montarPassagem(eq.tag, eq.desenho, D.encarregado);
    let svg = '', cc = null;
    const sheet = eq.desenho ? await folha().catch(() => null) : null;
    if (sheet) {
      cc = contar(mapa.estado, sheet);
      svg = exportSvg(sheet, mapa.estado, { trocador: eq.tag, data: D.data, resp: D.encarregado, desenho: eq.desenho, desobstruidosTurno: p.desob }, dados.CAT.status);
    }
    const meta = { trocador: eq.tag, data: D.data, turno: D.turno, resp: D.encarregado };
    const nome = `passagem-${slug(eq.tag)}-${D.data}-${slug(D.turno || 'turno')}.html`;
    const texto = [`🔁 *Passagem de turno – ${eq.tag}* – ${dataBR(D.data)} – ${D.turno || ''}`, `👷 ${D.encarregado}`,
      `🟢 Desobstruídos no turno: ${p.desob || 0} · Acumulado: ${p.acum || 0}${p.mapeados ? ' de ' + p.mapeados : ''}`, `🔴 Pendentes: ${p.pend || 0} · ⚫ Tamponados: ${p.tamp || 0}`,
      'Próximo encarregado: abra o arquivo no RDO › 📥 Receber passagem.'].join('\n');
    return { files: [new File([mapaHtml(svg, meta, cc, pass)], nome, { type: 'text/html' })], text: texto };
  });
  const receber = async () => {
    const arq = await abrirArquivo('.html,.json,text/html,application/json');
    if (!arq) return;
    try {
      const pass = lerPassagem(arq.texto);
      if (!pass) throw new Error('o arquivo não é uma passagem de turno do RDO');
      if (eq.tag && normTag(pass.tag) !== normTag(eq.tag) && !confirm(`A passagem é da TAG ${pass.tag}, não da ${eq.tag}. Importar mesmo assim (para a ${pass.tag})?`)) return;
      const r = importarPassagem(pass);
      if (!eq.tag) mudar((d) => { d.equipamentos[i].tag = pass.tag; d.equipamentos[i].desenho = pass.desenho; });
      tocar();
      toast(`Passagem de ${r.de || 'outro aparelho'} (${r.tag}): ${r.tubos} tubo(s) atualizado(s), ${r.turnosNovos} turno(s) novo(s)${r.mapaIgnorado ? ' · mapa de manutenção encerrada ignorado' : ''}`);
    } catch (e) { alert('Não foi possível receber: ' + e.message); }
  };
  const pct = p.mapeados && +p.mapeados ? Math.round((+p.acum / +p.mapeados) * 100) : null;
  const ultimo = turnos.find((t) => t.lid !== D.id);

  return (
    <>
      <div className="manut">
        <div className="linha topo-card"><b>🔧 Manutenção {eq.tag ? 'da ' + eq.tag : ''}</b><Sp />
          <small className="dim">{manut ? 'desde ' + dataBR(manut.inicio.slice(0, 10)) : eq.tag ? 'nova' : ''}</small></div>
        <div className="grid2">
          <div><label>Total de tubos do trocador</label>
            <input type="number" inputMode="numeric" min="0" disabled={!eq.tag} value={manut && manut.total !== '' ? manut.total : eq.prod.total || ''} onChange={(e) => editar('total', e.target.value)} /></div>
          <div><label>Total obstruídos (escopo)</label>
            <input type="number" inputMode="numeric" min="0" disabled={!eq.tag} value={manut ? manut.obstruidos : eq.prod.mapeados || ''} onChange={(e) => editar('obstruidos', e.target.value)} /></div>
        </div>
        {c && manut && !manut.obstruidos && c.obstruido + c.desobstruido > 0 && (
          <div className="linha"><button type="button" className="btn min" onClick={() => editar('obstruidos', String(c.obstruido + c.desobstruido))}>⇩ Usar do mapa ({c.obstruido + c.desobstruido})</button></div>
        )}
        <p className="dim pequeno">Preenchidos uma vez: valem para os próximos turnos desta TAG e vão na passagem de turno. Pode corrigir quando precisar.</p>
      </div>

      {p.modo === 'mapa' ? (
        <>
          <div className="prod-mapa">
            <div><small>Desobstruídos no turno</small><b>{p.desob}</b></div>
            <div><small>Acumulado</small><b>{p.acum}{p.mapeados ? <small> de {p.mapeados}</small> : null}</b>{pct != null && <small>{pct}%</small>}</div>
            <div><small>Pendentes</small><b>{p.pend}</b></div>
            <div><small>Tamponados</small><b>{p.tamp}</b></div>
          </div>
          <p className="dim pequeno">Vêm do mapeamento: no turno contam só os tubos marcados neste lançamento.</p>
        </>
      ) : (
        <>
          <div className="grid2">
            <Numero rot="Desobstruídos no turno" k={`${k}.prod.desob`} />
            <Numero rot="Tubos pendentes" k={`${k}.prod.pend`} placeholder={p.sugestaoPend ? 'escopo − acumulado: ' + p.sugestaoPend : ''} />
            <Numero rot="Tubos tamponados" k={`${k}.prod.tamp`} />
            <div><label>Acumulado na manutenção</label><input disabled value={p.acum} /></div>
          </div>
          <p className="dim pequeno">Sem mapeamento marcado: digite. Ao marcar o espelho, estes números passam a vir dele.</p>
        </>
      )}

      {eq.tag && <details className="hist-turnos" open={turnos.length > 0 && turnos.length < 4}>
        <summary>📈 Turno a turno ({turnos.length}){ultimo ? ` · último: ${dataBR(ultimo.data).slice(0, 5)} ${String(ultimo.turno || '').split(' ')[0]} (${String(ultimo.encarregado || '').split(' ')[0]})` : ''}</summary>
        <TabelaTurnos turnos={turnos} lid={D.id} />
      </details>}
      {eq.tag && <div className="linha">
        <button type="button" className="btn wa" onClick={passar}>📤 Passar turno</button>
        <button type="button" className="btn" onClick={receber}>📥 Receber passagem</button>
        <Sp />
        {manut && <button type="button" className="btn min perigo" onClick={novaManut} title="Encerra a manutenção e começa outra">Nova manutenção</button>}
      </div>}
    </>
  );
}

function Equipamento({ eq, i, pendencias }) {
  const { dados, D, mudar, regs, toast, setMapa } = useApp();
  const { CAT, TROC } = dados;
  const [aberto, setAberto] = useState(true);
  const k = `equipamentos.${i}`;
  const c = contagemMapa(eq, CAT);
  const r = resumoParadas(eq.paradas);

  const remover = () => { if (confirm(`Remover o equipamento ${i + 1}?`)) mudar((d) => { d.equipamentos.splice(i, 1); }); };

  const puxarAnterior = () => {
    let achado = null;
    for (const reg of regs) {
      if (reg.id === D.id || reg.modalidade !== 'ppu') continue;
      for (const e of reg.equipamentos || []) {
        if (eq.tag ? normTag(e.tag) === normTag(eq.tag) : norm(reg.encarregado) === norm(D.encarregado)) { achado = { reg, e }; break; }
      }
      if (achado) break;
    }
    if (!achado) { toast(eq.tag ? 'Nenhum apontamento anterior desta TAG' : 'Nenhum apontamento anterior deste encarregado'); return; }
    const { reg, e } = achado;
    if (!confirm(`Copiar o apontamento de ${dataBR(reg.data)} (${reg.turno}) da TAG ${e.tag}? Horários, paradas e fotos não são copiados.`)) return;
    mudar((d) => copiarApontamento(d.equipamentos[i], e));
    toast('Apontamento anterior copiado: ajuste o que mudou');
  };

  const mudarTag = (d) => completarPelaTag(d.equipamentos[i], TROC, CAT);
  const troc = TROC.find((y) => normTag(y.tag) === normTag(eq.tag));

  const mudarDesenho = async (val) => {
    if (val !== '__arquivo') { mudar((d) => { d.equipamentos[i].desenho = val; completarPelaTag(d.equipamentos[i], TROC, CAT); }); return; }
    if (!eq.tag) { toast('Informe a TAG antes de abrir o SVG'); return; }
    const arq = await abrirArquivo('.svg,.html,image/svg+xml,text/html');
    if (!arq) return;
    try {
      const lido = parseSheet(arq.texto);
      if (!lido.sheet.tubes.length) throw new Error('nenhum tubo no desenho');
      store.set(chaveSvg(eq.tag), arq.texto);
      const n = Object.keys(lido.estado).length;
      if (n && confirm(`O SVG já traz ${n} tubos marcados. Usar essa marcação?`)) gravarMapa(eq.tag, '__arquivo', lido.estado, { lid: 'importado', autor: '' });
      mudar((d) => { d.equipamentos[i].desenho = '__arquivo'; });
      toast(`${lido.sheet.tubes.length} tubos carregados`);
    } catch (x) { alert('Não foi possível abrir: ' + x.message); }
  };

  const mapear = async () => {
    let sheet;
    try { sheet = await folhaDe(eq, CAT); } catch (e) { toast(e.message); return; }
    if (!sheet) { toast('Escolha o desenho do espelho (ou abra o SVG do aparelho).'); return; }
    garantirManut(eq.tag, eq.desenho, { total: eq.prod.total });
    setMapa({ i, sheet, estado: lerMapa(eq.tag, eq.desenho).estado });
  };

  return (
    <section className={'card eq' + (aberto ? '' : ' fechado')}>
      <div className="linha topo-card">
        <button type="button" className="dobra" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
          <span className="seta">{aberto ? '▾' : '▸'}</span>
          <b>Equipamento {i + 1}{eq.tag ? ' · ' + eq.tag : ''}</b>
          {pendencias ? <span className="tag outra">{pendencias} a completar</span> : <span className="tag ok">completo</span>}
        </button>
        <Sp />
        <button type="button" className="btn min" onClick={puxarAnterior} title="Copia o último apontamento desta TAG">↺ Anterior</button>
        <button type="button" className="btn min perigo" onClick={remover} title="Remover equipamento">🗑</button>
      </div>
      {!aberto && <p className="dim resumo-eq">{eq.equipe.length} na equipe · {eq.prod.desob || 0} desobstruídos · {eq.paradas.length} parada(s)</p>}
      {aberto && <>
        <div className="grid2">
          <Campo rot="TAG do trocador" k={`${k}.tag`} list="listaTags" placeholder="ex.: HE 41A-01A" aoMudar={mudarTag} />
          <div>
            <label>Desenho do espelho</label>
            <select value={eq.desenho} onChange={(e) => mudarDesenho(e.target.value)}>
              <option value="">Sem desenho</option>
              {CAT.desenhos.map((d) => <option key={d.id} value={d.id}>{d.tipo} – {d.variacao}</option>)}
              <option value="__arquivo">📂 SVG do aparelho…</option>
            </select>
          </div>
        </div>
        {troc && (troc.tipo || troc.area) && <p className="dim pequeno calc">{[troc.tipo, troc.area].filter(Boolean).join(' · ')}</p>}
        <div className="linha">
          <button type="button" className="btn" onClick={mapear} disabled={!(eq.tag && eq.desenho)}>🗺️ Mapear espelho</button>
          {c ? <span className="kpis"><span>🟢 {c.desobstruido}</span><span>🔴 {c.obstruido}</span><span>⚫ {c.tamponado}</span><span>🟠 {c.furado}</span></span>
            : <span className="dim pequeno">sem mapeamento</span>}
        </div>
        <label>AQS do serviço</label><Seg k={`${k}.aqs`} opcoes={[['sim', 'Sim'], ['nao', 'Não']]} />
        <Campo rot="Nº ou referência da AQS" k={`${k}.aqsRef`} />

        <h3>👷 Equipe que trabalhou no equipamento ({eq.equipe.length})</h3>
        <div className="chips">
          {eq.equipe.length ? eq.equipe.map((p, j) => (
            <span className="chip" key={p.nome + j}>{p.nome}<TagOrigem p={p} />
              <button type="button" aria-label="remover" onClick={() => mudar((d) => { d.equipamentos[i].equipe.splice(j, 1); })}>✕</button></span>
          )) : <span className="dim">ninguém apontado</span>}
        </div>
        <AdicionarPessoa caminho={`${k}.equipe`} />

        <h3>⏱️ 1. Horários da atividade</h3>
        <div className="grid2"><Campo rot="DDS – início" k={`${k}.hor.ddsIni`} tipo="time" /><Campo rot="DDS – término" k={`${k}.hor.ddsFim`} tipo="time" /></div>
        <Tempo rot="Tempo do DDS" ini={eq.hor.ddsIni} fim={eq.hor.ddsFim} />
        <div className="grid4"><Campo rot="Liberação" k={`${k}.hor.lib`} tipo="time" /><Campo rot="Início desobstrução" k={`${k}.hor.ini`} tipo="time" /><Campo rot="Término" k={`${k}.hor.fim`} tipo="time" /></div>

        <h3>📋 2. Controle de produção</h3>
        <Producao eq={eq} i={i} c={c} folha={() => folhaDe(eq, CAT)} />

        <h3>🚧 3. Controle de paradas</h3>
        {eq.paradas.map((p, j) => <Parada key={j} i={i} j={j} p={p} />)}
        <div className="linha"><button type="button" className="btn min" onClick={() => mudar((d) => { d.equipamentos[i].paradas.push(paradaVazia()); })}>➕ Parada</button></div>
        <div className="resumo">📈 Total parado: <b>{r.total} min</b> · Hydro: <b>{r.hydro} min</b> · Montisol: <b>{r.montisol} min</b>{r.semHorario ? ` · ${r.semHorario} sem horário` : ''}</div>

        <h3>🔧 4. Atividades / observações</h3>
        <Area rot="Serviço executado" k={`${k}.ativ.servico`} />
        <Area rot="Situação atual" k={`${k}.ativ.situacao`} />
        <Area rot="Pendências" k={`${k}.ativ.pend`} />
        <Campo rot="Próxima etapa / TAG" k={`${k}.ativ.prox`} />

        <h3>📸 5. Registro fotográfico</h3>
        <Fotos caminho={`${k}.anexos`} tag={eq.tag} />
        <div className="grid2"><Campo rot="Antes (texto)" k={`${k}.fotos.antes`} placeholder={(eq.anexos || []).length ? 'conta as fotos anexadas' : 'ex.: 4 fotos no grupo'} />
          <Campo rot="Depois (texto)" k={`${k}.fotos.depois`} placeholder={(eq.anexos || []).length ? 'conta as fotos anexadas' : 'ex.: 4 fotos no grupo'} /></div>
      </>}
    </section>
  );
}

export function FormPPU({ erros }) {
  const { dados, D, EF, mudar, regs } = useApp();
  const daLista = new Set(dados.TROC.map((t) => normTag(t.tag)));
  const doHistorico = [...new Set(regs.flatMap((r) => (r.equipamentos || []).map((e) => e.tag)).filter((t) => t && !daLista.has(normTag(t))))];
  const pendPresenca = erros.filter((e) => D.pessoas.some((p) => e.startsWith(p.nome + ':'))).length;
  const pendDe = (i) => erros.filter((e) => e.startsWith(`Equipamento ${i + 1}:`) || e.startsWith(`Equipamento ${i + 1},`)).length;
  return (
    <>
      <datalist id="listaTags">
        {dados.TROC.map((t) => <option key={t.tag} value={t.tag}>{[t.tipo, t.area].filter(Boolean).join(' · ')}</option>)}
        {doHistorico.map((t) => <option key={t} value={t} />)}
      </datalist>
      <PresencaPPU pendencias={pendPresenca} />
      {D.equipamentos.map((eq, i) => <Equipamento key={eq.uid || i} eq={eq} i={i} pendencias={pendDe(i)} />)}
      <div className="linha"><button type="button" className="btn" onClick={() => mudar((d) => { d.equipamentos.push(novoEq(EF, d)); })}>➕ Adicionar equipamento</button></div>
    </>
  );
}
