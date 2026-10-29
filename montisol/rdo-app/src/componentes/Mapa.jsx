/* Editor de tela cheia do espelho: marcar tubos (toque ou arrasto), mover, zoom (botões, roda, pinça), desfazer, importar e enviar SVG.
   Os tubos são pintados direto no SVG (sem re-render do React) para o arrasto ficar leve com quase mil tubos.
   Modos (lib/gestos.js): abre em Mover, onde nenhum toque marca tubo; só em Marcar o toque/arrasto marca. */
import { useEffect, useRef, useState } from 'react';
import { contar, DEFAULT_STATUS, parseSheet } from '../lib/mapa.js';
import { gestoAoTocar, gravarPintura, MODO_INICIAL, MODOS, statusAoPintar } from '../lib/gestos.js';

const NS = 'http://www.w3.org/2000/svg';

export function Mapa({ sheet, estadoInicial, statuses, titulo, onChange, onClose, onEnviarImagem, onEnviarArquivo, onBaixarSvg, aoImportar }) {
  const lista = statuses || DEFAULT_STATUS;
  const host = useRef(null);
  const est = useRef({ ...(estadoInicial || {}) });
  const S = useRef({ brush: lista[0].value, mode: MODO_INICIAL, vb: null, undo: [] });
  const api = useRef({});
  const [brush, setBrush] = useState(lista[0].value);
  const [modo, setModo] = useState(MODO_INICIAL);
  const [c, setC] = useState(() => contar(est.current, sheet));
  const cbs = useRef({ onChange });
  cbs.current.onChange = onChange;

  useEffect(() => {
    const estado = est.current;
    const color = new Map(lista.map((s) => [s.value, s.color]));
    const svgEl = document.createElementNS(NS, 'svg');
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = sheet.deco;
    svgEl.appendChild(g);
    const circles = new Map();
    const paint = (el, st) => { el.setAttribute('fill', st ? color.get(st) || '#999' : '#fff'); el.setAttribute('stroke', st ? 'rgba(0,0,0,.35)' : '#5d6275'); };
    for (const [id, x, y] of sheet.tubes) {
      const el = document.createElementNS(NS, 'circle');
      el.setAttribute('cx', x); el.setAttribute('cy', y); el.setAttribute('r', sheet.r);
      el.setAttribute('data-id', id); el.setAttribute('stroke-width', sheet.r * 0.28);
      paint(el, estado[id]);
      svgEl.appendChild(el);
      circles.set(id, el);
    }
    host.current.appendChild(svgEl);
    const fitVb = () => { const v = sheet.viewBox, m = Math.max(v[2], v[3]) * 0.03; return [v[0] - m, v[1] - m, v[2] + 2 * m, v[3] + 2 * m]; };
    const applyVb = () => svgEl.setAttribute('viewBox', S.current.vb.join(' '));
    S.current.vb = fitVb(); applyVb();

    const atualizar = (opcoes) => { setC(contar(estado, sheet)); if (cbs.current.onChange) cbs.current.onChange({ ...estado }, opcoes); };
    function setMany(ids, st) {
      const prev = ids.map((id) => [id, estado[id] || '']);
      let n = 0;
      for (const id of ids) { if ((estado[id] || '') === st) continue; if (st) estado[id] = st; else delete estado[id]; paint(circles.get(id), st); n++; }
      if (n) { S.current.undo.push(prev); if (S.current.undo.length > 80) S.current.undo.shift(); atualizar(); }
    }
    const toSvg = (x, y) => new DOMPoint(x, y).matrixTransform(svgEl.getScreenCTM().inverse());
    const zoom = (k) => { const vb = S.current.vb, cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2; S.current.vb = [cx - (vb[2] * k) / 2, cy - (vb[3] * k) / 2, vb[2] * k, vb[3] * k]; applyVb(); };

    const pts = new Map();
    let paintIds = null, paintSt = '', paintModo = '', pan = null, pinch = null;
    // pintura começada e não gravada: volta a cor de cada tubo para o que está salvo
    const cancelarPintura = () => { if (paintIds) for (const id of paintIds) paint(circles.get(id), estado[id]); paintIds = null; };
    svgEl.addEventListener('pointerdown', (e) => {
      svgEl.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const id = e.target.getAttribute && e.target.getAttribute('data-id');
      const gesto = gestoAoTocar({ modo: S.current.mode, sobreTubo: !!id, botao: e.button, dedos: pts.size });
      if (gesto === 'pinca') {
        cancelarPintura(); pan = null;
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), c: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2), vb: [...S.current.vb] };
        return;
      }
      if (gesto === 'pintar') {
        paintSt = statusAoPintar(estado[id], S.current.brush);
        paintModo = S.current.mode;
        paintIds = [id];
        paint(circles.get(id), paintSt);
      } else {
        const p = toSvg(e.clientX, e.clientY);
        pan = { x: p.x, y: p.y };
      }
    });
    svgEl.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const k = pinch.d / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
        S.current.vb = [pinch.c.x - (pinch.c.x - pinch.vb[0]) * k, pinch.c.y - (pinch.c.y - pinch.vb[1]) * k, pinch.vb[2] * k, pinch.vb[3] * k];
        applyVb();
        return;
      }
      if (paintIds) {
        if (S.current.mode !== 'mark') { cancelarPintura(); return; }
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const id = el && el.getAttribute && el.getAttribute('data-id');
        if (id && !paintIds.includes(id)) { paintIds.push(id); paint(circles.get(id), paintSt); }
        return;
      }
      if (pan) {
        const p = toSvg(e.clientX, e.clientY);
        const vb = S.current.vb;
        S.current.vb = [vb[0] - (p.x - pan.x), vb[1] - (p.y - pan.y), vb[2], vb[3]];
        applyVb();
      }
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (paintIds) {
        if (gravarPintura({ modoNoInicio: paintModo, modoAgora: S.current.mode, cancelado: e.type === 'pointercancel' })) { const ids = paintIds; paintIds = null; setMany(ids, paintSt); }
        else cancelarPintura();
      }
      if (!pts.size) pan = null;
    };
    svgEl.addEventListener('pointerup', end);
    svgEl.addEventListener('pointercancel', end);
    svgEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      const k = e.deltaY > 0 ? 1.18 : 1 / 1.18;
      const vb = S.current.vb;
      S.current.vb = [p.x - (p.x - vb[0]) * k, p.y - (p.y - vb[1]) * k, vb[2] * k, vb[3] * k];
      applyVb();
    }, { passive: false });

    api.current = {
      zoom,
      fit: () => { S.current.vb = fitVb(); applyVb(); },
      undo: () => {
        const prev = S.current.undo.pop();
        if (!prev) return;
        for (const [id, st] of prev) { if (st) estado[id] = st; else delete estado[id]; paint(circles.get(id), st); }
        atualizar();
      },
      // troca o estado inteiro (importação): as mudanças não contam como marcação deste turno
      substituir: (novo, { desfazivel } = {}) => {
        const ids = [...new Set([...Object.keys(estado), ...Object.keys(novo)])];
        const prev = ids.map((id) => [id, estado[id] || '']);
        for (const id of Object.keys(estado)) delete estado[id];
        Object.assign(estado, novo);
        for (const [id, el] of circles) paint(el, estado[id]);
        if (desfazivel) S.current.undo.push(prev); else S.current.undo = [];
        atualizar({ importado: true });
      },
    };
    document.body.classList.add('mapa-aberto');
    return () => { document.body.classList.remove('mapa-aberto'); svgEl.remove(); };
  }, [sheet, lista]);

  const escolherBrush = (b) => { S.current.brush = b; setBrush(b); };
  const escolherModo = (m) => { S.current.mode = m; setModo(m); };
  const importar = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const texto = await f.text();
      // passagem de turno: junta com o que já está marcado (aoImportar devolve o estado juntado)
      // ação em massa: só com confirmação (aoImportar pergunta antes de juntar a passagem)
      const juntado = aoImportar ? aoImportar(texto) : null;
      if (juntado) { api.current.substituir(juntado); return; }
      if (juntado === false) return; // passagem recusada na confirmação
      const lido = parseSheet(texto);
      if (lido.sheet.tubes.length !== sheet.tubes.length && !confirm(`O SVG tem ${lido.sheet.tubes.length} tubos e o desenho atual ${sheet.tubes.length}. Importar mesmo assim?`)) return;
      const n = Object.keys(lido.estado).length;
      if (!confirm(`Substituir TODAS as marcações deste espelho pelas do arquivo (${n} tubo(s) marcados nele)? Dá para voltar com ↶ Desfazer.`)) return;
      api.current.substituir(lido.estado, { desfazivel: true });
    } catch (x) { alert('Não foi possível ler o SVG: ' + x.message); }
  };
  const arquivo = useRef(null);
  const base = c.total - c.tamponado;

  return (
    <section className="mapa">
      <header className="mapa-top"><b>{titulo || 'Espelho'}</b>
        <span className="kpi">{base ? Math.round((c.desobstruido / base) * 100) : 0}%<small>{c.semRegistro} sem registro de {c.total}</small></span>
        <button type="button" className="btn" onClick={() => onClose({ ...est.current })}>✕ Fechar</button></header>
      <div className="mapa-row">
        {lista.map((s) => (
          <button type="button" key={s.value} className={'brush' + (brush === s.value ? ' on' : '')} onClick={() => escolherBrush(s.value)}>
            <i style={{ background: s.color }} />{s.label} <b>{c[s.value] || 0}</b></button>
        ))}
      </div>
      <div className="mapa-row">
        <div className="seg modo-mapa" role="radiogroup" aria-label="Modo do mapa">
          <button type="button" role="radio" aria-checked={modo === 'move'} data-modo="move" className={modo === 'move' ? 'on' : ''} onClick={() => escolherModo('move')}>✋ Mover</button>
          <button type="button" role="radio" aria-checked={modo === 'mark'} data-modo="mark" className={modo === 'mark' ? 'on' : ''} onClick={() => escolherModo('mark')}>✏ Marcar</button>
        </div>
        <button type="button" className="btn" onClick={() => api.current.zoom(1 / 1.4)}>＋</button>
        <button type="button" className="btn" onClick={() => api.current.zoom(1.4)}>－</button>
        <button type="button" className="btn" onClick={() => api.current.fit()}>⤢</button>
        <button type="button" className="btn" onClick={() => api.current.undo()} title="Desfazer">↶</button>
        <span className="sp" />
        <button type="button" className="btn" onClick={() => arquivo.current.click()}>📂 Importar</button>
      </div>
      <div className="mapa-row">
        <button type="button" className="btn pri" onClick={() => onEnviarImagem({ ...est.current })} title="Imagem PNG com as contagens: o WhatsApp mostra como foto">🖼️ Enviar imagem</button>
        <button type="button" className="btn" onClick={() => onEnviarArquivo({ ...est.current })} title="Documento com o SVG dentro, para o painel">📄 Enviar arquivo</button>
        <button type="button" className="btn" onClick={() => onBaixarSvg({ ...est.current })}>⬇ SVG</button>
      </div>
      <div className={'modo-aviso ' + modo} role="status" aria-live="polite" data-modo-aviso={modo}>
        {modo === 'move' ? <>✋ <b>{MODOS.move.aviso}</b> · para marcar, toque em ✏ Marcar</>
          : <>✏ <b>{MODOS.mark.aviso}</b> como <i className="cor" style={{ background: (lista.find((s) => s.value === brush) || lista[0]).color }} /> {(lista.find((s) => s.value === brush) || lista[0]).label}</>}
      </div>
      <div className={'mapa-main modo-' + modo} ref={host} />
      <input type="file" accept=".svg,.html,image/svg+xml,text/html" hidden ref={arquivo} onChange={importar} />
    </section>
  );
}
