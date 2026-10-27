/* Mapeamento do espelho do trocador (tubo a tubo), adaptado do kit de campo do Beacon.
   Lê um desenho SVG (círculos = tubos, data-tube = número do tubo), deixa marcar o status de cada tubo
   e exporta o SVG de volta com data-status em cada tubo. Funciona offline. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const DEFAULT_STATUS = [
    { value: 'desobstruido', label: 'Desobstruído', color: '#16876a' },
    { value: 'obstruido', label: 'Obstruído', color: '#d14343' },
    { value: 'tamponado', label: 'Tamponado', color: '#1b1d24' },
    { value: 'furado', label: 'Furado', color: '#ff9f1c' },
  ];
  const AUTO = /^(ellipse|circle|c[ií]rculo|elipse|path|vector)[\s_-]*\d*$/i;
  const nameOf = (el) => {
    for (const a of ['data-tube', 'data-tubo', 'data-name', 'inkscape:label', 'id']) {
      const v = el.getAttribute(a);
      if (v && !AUTO.test(v.trim())) return v.trim();
    }
    return '';
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Lê o texto de um SVG e devolve { sheet: {viewBox, r, deco, tubes:[[id,x,y,zona]]}, estado:{id:status}, meta } */
  function parseSheet(text) {
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-10000px;top:0;width:1000px;height:1000px;visibility:hidden';
    host.innerHTML = text;
    document.body.appendChild(host);
    try {
      const svg = host.querySelector('svg');
      if (!svg) throw new Error('o arquivo não é um SVG');
      const vb = (svg.getAttribute('viewBox') || `0 0 ${svg.getAttribute('width') || 1000} ${svg.getAttribute('height') || 1000}`).split(/[\s,]+/).map(Number);
      const rootM = svg.getScreenCTM().inverse();
      const all = [...svg.querySelectorAll('circle')];
      // Desenhos do catálogo marcam os tubos com data-tube; se houver, só eles são tubos.
      let els = all.filter((c) => c.hasAttribute('data-tube'));
      let r;
      if (els.length) {
        const radii = new Map();
        for (const c of els) { const k = Math.round(c.r.baseVal.value * 10) / 10; radii.set(k, (radii.get(k) || 0) + 1); }
        r = [...radii.entries()].sort((a, b) => b[1] - a[1])[0][0];
      } else {
        const radii = new Map();
        for (const c of all) { const k = Math.round(c.r.baseVal.value * 10) / 10; radii.set(k, (radii.get(k) || 0) + 1); }
        r = ([...radii.entries()].sort((a, b) => b[1] - a[1])[0] || [0])[0];
        els = all.filter((c) => Math.abs(c.r.baseVal.value - r) <= Math.max(0.6, r * 0.2));
      }
      const pts = els.map((c) => {
        const p = new DOMPoint(c.cx.baseVal.value, c.cy.baseVal.value).matrixTransform(rootM.multiply(c.getScreenCTM()));
        const grp = c.closest('g[id]');
        return { x: p.x, y: p.y, name: nameOf(c), st: c.getAttribute('data-status') || '', zone: grp && grp.id !== 'Tubos' ? grp.id : '' };
      });
      const sorted = [...pts].sort((a, b) => a.y - b.y);
      let row = 0, lastY = -Infinity;
      for (const p of sorted) { if (p.y - lastY > r * 1.1) row++; p.row = row; lastY = p.y; }
      const byRow = new Map();
      for (const p of pts) { if (!byRow.has(p.row)) byRow.set(p.row, []); byRow.get(p.row).push(p); }
      const rw = String(row).length, cw = String(Math.max(...[...byRow.values()].map((l) => l.length))).length;
      const own = pts.filter((p) => p.name).length > pts.length * 0.8;
      const tubes = [], estado = {};
      for (const k of [...byRow.keys()].sort((a, b) => a - b)) {
        byRow.get(k).sort((a, b) => a.x - b.x).forEach((p, i) => {
          const id = own && p.name ? p.name : `${String(k).padStart(rw, '0')}-${String(i + 1).padStart(cw, '0')}`;
          tubes.push([id, +p.x.toFixed(2), +p.y.toFixed(2), p.zone]);
          if (p.st) estado[id] = p.st;
        });
      }
      els.forEach((c) => c.remove());
      const keep = [...svg.attributes].filter((a) => !/^(width|height|viewBox|xmlns(:.*)?|version|id|class|style|data-.*)$/i.test(a.name))
        .map((a) => `${a.name}="${a.value.replace(/"/g, '&quot;')}"`).join(' ');
      const meta = {};
      for (const a of ['trocador', 'data', 'resp', 'desenho']) { const v = svg.getAttribute('data-' + a); if (v) meta[a] = v; }
      return { sheet: { viewBox: vb, r, deco: `<g ${keep}>${svg.innerHTML}</g>`, tubes }, estado, meta };
    } finally { host.remove(); }
  }

  /** Conta os status de um estado {id: status}. */
  function contar(estado, sheet) {
    const c = { desobstruido: 0, obstruido: 0, tamponado: 0, furado: 0 };
    for (const v of Object.values(estado || {})) c[v] = (c[v] || 0) + 1;
    c.total = sheet ? sheet.tubes.length : 0;
    c.semRegistro = c.total - Object.keys(estado || {}).length;
    return c;
  }

  function exportSvg(sheet, estado, meta, statuses) {
    const col = new Map((statuses || DEFAULT_STATUS).map((s) => [s.value, s.color]));
    const v = sheet.viewBox;
    const c = contar(estado, sheet);
    const body = sheet.tubes.map(([id, x, y]) => {
      const st = estado[id] || '';
      return `<circle cx="${x}" cy="${y}" r="${sheet.r}" data-tube="${esc(id)}"${st ? ` data-status="${st}"` : ''} fill="${st ? col.get(st) : '#ffffff'}" stroke="${st ? '#00000059' : '#5d6275'}" stroke-width="${+(sheet.r * 0.28).toFixed(2)}"/>`;
    }).join('\n');
    const m = meta || {};
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${v[2]}" height="${v[3]}" viewBox="${v.join(' ')}" data-beacon-mapeamento="1"` +
      ` data-trocador="${esc(m.trocador)}" data-data="${esc(m.data)}" data-resp="${esc(m.resp)}" data-desenho="${esc(m.desenho)}"` +
      ` data-desobstruidos="${c.desobstruido}" data-obstruidos="${c.obstruido}" data-tamponados="${c.tamponado}" data-furados="${c.furado}"` +
      ` data-desobstruidos-turno="${esc(m.desobstruidosTurno)}">\n${sheet.deco}\n<g id="Tubos">\n${body}\n</g>\n</svg>\n`;
  }

  /** Abre o editor de tela cheia dentro de `root`. opts: {sheet, estado, statuses, titulo, onChange(estado), onClose(estado), onExport(), onImport(text)} */
  function abrir(root, opts) {
    const statuses = opts.statuses || DEFAULT_STATUS;
    const color = new Map(statuses.map((s) => [s.value, s.color]));
    const sheet = opts.sheet;
    const estado = Object.assign({}, opts.estado || {});
    const S = { brush: statuses[0].value, mode: 'mark', vb: null, undo: [] };
    root.hidden = false;
    document.body.classList.add('mapa-aberto');
    root.innerHTML = `
      <header class="mapa-top"><b>${esc(opts.titulo || 'Espelho')}</b><span class="kpi" data-r="kpi"></span>
        <button class="btn" data-a="fechar">✕ Fechar</button></header>
      <div class="mapa-row" data-r="brushes"></div>
      <div class="mapa-row">
        <button class="btn on" data-a="mark">✏ Marcar</button><button class="btn" data-a="move">✋ Mover</button>
        <button class="btn" data-a="zin">＋</button><button class="btn" data-a="zout">－</button><button class="btn" data-a="fit">⤢</button>
        <button class="btn" data-a="undo">↶</button><span class="sp"></span>
        <button class="btn" data-a="import">📂 Importar SVG</button><button class="btn pri" data-a="export">📤 Enviar SVG</button>
      </div>
      <div class="mapa-main" data-r="main"></div>
      <input type="file" accept=".svg,image/svg+xml" hidden data-r="file">`;
    const $ = (r) => root.querySelector(`[data-r="${r}"]`);
    const svgEl = document.createElementNS(NS, 'svg');
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = sheet.deco;
    svgEl.appendChild(g);
    const circles = new Map();
    const paint = (c, st) => { c.setAttribute('fill', st ? color.get(st) || '#999' : '#fff'); c.setAttribute('stroke', st ? 'rgba(0,0,0,.35)' : '#5d6275'); };
    for (const [id, x, y] of sheet.tubes) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', sheet.r);
      c.setAttribute('data-id', id); c.setAttribute('stroke-width', sheet.r * 0.28);
      paint(c, estado[id]);
      svgEl.appendChild(c);
      circles.set(id, c);
    }
    $('main').appendChild(svgEl);
    const fitVb = () => { const v = sheet.viewBox, m = Math.max(v[2], v[3]) * 0.03; return [v[0] - m, v[1] - m, v[2] + 2 * m, v[3] + 2 * m]; };
    const applyVb = () => svgEl.setAttribute('viewBox', S.vb.join(' '));
    S.vb = fitVb(); applyVb();

    function counts() {
      const c = contar(estado, sheet);
      $('brushes').innerHTML = statuses.map((s) => `<button class="brush${S.brush === s.value ? ' on' : ''}" data-b="${s.value}"><i style="background:${s.color}"></i>${esc(s.label)} <b>${c[s.value] || 0}</b></button>`).join('');
      const base = c.total - c.tamponado;
      $('kpi').innerHTML = `${base ? Math.round((c.desobstruido / base) * 100) : 0}%<small>${c.semRegistro} sem registro de ${c.total}</small>`;
      if (opts.onChange) opts.onChange(Object.assign({}, estado));
    }
    function setMany(ids, st) {
      const prev = ids.map((id) => [id, estado[id] || '']);
      let n = 0;
      for (const id of ids) { if ((estado[id] || '') === st) continue; if (st) estado[id] = st; else delete estado[id]; paint(circles.get(id), st); n++; }
      if (n) { S.undo.push(prev); if (S.undo.length > 80) S.undo.shift(); counts(); }
    }
    const toSvg = (x, y) => new DOMPoint(x, y).matrixTransform(svgEl.getScreenCTM().inverse());
    const zoom = (k) => { const cx = S.vb[0] + S.vb[2] / 2, cy = S.vb[1] + S.vb[3] / 2; S.vb = [cx - (S.vb[2] * k) / 2, cy - (S.vb[3] * k) / 2, S.vb[2] * k, S.vb[3] * k]; applyVb(); };

    const pts = new Map();
    let paintIds = null, paintSt = '', pan = null, pinch = null;
    svgEl.addEventListener('pointerdown', (e) => {
      svgEl.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        paintIds = null;
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), c: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2), vb: [...S.vb] };
        return;
      }
      const id = e.target.getAttribute && e.target.getAttribute('data-id');
      if (S.mode === 'mark' && id && e.button === 0) {
        paintSt = (estado[id] || '') === S.brush ? '' : S.brush;
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
        S.vb = [pinch.c.x - (pinch.c.x - pinch.vb[0]) * k, pinch.c.y - (pinch.c.y - pinch.vb[1]) * k, pinch.vb[2] * k, pinch.vb[3] * k];
        applyVb();
        return;
      }
      if (paintIds) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const id = el && el.getAttribute && el.getAttribute('data-id');
        if (id && !paintIds.includes(id)) { paintIds.push(id); paint(circles.get(id), paintSt); }
        return;
      }
      if (pan) {
        const p = toSvg(e.clientX, e.clientY);
        S.vb = [S.vb[0] - (p.x - pan.x), S.vb[1] - (p.y - pan.y), S.vb[2], S.vb[3]];
        applyVb();
      }
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (paintIds) { const ids = paintIds; paintIds = null; setMany(ids, paintSt); }
      if (!pts.size) pan = null;
    };
    svgEl.addEventListener('pointerup', end);
    svgEl.addEventListener('pointercancel', end);
    svgEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = toSvg(e.clientX, e.clientY);
      const k = e.deltaY > 0 ? 1.18 : 1 / 1.18;
      S.vb = [p.x - (p.x - S.vb[0]) * k, p.y - (p.y - S.vb[1]) * k, S.vb[2] * k, S.vb[3] * k];
      applyVb();
    }, { passive: false });

    function fechar() {
      root.hidden = true;
      root.innerHTML = '';
      document.body.classList.remove('mapa-aberto');
      if (opts.onClose) opts.onClose(Object.assign({}, estado));
    }
    root.onclick = (e) => {
      const b = e.target.closest('[data-b]');
      if (b) { S.brush = b.dataset.b; counts(); return; }
      const a = e.target.closest('[data-a]');
      if (!a) return;
      const act = a.dataset.a;
      if (act === 'fechar') fechar();
      else if (act === 'mark' || act === 'move') {
        S.mode = act;
        root.querySelector('[data-a="mark"]').classList.toggle('on', act === 'mark');
        root.querySelector('[data-a="move"]').classList.toggle('on', act === 'move');
      } else if (act === 'zin') zoom(1 / 1.4);
      else if (act === 'zout') zoom(1.4);
      else if (act === 'fit') { S.vb = fitVb(); applyVb(); }
      else if (act === 'undo') {
        const prev = S.undo.pop();
        if (!prev) return;
        for (const [id, st] of prev) { if (st) estado[id] = st; else delete estado[id]; paint(circles.get(id), st); }
        counts();
      } else if (act === 'export') { if (opts.onExport) opts.onExport(Object.assign({}, estado)); }
      else if (act === 'import') $('file').click();
    };
    $('file').onchange = async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const lido = parseSheet(await f.text());
        if (lido.sheet.tubes.length !== sheet.tubes.length && !confirm(`O SVG tem ${lido.sheet.tubes.length} tubos e o desenho atual ${sheet.tubes.length}. Importar mesmo assim?`)) return;
        for (const id of Object.keys(estado)) delete estado[id];
        Object.assign(estado, lido.estado);
        for (const [id, c] of circles) paint(c, estado[id]);
        S.undo = [];
        counts();
      } catch (x) { alert('Não foi possível ler o SVG: ' + x.message); }
    };
    counts();
    return { fechar };
  }

  window.Mapa = { parseSheet, exportSvg, abrir, contar, DEFAULT_STATUS };
})();
